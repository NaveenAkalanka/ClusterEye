// src/components/NodeModal.jsx
import { useState, useEffect, useMemo } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Eye, EyeSlash, ArrowSquareOut, XCircle, Warning } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";

export default function NodeModal({ node, onClose, clusters, disks, containers, uid }) {
  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState({ ...node });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [clusterLocked, setClusterLocked] = useState(false);
  const [showLockWarning, setShowLockWarning] = useState(false);

  // Check for unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(local) !== JSON.stringify(node);
  }, [local, node]);

  // Handle Close (Discard Check)
  function handleCloseRequest() {
    if (editMode && isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  }

  // Filter disks based on cluster
  const clusterDisks = useMemo(() => {
    return Array.isArray(disks)
      ? disks.filter((d) => d.cluster === local.cluster)
      : [];
  }, [disks, local.cluster]);

  // IP validation
  function isValidIP(ip) {
    return (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)
    );
  }

  function isSameSubnet(nodeIP, clusterIP) {
    if (!nodeIP || !clusterIP) return false;
    const a = nodeIP.split(".").slice(0, 3).join(".");
    const b = clusterIP.split(".").slice(0, 3).join(".");
    return a === b;
  }

  // Subnet warning when editing
  useEffect(() => {
    if (!editMode) return;
    if (!local.cluster) return;
    const cl = clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress) return;
    if (!isSameSubnet(local.ipAddress, cl.ipAddress)) {
      setInfo(
        `Cluster and IP subnet mismatch. IP should match ${cl.ipAddress
          .split(".")
          .slice(0, 3)
          .join(".")}.x`
      );
    } else {
      setInfo("");
    }
  }, [local.cluster, local.ipAddress, editMode]);

  // Lock cluster if allocations exist
  useEffect(() => {
    if ((local.allocations || []).length > 0) {
      setClusterLocked(true);
    } else {
      setClusterLocked(false);
    }
  }, [local.allocations]);

  /* ----------------------- SAVE ----------------------- */
  async function handleSave() {
    setError("");
    setInfo("");

    // mandatory validations
    if (!local.nodeId?.trim()) return setError("Node ID is required.");
    if (!local.node?.trim()) return setError("Node name is required.");
    if (!local.cluster) return setError("Select a cluster.");
    if (!local.ipAddress || !isValidIP(local.ipAddress))
      return setError("Invalid IPv4 address format.");
    if (!local.allocations || local.allocations.length === 0)
      return setError("At least one disk allocation is required.");

    // DUPLICATE CHECKS (Targeted Queries)
    try {
      const nodesRef = collection(db, "nodes");

      // 1. Check/Validate Node ID
      if (local.nodeId.length > 50) return setError("Node ID too long (max 50 chars).");
      if (!/^[a-zA-Z0-9-_]+$/.test(local.nodeId)) return setError("Node ID can only contain letters, numbers, hyphens, and underscores.");

      const idQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("nodeId", "==", local.nodeId)
      );
      const idSnap = await getDocs(idQuery);
      // Filter out self if found
      if (idSnap.docs.some(d => d.id !== local.id)) {
        return setError("This Node ID is already taken.");
      }

      // 2. Check Node Name
      if (local.node.length > 50) return setError("Node Name too long (max 50 chars).");

      const nameQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("node", "==", local.node)
      );
      const nameSnap = await getDocs(nameQuery);
      if (nameSnap.docs.some(d => d.id !== local.id)) {
        return setError("Node Name is already taken.");
      }

      // 3. Check IP Address
      const ipQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("ipAddress", "==", local.ipAddress)
      );
      const ipSnap = await getDocs(ipQuery);
      if (ipSnap.docs.some(d => d.id !== local.id)) {
        return setError("IP Address is already assigned to another node.");
      }

    } catch (err) {
      console.error(err);
      return setError("Failed to validate node data. Check connection."); // Stop execution on error
    }

    // Check cluster overlap
    const clusterCollision = clusters.some(c => c.ipAddress === local.ipAddress.trim());
    if (clusterCollision) return setError("IP Address matches a Cluster IP.");

    const cl = clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress)
      return setError("Selected cluster missing IP base address.");
    if (!isSameSubnet(local.ipAddress, cl.ipAddress))
      return setError(`IP not in same subnet as cluster (${cl.ipAddress}).`);

    // calculate total allocated
    const totalAllocatedBytes = (local.allocations || []).reduce((sum, a) => {
      const gb = Number(a.allocatedGB) || 0;
      return sum + gb * 1_000_000_000;
    }, 0);

    // validate allocations vs available
    for (const a of local.allocations || []) {
      const d = disks.find((x) => x.disk === a.disk);
      if (!d) return setError(`Disk ${a.disk} no longer exists.`);
      const totalGB = (d.total || 0) / 1_000_000_000;
      const usedGB = (d.used || 0) / 1_000_000_000;
      const oldAlloc = (node.allocations || []).find((x) => x.disk === a.disk);
      const prevGB = oldAlloc ? Number(oldAlloc.allocatedGB) : 0;
      const availableGB = (d.total || 0) / 1_000_000_000 - (d.used || 0) / 1_000_000_000 + prevGB;
      if (Number(a.allocatedGB) > availableGB)
        return setError(
          `Disk ${a.disk} has only ${availableGB.toFixed(1)} GB available.`
        );
    }

    // update Firestore
    const nodeRef = doc(db, "nodes", local.id);
    setSaving(true);
    try {
      const batch = writeBatch(db);

      // Update Node Doc
      batch.update(nodeRef, {
        nodeId: local.nodeId.trim(),
        node: local.node.trim(),
        type: local.type,
        cluster: local.cluster,
        ipAddress: local.ipAddress.trim(),
        username: local.username || "",
        password: local.password || "",
        link: local.link || "",
        allocations: local.allocations || [],
        allocated: totalAllocatedBytes,
        updatedAt: serverTimestamp(),
      });

      // Update Disk Usage
      // 1. Revert old allocations
      for (const oldA of (node.allocations || [])) {
        const diskObj = disks.find(d => d.disk === oldA.disk);
        if (diskObj) {
          const diskRef = doc(db, "disks", diskObj.id);
          const bytesToRemove = (Number(oldA.allocatedGB) || 0) * 1_000_000_000;
          // Decrement by adding negative value
          batch.update(diskRef, { used: increment(-bytesToRemove) });
        }
      }

      // 2. Apply new allocations
      for (const newA of (local.allocations || [])) {
        const diskObj = disks.find(d => d.disk === newA.disk);
        if (diskObj) {
          const diskRef = doc(db, "disks", diskObj.id);
          const bytesToAdd = (Number(newA.allocatedGB) || 0) * 1_000_000_000;
          batch.update(diskRef, { used: increment(bytesToAdd) });
        }
      }

      await batch.commit();

      setEditMode(false);
      setInfo("✅ Node updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to update node.");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------- DELETE ----------------------- */
  function handleDelete() {
    // Check for linked containers
    const linkedContainers = (containers || []).filter(c => c.nodeId === node.nodeId);
    if (linkedContainers.length > 0) {
      setError(`Cannot delete node. It has ${linkedContainers.length} active container(s).`);
      return;
    }
    setConfirmDelete(true);
  }

  async function executeDelete() {
    setError("");
    try {
      const batch = writeBatch(db);

      // 1. Delete Node
      const nodeRef = doc(db, "nodes", local.id);
      batch.delete(nodeRef);

      // 2. Decrement Disk Usage (Use 'node' not 'local' to ensure we revert persisted state)
      for (const a of (node.allocations || [])) {
        const diskObj = disks.find(d => d.disk === a.disk);
        if (diskObj) {
          const diskRef = doc(db, "disks", diskObj.id);
          const bytesToRemove = (Number(a.allocatedGB) || 0) * 1_000_000_000;
          batch.update(diskRef, { used: increment(-bytesToRemove) });
        }
      }

      // 3. Delete IP Index docs
      const ipQuery = query(
        collection(db, "ipIndex"),
        where("userId", "==", uid),
        where("nodeId", "==", local.id)
      );
      const ipSnap = await getDocs(ipQuery);
      for (const s of ipSnap.docs) {
        batch.delete(s.ref);
      }

      await batch.commit();

      onClose();
    } catch (err) {
      console.error(err);
      setError("Delete failed.");
    }
  }

  /* ----------------------- Allocation Helpers ----------------------- */
  function changeAlloc(i, field, value) {
    setLocal((prev) => {
      const arr = [...(prev.allocations || [])];
      arr[i] = { ...arr[i], [field]: value };
      return { ...prev, allocations: arr };
    });
  }

  function addAlloc() {
    setLocal((prev) => ({
      ...prev,
      allocations: [...(prev.allocations || []), { disk: "", allocatedGB: 0 }],
    }));
  }

  function removeAlloc(i) {
    setLocal((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, idx) => idx !== i),
    }));
  }

  /* ----------------------- RENDER ----------------------- */
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D100D] rounded-2xl border border-white/10 w-full max-w-lg p-4 md:p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-white/5 pb-4 md:pb-6">
          <h3 className="text-lg font-semibold">
            {confirmDelete
              ? "Delete Node?"
              : editMode
                ? "Edit Node"
                : `Node: ${local.node}`}
          </h3>
          <button
            onClick={handleCloseRequest}
            className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <XCircle size={14} weight="fill" className="text-white/60" />
            Close
          </button>
        </div>

        {info && (
          <div className="bg-blue-600/20 text-blue-200 border border-blue-600/30 rounded-lg px-3 py-2 mb-3">
            {info}
          </div>
        )}
        {error && (
          <div className="bg-red-600/20 text-red-200 border border-red-600/30 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="space-y-4 md:space-y-5">
          {!confirmDelete && !confirmDiscard ? (
            // Wrap form content
            <div className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <Field label="Node ID">
                  <input
                    disabled={!editMode}
                    value={local.nodeId || ""}
                    onChange={(e) => setLocal({ ...local, nodeId: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Node Name">
                  <input
                    disabled={!editMode}
                    value={local.node}
                    onChange={(e) => setLocal({ ...local, node: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <Field label="Type">
                  <CustomSelect
                    value={local.type}
                    onChange={(val) => setLocal({ ...local, type: val })}
                    options={["LXC", "VM"]}
                    placeholder="LXC"
                    disabled={!editMode}
                  />
                </Field>

                <Field label="Cluster">
                  <div
                    onClickCapture={() => {
                      if (clusterLocked && editMode) {
                        setShowLockWarning(true);
                      }
                    }}
                  >
                    <CustomSelect
                      value={local.cluster}
                      onChange={(val) => {
                        const upd = { ...local, cluster: val };
                        // Autofill IP
                        const cObj = clusters.find((c) => c.cluster === val);
                        if (cObj && cObj.ipAddress) {
                          const prefix =
                            cObj.ipAddress.split(".").slice(0, 3).join(".") + ".";
                          upd.ipAddress = prefix;
                        }
                        setLocal(upd);
                      }}
                      options={clusters.map((c) => c.cluster)}
                      placeholder="Select Cluster"
                      disabled={!editMode || clusterLocked}
                    />
                  </div>
                  {clusterLocked && showLockWarning && (
                    <div className="text-xs text-yellow-300 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      ⚠️ Remove all disk allocations before changing cluster.
                    </div>
                  )}
                </Field>
              </div>

              <Field label="IP Address">
                <input
                  disabled={!editMode}
                  value={local.ipAddress}
                  onChange={(e) => setLocal({ ...local, ipAddress: e.target.value })}
                  className="input"
                />
              </Field>

              <hr className="border-white/10" />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Username">
                  <input
                    disabled={!editMode}
                    value={local.username || ""}
                    onChange={(e) => setLocal({ ...local, username: e.target.value })}
                    className="input"
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      disabled={!editMode}
                      value={local.password || ""}
                      onChange={(e) =>
                        setLocal({ ...local, password: e.target.value })
                      }
                      className="input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPass ? <EyeSlash size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </Field>
              </div>

              <Field label="Link">
                <div className="relative">
                  <input
                    disabled={!editMode}
                    value={local.link || ""}
                    onChange={(e) => setLocal({ ...local, link: e.target.value })}
                    className="input pr-10"
                  />
                  {local.link && (
                    <button
                      type="button"
                      onClick={() => {
                        let url = local.link;
                        if (!/^https?:\/\//i.test(url)) {
                          url = "http://" + url;
                        }
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors cursor-pointer"
                      title="Open in new tab"
                    >
                      <ArrowSquareOut size={20} />
                    </button>
                  )}
                </div>
              </Field>

              <hr className="border-white/10" />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-white/80 font-medium text-sm">Allocations</div>
                  {editMode && (
                    <button
                      onClick={addAlloc}
                      className="px-3 py-1 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>

                {(!local.allocations || local.allocations.length === 0) && (
                  <div className="text-white/60">No allocations.</div>
                )}

                {local.allocations?.map((a, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center mt-1">
                    <div className="flex-1 min-w-[200px]">
                      <CustomSelect
                        value={a.disk}
                        onChange={(val) => changeAlloc(i, "disk", val)}
                        options={clusterDisks.map((d) => {
                          const freeGB =
                            ((d.total || 0) - (d.used || 0)) / 1_000_000_000;
                          return {
                            value: d.disk,
                            label: d.disk,
                            subLabel: `${freeGB.toFixed(1)} GB free`,
                          };
                        })}
                        placeholder="Select disk"
                        disabled={!editMode}
                      />
                    </div>
                    <div className="w-32">
                      <NumberStepper
                        value={a.allocatedGB}
                        onChange={(val) => changeAlloc(i, "allocatedGB", val)}
                        min={0}
                        className={!editMode ? "pointer-events-none opacity-50 border-none bg-transparent" : ""}
                      />
                    </div>
                    {editMode && (
                      <button
                        onClick={() => removeAlloc(i)}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : confirmDiscard ? (
            <div className="text-center py-6 animate-in zoom-in-95 duration-200">
              <Warning size={48} className="mx-auto text-yellow-400 mb-4" weight="duotone" />
              <h3 className="text-xl font-bold text-white mb-2">Discard Changes?</h3>
              <p className="text-white/60 text-sm mb-6 max-w-xs mx-auto">
                You have unsaved changes. Are you sure you want to discard them?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setConfirmDiscard(false)}
                  className="px-5 py-2 rounded-xl bg-[#161D22] text-white/70 hover:text-white hover:bg-[#1c252b] font-medium transition-all cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 font-bold transition-all shadow-lg shadow-yellow-500/5 cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            /* ---------------- Confirmation View ---------------- */
            <div className="space-y-4 py-4">
              <div className="text-white/80">
                Are you sure you want to delete <span className="font-bold text-white">{local.node}</span>?
                <br />
                This action cannot be undone.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-5">
            {confirmDelete ? (
              <>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
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
                  onClick={() => setEditMode(false)}
                  className="px-3 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- UI Helper ----------------------- */
function Field({ label, children }) {
  return (
    <div>
      <div className="text-white/70 mb-2 text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}
