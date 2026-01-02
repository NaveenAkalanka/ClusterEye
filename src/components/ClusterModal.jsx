import { useState, useEffect } from "react";
import { XCircle, Warning, Eye, EyeSlash } from "@phosphor-icons/react";
import { doc, updateDoc, deleteDoc, writeBatch, collection, query, where, getDocs, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { isValidSubnetMask } from "../utils/network";

export default function ClusterModal({ cluster, onClose, uid, allClusters = [], allNodes = [], disks = [] }) {
    // Local state for editing
    const [editMode, setEditMode] = useState(false);
    const [localName, setLocalName] = useState(cluster.cluster);
    const [localIp, setLocalIp] = useState(cluster.ipAddress || "");
    const [localSubnet, setLocalSubnet] = useState(cluster.subnetMask || "255.255.255.0");
    const [localColor, setLocalColor] = useState(cluster.color || "#69639E");

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    // Delete state
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    // Check dirty
    const isDirty = localName !== cluster.cluster || localIp !== (cluster.ipAddress || "") || localSubnet !== (cluster.subnetMask || "255.255.255.0") || localColor !== (cluster.color || "#69639E");

    function handleCloseRequest() {
        if (editMode && isDirty) {
            setConfirmDiscard(true);
        } else {
            onClose();
        }
    }

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
                    batch.update(doc(db, "nodes", d.id), { cluster: localName.trim() });
                });

                const qDisks = query(collection(db, "disks"), where("userId", "==", uid), where("cluster", "==", cluster.cluster));
                const snapDisks = await getDocs(qDisks);
                snapDisks.forEach(d => {
                    batch.update(doc(db, "disks", d.id), { cluster: localName.trim() });
                });
            }

            await batch.commit();
            setEditMode(false);
        } catch (err) {
            console.error(err);
            setError("Update failed.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------------- DELETE ---------------- */
    async function handleDelete() {
        if (deleteConfirmText !== cluster.cluster) {
            return setError(`Type "${cluster.cluster}" to confirm.`);
        }

        // CHECK DEPENDENCIES
        const hasNodes = allNodes.some(n => n.cluster === cluster.cluster);
        if (hasNodes) {
            return setError("Cannot delete: Cluster has associated nodes. Delete nodes first.");
        }
        const hasDisks = disks.some(d => d.cluster === cluster.cluster);
        if (hasDisks) {
            return setError("Cannot delete: Cluster has associated disks. Delete disks first.");
        }

        setSaving(true);
        try {
            await deleteDoc(doc(db, "clusters", cluster.id));
            onClose(); // Close modal on success
        } catch (err) {
            console.error(err);
            setError("Delete failed.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------------- UI ---------------- */

    if (confirmDiscard) {
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                <div className="bg-[#161D22] border border-white/10 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
                    <h3 className="text-white font-semibold text-lg mb-2">Unsaved Changes</h3>
                    <p className="text-white/60 text-sm mb-6">You have unsaved edits. Are you sure you want to discard them?</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setConfirmDiscard(false)}
                            className="px-4 py-2 rounded-xl bg-[#0D100D] text-white hover:bg-white/5 transition-all text-xs font-bold cursor-pointer"
                        >
                            Keep Editing
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all text-xs font-bold cursor-pointer border border-yellow-500/20"
                        >
                            Discard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-4 md:p-6 w-full max-w-lg shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-lg font-semibold text-white">
                        {editMode ? "Edit Cluster" : "Cluster Details"}
                    </h3>
                    <button
                        onClick={handleCloseRequest}
                        className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        <XCircle size={14} weight="fill" className="text-white/60" />
                        Close
                    </button>
                </div>

                {/* Content */}
                {!confirmDelete ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-white/70 mb-2 text-xs font-medium">Cluster Name</div>
                                {editMode ? (
                                    <input
                                        value={localName}
                                        onChange={e => setLocalName(e.target.value)}
                                        className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all"
                                        maxLength={50}
                                    />
                                ) : (
                                    <div className="text-white font-medium text-lg truncate">{cluster.cluster}</div>
                                )}
                            </div>
                            <div>
                                <div className="text-white/70 mb-2 text-xs font-medium">IP Address</div>
                                {editMode ? (
                                    <input
                                        value={localIp}
                                        onChange={e => setLocalIp(e.target.value)}
                                        className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all"
                                    />
                                ) : (
                                    <div className="text-white/80 font-mono text-base">{cluster.ipAddress || "—"}</div>
                                )}
                            </div>
                            <div>
                                <div className="text-white/70 mb-2 text-xs font-medium">Subnet Mask</div>
                                {editMode ? (
                                    <input
                                        value={localSubnet}
                                        onChange={e => setLocalSubnet(e.target.value)}
                                        className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all"
                                    />
                                ) : (
                                    <div className="text-white/80 font-mono text-base">{cluster.subnetMask || "255.255.255.0"}</div>
                                )}
                            </div>
                        </div>

                        {/* Color Picker (Edit Mode) or Display (View Mode) */}
                        <div>
                            <div className="text-white/70 mb-2 text-xs font-medium">Cluster Color</div>
                            {editMode ? (
                                <div className="w-full h-12 flex rounded-xl overflow-hidden border border-white/10 shadow-inner">
                                    {[
                                        "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
                                        "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
                                        "#F43F5E", "#64748B", "#78716C", "#69639E"
                                    ].map((color) => (
                                        <div
                                            key={color}
                                            onClick={() => setLocalColor(color)}
                                            className={`flex-1 h-full cursor-pointer transition-all hover:brightness-110 active:brightness-90 ${localColor === color ? "ring-2 ring-white z-10 relative shadow-lg scale-110" : ""}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        ></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full shadow-md" style={{ backgroundColor: cluster.color || "#69639E" }}></div>
                                    <span className="text-white/60 text-xs">Theme Color</span>
                                </div>
                            )}
                        </div>

                        {/* Read Only Stats */}
                        {!editMode && (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl bg-[#161D22] border border-white/5 text-center">
                                    <div className="text-white/50 text-[10px] uppercase font-bold tracking-wider mb-1">Nodes</div>
                                    <div className="text-white text-xl font-bold">{cluster.nodes || 0}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-[#161D22] border border-white/5 text-center">
                                    <div className="text-white/50 text-[10px] uppercase font-bold tracking-wider mb-1">Disks</div>
                                    <div className="text-white text-xl font-bold">{cluster.disks || 0}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-[#161D22] border border-white/5 text-center">
                                    <div className="text-white/50 text-[10px] uppercase font-bold tracking-wider mb-1">Storage</div>
                                    <div className="text-white text-xl font-bold">{(cluster.total / 1000000000).toFixed(0)} GB</div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 text-red-200 border border-red-500/20 rounded-lg px-3 py-2 text-xs">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-white/5 mt-4">
                            {editMode ? (
                                <>
                                    <button
                                        onClick={() => setEditMode(false)}
                                        disabled={saving}
                                        className="px-4 py-2 rounded-lg bg-[#161D22] text-white hover:bg-[#1c252b] text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white hover:opacity-90 text-xs font-bold transition-all cursor-pointer shadow-md"
                                    >
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="px-4 py-2 rounded-lg bg-[#161D22] text-white hover:bg-[#1c252b] text-xs font-bold transition-all cursor-pointer shadow-sm border border-white/5"
                                    >
                                        Edit Cluster
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 text-center py-4">
                        <Warning size={48} className="text-red-500 mx-auto opacity-80" weight="fill" />
                        <h3 className="text-white font-bold text-lg">Delete Cluster?</h3>
                        <p className="text-white/60 text-sm max-w-xs mx-auto">
                            This will permanetly delete the cluster <b>{cluster.cluster}</b>. This action cannot be undone. Ensure it is empty first.
                        </p>

                        <input
                            type="text"
                            placeholder={`Type "${cluster.cluster}" to confirm`}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="w-full max-w-xs mx-auto h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-red-500/50 transition-all text-center"
                        />

                        {error && (
                            <div className="bg-red-500/10 text-red-200 border border-red-500/20 rounded-lg px-3 py-2 text-xs max-w-xs mx-auto">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-center gap-3 pt-4">
                            <button
                                onClick={() => { setConfirmDelete(false); setError(""); setDeleteConfirmText(""); }}
                                className="px-5 py-2 rounded-xl bg-[#161D22] text-white hover:bg-[#1c252b] text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/20 cursor-pointer"
                            >
                                {saving ? "Deleting..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
