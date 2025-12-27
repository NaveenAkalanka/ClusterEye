import React, { useState } from "react";
import { XCircle, HardDrives } from "@phosphor-icons/react";
import { doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import CustomSelect from "./CustomSelect";

export default function DiskModal({ disk, onClose, uid, allNodes, clusters }) {
    const [editMode, setEditMode] = useState(false);

    // Local state for editing
    const [local, setLocal] = useState({
        disk: disk.disk,
        model: disk.model,
        role: disk.role,
        cluster: disk.cluster,
        totalGB: (disk.total || 0) / 1_000_000_000
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    /* ---------------- Actions ---------------- */
    async function handleSave() {
        const newName = local.disk.trim();
        const newTotal = Number(local.totalGB) * 1_000_000_000;

        if (!newName) return setError("Disk name cannot be empty.");
        if (newTotal <= 0) return setError("Total size must be greater than 0.");

        // Resize Validation: Cannot shrink below current usage
        if (newTotal < disk.used) {
            return setError(`Cannot reduce size below current usage (${fmtBytes(disk.used)}). Deallocate nodes first.`);
        }

        setSaving(true);
        try {
            const batch = writeBatch(db);
            const diskRef = doc(db, "disks", disk.id);

            // Update Disk
            batch.update(diskRef, {
                disk: newName,
                model: local.model,
                role: local.role,
                cluster: local.cluster,
                total: newTotal,
                updatedAt: serverTimestamp()
            });

            // Rename logic if name changed
            if (newName !== disk.disk) {
                allNodes.forEach(n => {
                    if (n.allocations && n.allocations.some(a => a.disk === disk.disk)) {
                        const newAllocations = n.allocations.map(a => a.disk === disk.disk ? { ...a, disk: newName } : a);
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
        const linkedNodes = allNodes.filter(n => n.allocations?.some(a => a.disk === disk.disk));
        if (linkedNodes.length > 0) {
            setError(`Cannot delete. Disk is in use by ${linkedNodes.length} node(s). Details: ${linkedNodes.map(n => n.node).join(", ")}`);
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
            setError("Failed to delete.");
            setSaving(false);
        }
    }

    /* ---------------- UI ---------------- */
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#0D100D] rounded-2xl border border-white/10 w-full max-w-lg p-4 md:p-6 overflow-y-auto max-h-[90vh] shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-white/5 pb-4 md:pb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        {confirmDelete ? "Delete Disk?" : editMode ? "Edit Disk" : `Disk: ${disk.disk}`}
                    </h3>
                    <button
                        onClick={onClose}
                        className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        <XCircle size={14} weight="fill" className="text-white/60" />
                        Close
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4 md:space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            {error}
                        </div>
                    )}

                    {/* Disk Name */}
                    <Field label="Disk Name">
                        <input
                            type="text"
                            value={local.disk}
                            onChange={(e) => setLocal({ ...local, disk: e.target.value })}
                            disabled={!editMode}
                            className="input"
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Field label="Model">
                            <CustomSelect
                                value={local.model}
                                onChange={(v) => setLocal({ ...local, model: v })}
                                options={["SSD", "HDD", "NVME"]}
                                disabled={!editMode}
                            />
                        </Field>
                        <Field label="Role">
                            <CustomSelect
                                value={local.role}
                                onChange={(v) => setLocal({ ...local, role: v })}
                                options={["DATA", "OS", "BACKUP"]}
                                disabled={!editMode}
                            />
                        </Field>
                    </div>

                    {/* Cluster & Total Size */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Field label="Cluster">
                            <CustomSelect
                                value={local.cluster}
                                onChange={(v) => setLocal({ ...local, cluster: v })}
                                options={clusters.map(c => c.cluster)}
                                renderOption={(opt) => {
                                    const targetCluster = clusters.find(c => c.cluster === opt);
                                    return (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: targetCluster?.color || "#69639E" }}></div>
                                            <span>{opt}</span>
                                        </div>
                                    );
                                }}
                                disabled={!editMode}
                            />
                        </Field>
                        <Field label="Total Size (GB)">
                            <input
                                type="number"
                                value={local.totalGB}
                                onChange={(e) => setLocal({ ...local, totalGB: e.target.value })}
                                disabled={!editMode}
                                className="input font-mono"
                            />
                        </Field>
                    </div>

                    <Field label="Usage">
                        <div className="bg-[#161D22] rounded-xl p-3 border border-white/5 space-y-2">
                            <div className="flex justify-between text-xs font-mono text-white/70">
                                <span>{fmtBytes(disk.used)} / {fmtBytes(local.totalGB * 1_000_000_000)}</span>
                                <span>{Math.round((disk.used / (local.totalGB * 1_000_000_000)) * 100) || 0}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#69639E] to-[#A8C9AD]"
                                    style={{ width: `${Math.min(100, (disk.used / (local.totalGB * 1_000_000_000)) * 100 || 0)}%` }}
                                ></div>
                            </div>
                        </div>
                    </Field>

                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/5">
                    {confirmDelete ? (
                        <>
                            <button
                                onClick={() => { setConfirmDelete(false); setError(""); }}
                                className="px-3 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                                Confirm Delete
                            </button>
                        </>
                    ) : !editMode ? (
                        <>
                            <button
                                onClick={() => setEditMode(true)}
                                className="px-4 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs transition-all cursor-pointer"
                            >
                                Delete
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setEditMode(false);
                                    setLocal({
                                        disk: disk.disk,
                                        model: disk.model,
                                        role: disk.role,
                                        cluster: disk.cluster,
                                        totalGB: (disk.total || 0) / 1_000_000_000
                                    });
                                    setError("");
                                }}
                                className="px-3 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-white/70 mb-2 text-xs font-medium">{label}</div>
            {children}
        </div>
    );
}

function fmtBytes(bytes) {
    const b = Number(bytes || 0);
    const GB = 1_000_000_000;
    const TB = 1_000_000_000_000;
    if (b === 0) return "0 GB";
    if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
    if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
    return `${(b / TB).toFixed(1)} TB`;
}
