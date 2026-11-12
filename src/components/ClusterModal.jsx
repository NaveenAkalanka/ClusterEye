import { useEffect, useState } from "react";
import { doc, deleteDoc, writeBatch, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { isValidSubnetMask, isIpInSubnet } from "../utils/network";
import { DEFAULT_CLUSTER_COLOR, fmtBytes } from "../utils/format";
import Dialog from "./Dialog";
import { ClusterColorPicker, Field, FormAlert, RelatedLinks } from "./ui";

export default function ClusterModal({ cluster, onClose, uid, allClusters = [], allNodes = [], disks = [] }) {
    // Local state for editing
    const [editMode, setEditMode] = useState(false);
    const [localName, setLocalName] = useState(cluster.cluster);
    const [localIp, setLocalIp] = useState(cluster.ipAddress || "");
    const [localSubnet, setLocalSubnet] = useState(cluster.subnetMask || "255.255.255.0");
    const [localColor, setLocalColor] = useState(cluster.color || DEFAULT_CLUSTER_COLOR);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Delete state
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    // Show the saved record again after Cancel or Save.
    useEffect(() => {
        if (editMode) return;
        setLocalName(cluster.cluster);
        setLocalIp(cluster.ipAddress || "");
        setLocalSubnet(cluster.subnetMask || "255.255.255.0");
        setLocalColor(cluster.color || DEFAULT_CLUSTER_COLOR);
    }, [cluster, editMode]);

    // Check dirty
    const isDirty = localName !== cluster.cluster || localIp !== (cluster.ipAddress || "") || localSubnet !== (cluster.subnetMask || "255.255.255.0") || localColor !== (cluster.color || DEFAULT_CLUSTER_COLOR);

    /* ---------------- UPDATE ---------------- */
    async function handleSave() {
        setError("");

        if (!localName.trim()) return setError("Cluster name required.");

        // CHECK DUPLICATES (Existing Name)
        const nameExists = allClusters.some(c => c.id !== cluster.id && c.cluster.toLowerCase() === localName.trim().toLowerCase());
        if (nameExists) return setError(`Cluster "${localName}" already exists.`);

        // CHECK IP FORMAT & DUPLICATES
        const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
        if (!ipRegex.test(localIp)) return setError("Invalid IP format.");

        if (!isValidSubnetMask(localSubnet)) return setError("Invalid subnet mask format.");

        const ipExists =
            allClusters.some(c => c.id !== cluster.id && c.ipAddress === localIp) ||
            allNodes.some(n => n.ipAddress === localIp); // Check against node IPs too just in case

        if (ipExists) return setError("IP address already in use.");

        // If IP or subnet changed, every child node IP must still fit the new subnet
        const ipChanged = localIp !== (cluster.ipAddress || "");
        const subnetChanged = localSubnet !== (cluster.subnetMask || "255.255.255.0");
        if (ipChanged || subnetChanged) {
            const childNodes = allNodes.filter(n => n.clusterId ? n.clusterId === cluster.id : n.cluster === cluster.cluster);
            const outOfSubnet = childNodes.filter(
                n => n.ipAddress && !isIpInSubnet(n.ipAddress, localIp, localSubnet)
            );
            if (outOfSubnet.length > 0) {
                const names = outOfSubnet.slice(0, 3).map(n => n.node).join(", ");
                const more = outOfSubnet.length > 3 ? ` (+${outOfSubnet.length - 3} more)` : "";
                return setError(
                    `${outOfSubnet.length} node(s) would fall outside the new subnet: ${names}${more}. Re-IP them first.`
                );
            }
        }

        setSaving(true);
        try {
            // Validate duplicates via query needed here theoretically, skipping for brevity as main logic usually handles unique constraints, 
            // but for robustness we should add headers. For now relying on basic save.

            const batch = writeBatch(db);
            const clusterRef = doc(db, "clusters", cluster.id);

            batch.update(clusterRef, {
                cluster: localName.trim(),
                ipAddress: localIp.trim(),
                subnetMask: localSubnet.trim(),
                color: localColor,
                updatedAt: serverTimestamp(),
            });

            // Cascade update names in nodes/disks
            if (localName.trim() !== cluster.cluster) {
                const qNodes = query(collection(db, "nodes"), where("userId", "==", uid), where("cluster", "==", cluster.cluster));
                const snapNodes = await getDocs(qNodes);
                snapNodes.forEach(d => {
                    batch.update(doc(db, "nodes", d.id), { cluster: localName.trim(), clusterId: cluster.id });
                });

                const qDisks = query(collection(db, "disks"), where("userId", "==", uid), where("cluster", "==", cluster.cluster));
                const snapDisks = await getDocs(qDisks);
                snapDisks.forEach(d => {
                    batch.update(doc(db, "disks", d.id), { cluster: localName.trim(), clusterId: cluster.id });
                });
            }

            await batch.commit();
            setEditMode(false);
        } catch (err) {
            console.error(err);
            setError("Could not save the cluster. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------------- DELETE ---------------- */
    // Explain what blocks deletion before asking for the name to be typed.
    function requestDelete() {
        const nodeCount = allNodes.filter(n => n.clusterId ? n.clusterId === cluster.id : n.cluster === cluster.cluster).length;
        const diskCount = disks.filter(d => d.clusterId ? d.clusterId === cluster.id : d.cluster === cluster.cluster).length;
        if (nodeCount > 0 || diskCount > 0) {
            const parts = [nodeCount > 0 && `${nodeCount} ${nodeCount === 1 ? "node" : "nodes"}`, diskCount > 0 && `${diskCount} ${diskCount === 1 ? "disk" : "disks"}`].filter(Boolean);
            return setError(`This cluster still has ${parts.join(" and ")}. Delete or move them first.`);
        }
        setError("");
        setConfirmDelete(true);
    }

    async function handleDelete() {

        setSaving(true);
        try {
            await deleteDoc(doc(db, "clusters", cluster.id));
            onClose(); // Close modal on success
        } catch (err) {
            console.error(err);
            setError("Could not delete the cluster. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    }

    const footer = confirmDelete ? (
        <>
            <button type="button" onClick={() => { setConfirmDelete(false); setError(""); setDeleteConfirmText(""); }} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={saving || deleteConfirmText !== cluster.cluster} className="btn btn-danger-solid">
                {saving ? "Deleting..." : "Delete Cluster"}
            </button>
        </>
    ) : editMode ? (
        <>
            <button type="button" onClick={() => { setEditMode(false); setError(""); }} disabled={saving} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : "Save Changes"}
            </button>
        </>
    ) : (
        <>
            <button type="button" onClick={requestDelete} className="btn btn-danger mr-auto">Delete</button>
            <button type="button" onClick={() => setEditMode(true)} className="btn btn-secondary">Edit</button>
        </>
    );

    const clusterNodes = allNodes.filter((n) => n.clusterId ? n.clusterId === cluster.id : n.cluster === cluster.cluster);
    const clusterDisks = disks.filter((d) => d.clusterId ? d.clusterId === cluster.id : d.cluster === cluster.cluster);

    return (
        <Dialog
            title={confirmDelete ? "Delete Cluster?" : editMode ? "Edit Cluster" : cluster.cluster}
            onClose={onClose}
            dirty={editMode && isDirty}
            focusKey={`${editMode}-${confirmDelete}`}
            footer={footer}
        >
            {error && <FormAlert className="mb-4">{error}</FormAlert>}

            {confirmDelete ? (
                <div className="space-y-4">
                    <p className="text-sm text-white/80">
                        This permanently removes <span className="font-semibold text-white">{cluster.cluster}</span> from your inventory and can't be undone.
                    </p>
                    <Field label={`Type "${cluster.cluster}" to Confirm`}>
                        <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} autoComplete="off" spellCheck={false} className="input" />
                    </Field>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Field label="Cluster Name">
                                <input readOnly={!editMode} value={localName} onChange={(e) => setLocalName(e.target.value)} maxLength={50} className="input" />
                            </Field>
                        </div>
                        <Field label="IP Address">
                            <input readOnly={!editMode} value={localIp} onChange={(e) => setLocalIp(e.target.value)} inputMode="decimal" spellCheck={false} className="input font-mono" />
                        </Field>
                        <Field label="Subnet Mask">
                            <input readOnly={!editMode} value={localSubnet} onChange={(e) => setLocalSubnet(e.target.value)} inputMode="decimal" spellCheck={false} className="input font-mono" />
                        </Field>
                    </div>

                    {editMode ? (
                        <div>
                            <div className="field-label">Cluster Color</div>
                            <ClusterColorPicker value={localColor} onChange={setLocalColor} />
                        </div>
                    ) : (
                        <dl className="grid grid-cols-3 gap-3">
                            {[["Nodes", cluster.nodes || 0], ["Disks", cluster.disks || 0], ["Storage", fmtBytes(cluster.total)]].map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-line bg-raised p-3">
                                    <dt className="mb-1 text-xs font-medium text-white/70">{label}</dt>
                                    <dd className="truncate font-mono text-lg font-semibold text-white">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {!editMode && (
                        <RelatedLinks
                            groups={[
                                { label: "Nodes", items: clusterNodes.map((n) => ({ key: n.id, label: n.node, to: `/nodes?open=${n.id}` })), empty: "No nodes" },
                                { label: "Disks", items: clusterDisks.map((d) => ({ key: d.id, label: d.disk, to: `/disks?open=${d.id}` })), empty: "No disks" },
                            ]}
                        />
                    )}
                </div>
            )}
        </Dialog>
    );
}
