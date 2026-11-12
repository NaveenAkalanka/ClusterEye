import { useEffect, useState } from "react";
import { doc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { DEFAULT_CLUSTER_COLOR, fmtBytes } from "../utils/format";
import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import NumberStepper from "./NumberStepper";
import { Field, FormAlert, RelatedLinks } from "./ui";

const savedValues = (disk) => ({
    disk: disk.disk,
    model: disk.model,
    role: disk.role,
    cluster: disk.cluster,
    totalGB: (disk.total || 0) / 1_000_000_000,
});

export default function DiskModal({ disk, onClose, allNodes, clusters, allDisks = [] }) {
    const [editMode, setEditMode] = useState(false);

    // Local state for editing
    const [local, setLocal] = useState(() => savedValues(disk));

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Show the saved record again after Cancel or Save.
    useEffect(() => {
        if (!editMode) setLocal(savedValues(disk));
    }, [disk, editMode]);

    const dirty = editMode && JSON.stringify(local) !== JSON.stringify(savedValues(disk));

    /* ---------------- Actions ---------------- */
    async function handleSave() {
        const newName = local.disk.trim();
        const newTotal = Number(local.totalGB) * 1_000_000_000;

        if (!newName) return setError("Disk name cannot be empty.");
        if (newTotal <= 0) return setError("Total size must be greater than 0.");

        // Duplicate Check
        const dupe = allDisks.some(d => d.id !== disk.id && d.disk.toLowerCase() === newName.toLowerCase());
        if (dupe) return setError(`Disk "${newName}" already exists.`);

        // Resize Validation: Cannot shrink below current usage
        if (newTotal < disk.used) {
            return setError(`Total size can't go below the ${fmtBytes(disk.used)} already allocated. Remove allocations first.`);
        }

        // Cluster reassignment guard: cannot move cluster while allocations exist
        if (local.cluster !== disk.cluster) {
            const allocatedBy = allNodes.filter(n => n.allocations?.some(a => a.diskId ? a.diskId === disk.id : a.disk === disk.disk));
            if (allocatedBy.length > 0) {
                return setError(
                    `Cannot move disk to a different cluster while it is allocated to ${allocatedBy.length} node(s). Deallocate first.`
                );
            }
        }

        setSaving(true);
        try {
            const selectedCluster = clusters.find((item) => item.cluster === local.cluster);
            if (!selectedCluster) throw new Error("Selected cluster no longer exists");
            const batch = writeBatch(db);
            const diskRef = doc(db, "disks", disk.id);

            // Update Disk
            batch.update(diskRef, {
                disk: newName,
                model: local.model,
                role: local.role,
                cluster: local.cluster,
                clusterId: selectedCluster.id,
                total: newTotal,
                updatedAt: serverTimestamp()
            });

            // Rename logic if name changed
            if (newName !== disk.disk) {
                allNodes.forEach(n => {
                    if (n.allocations && n.allocations.some(a => a.diskId ? a.diskId === disk.id : a.disk === disk.disk)) {
                        const newAllocations = n.allocations.map(a => (a.diskId ? a.diskId === disk.id : a.disk === disk.disk) ? { ...a, diskId: disk.id, disk: newName } : a);
                        const nodeRef = doc(db, "nodes", n.id);
                        batch.update(nodeRef, { allocations: newAllocations });
                    }
                });
            }

            await batch.commit();
            setEditMode(false);
        } catch (e) {
            console.error(e);
            setError("Failed to update disk.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        // Strict Check: Cannot delete if assigned to ANY node
        const linkedNodes = allNodes.filter(n => n.allocations?.some(a => a.diskId ? a.diskId === disk.id : a.disk === disk.disk));
        if (linkedNodes.length > 0) {
            setError(`This disk is allocated to ${linkedNodes.map(n => n.node).join(", ")}. Remove those allocations first.`);
            return; // Do not proceed to confirmation
        }

        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }

        setSaving(true);
        try {
            await deleteDoc(doc(db, "disks", disk.id));
            onClose();
        } catch (e) {
            console.error(e);
            setError("Could not delete the disk. Check your connection and try again.");
            setSaving(false);
        }
    }

    const totalBytes = Number(local.totalGB || 0) * 1_000_000_000;
    const usedPercent = totalBytes > 0 ? (Number(disk.used || 0) / totalBytes) * 100 : 0;

    const footer = confirmDelete ? (
        <>
            <button type="button" onClick={() => { setConfirmDelete(false); setError(""); }} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={saving} className="btn btn-danger-solid">
                {saving ? "Deleting..." : "Delete Disk"}
            </button>
        </>
    ) : editMode ? (
        <>
            <button type="button" onClick={() => { setEditMode(false); setError(""); }} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : "Save Changes"}
            </button>
        </>
    ) : (
        <>
            <button type="button" onClick={handleDelete} className="btn btn-danger mr-auto">Delete</button>
            <button type="button" onClick={() => setEditMode(true)} className="btn btn-secondary">Edit</button>
        </>
    );

    const diskCluster = clusters.find((c) => disk.clusterId ? c.id === disk.clusterId : c.cluster === disk.cluster);
    const diskNodes = allNodes.filter((n) => n.allocations?.some((a) => a.diskId ? a.diskId === disk.id : a.disk === disk.disk));

    return (
        <Dialog
            title={confirmDelete ? "Delete Disk?" : editMode ? "Edit Disk" : disk.disk}
            onClose={onClose}
            dirty={dirty}
            focusKey={`${editMode}-${confirmDelete}`}
            footer={footer}
        >
            {error && <FormAlert className="mb-4">{error}</FormAlert>}

            {confirmDelete ? (
                <p className="text-sm text-white/80">
                    Delete <span className="font-semibold text-white">{disk.disk}</span> from your inventory? This can't be undone.
                </p>
            ) : (
                <div className="space-y-4">
                    <Field label="Disk Name">
                        <input type="text" value={local.disk} onChange={(e) => setLocal({ ...local, disk: e.target.value })} readOnly={!editMode} autoCapitalize="off" spellCheck={false} className="input" />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Model">
                            <CustomSelect value={local.model} onChange={(v) => setLocal({ ...local, model: v })} options={["SSD", "HDD", "NVME"]} readOnly={!editMode} clearable={false} />
                        </Field>
                        <Field label="Role">
                            <CustomSelect value={local.role} onChange={(v) => setLocal({ ...local, role: v })} options={["DATA", "OS", "BACKUP"]} readOnly={!editMode} clearable={false} />
                        </Field>
                        <Field label="Cluster">
                            <CustomSelect
                                value={local.cluster}
                                onChange={(v) => setLocal({ ...local, cluster: v })}
                                options={clusters.map(c => c.cluster)}
                                readOnly={!editMode}
                                clearable={false}
                                renderOption={(opt) => {
                                    const targetCluster = clusters.find(c => c.cluster === opt);
                                    return (
                                        <div className="flex min-w-0 items-center gap-2">
                                            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: targetCluster?.color || DEFAULT_CLUSTER_COLOR }}></div>
                                            <span className="truncate">{opt}</span>
                                        </div>
                                    );
                                }}
                            />
                        </Field>
                        <Field label="Total Size (GB)">
                            <NumberStepper value={local.totalGB} onChange={(v) => setLocal({ ...local, totalGB: v })} min={1} readOnly={!editMode} unit="GB" className="w-full" />
                        </Field>
                    </div>

                    <Field label="Usage">
                        <div className="space-y-2 rounded-xl border border-line bg-raised p-3">
                            <div className="flex justify-between font-mono text-xs text-white/70">
                                <span>{fmtBytes(disk.used)} / {fmtBytes(totalBytes)}</span>
                                <span>{Math.round(usedPercent)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <div className={`bar-fill h-full rounded-full ${usedPercent >= 85 ? "bg-caution" : "bg-accent"}`} style={{ width: `${Math.min(100, usedPercent)}%` }}></div>
                            </div>
                        </div>
                    </Field>

                    {!editMode && (
                        <RelatedLinks
                            groups={[
                                { label: "Cluster", items: diskCluster ? [{ key: diskCluster.id, label: diskCluster.cluster, to: `/clusters?open=${diskCluster.id}`, color: diskCluster.color || DEFAULT_CLUSTER_COLOR }] : [], empty: "Not found" },
                                { label: "Nodes", items: diskNodes.map((n) => ({ key: n.id, label: n.node, to: `/nodes?open=${n.id}` })), empty: "Not allocated to any node" },
                            ]}
                        />
                    )}
                </div>
            )}
        </Dialog>
    );
}
