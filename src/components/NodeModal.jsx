// src/components/NodeModal.jsx
import { useState, useEffect, useMemo } from "react";
import {
  doc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ArrowSquareOut, XCircle, Warning } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";
import { isIpInSubnet } from "../utils/network";
import useDialogFocus from "./useDialogFocus";

export default function NodeModal({ node, onClose, clusters, disks, containers, uid }) {
  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState({ ...node });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [clusterLocked, setClusterLocked] = useState(false);
  const [showLockWarning, setShowLockWarning] = useState(false);
  const { dialogRef, onDialogKeyDown } = useDialogFocus(
    () => confirmDiscard ? setConfirmDiscard(false) : handleCloseRequest(),
    true,
    confirmDiscard
  );

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
      ? disks.filter((d) => local.clusterId && d.clusterId ? d.clusterId === local.clusterId : d.cluster === local.cluster)
      : [];
  }, [disks, local.cluster, local.clusterId]);

  // IP validation
  function isValidIP(ip) {
    return (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)
    );
  }

  // Subnet warning when editing
  useEffect(() => {
    if (!editMode) return;
    if (!local.cluster) return;
    const cl = clusters.find((c) => c.id === local.clusterId) || clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress) return;
    if (!isIpInSubnet(local.ipAddress, cl.ipAddress, cl.subnetMask || "255.255.255.0")) {
      setInfo(
        `IP must be in the cluster subnet (${cl.ipAddress}, mask ${cl.subnetMask || "255.255.255.0"}).`
      );
    } else {
      setInfo("");
    }
  }, [local.cluster, local.clusterId, local.ipAddress, editMode, clusters]);

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

    const cl = clusters.find((c) => c.id === local.clusterId) || clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress)
      return setError("Selected cluster missing IP base address.");
    if (!isIpInSubnet(local.ipAddress, cl.ipAddress, cl.subnetMask || "255.255.255.0"))
      return setError(`IP must be in the cluster subnet (${cl.ipAddress}, mask ${cl.subnetMask || "255.255.255.0"}).`);

    // calculate total allocated
    const totalAllocatedBytes = (local.allocations || []).reduce((sum, a) => {
      const gb = Number(a.allocatedGB) || 0;
      return sum + gb * 1_000_000_000;
    }, 0);

    // validate allocations vs available
    for (const a of local.allocations || []) {
      const d = disks.find((x) => x.id === a.diskId) || disks.find((x) => x.disk === a.disk);
      if (!d) return setError(`Disk ${a.disk} no longer exists.`);
      if (Number(a.allocatedGB) <= 0 || !Number.isFinite(Number(a.allocatedGB))) return setError("Allocation must be greater than zero.");
      if ((local.allocations || []).filter((item) => (item.diskId || item.disk) === (a.diskId || a.disk)).length > 1) return setError("Choose each disk only once.");
      const oldAlloc = (node.allocations || []).find((x) => x.diskId ? x.diskId === d.id : x.disk === d.disk);
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
      const nextAllocations = (local.allocations || []).map((a) => {
        const selectedDisk = disks.find((d) => d.id === a.diskId) || disks.find((d) => d.disk === a.disk);
        return { diskId: selectedDisk.id, disk: selectedDisk.disk, allocatedGB: Number(a.allocatedGB) };
      });
      const linked = local.nodeId.trim() !== node.nodeId
        ? (containers || []).filter((item) => item.nodeRefId ? item.nodeRefId === node.id : item.nodeId === node.nodeId)
        : [];
      if (linked.length + nextAllocations.length > 450) throw new Error("Too many linked records to rename in one operation.");

      await runTransaction(db, async (transaction) => {
        const currentSnap = await transaction.get(nodeRef);
        const current = currentSnap.data();
        if (!current || current.userId !== uid) throw new Error("Node no longer exists.");
        if (JSON.stringify(current.allocations || []) !== JSON.stringify(node.allocations || [])) {
          throw new Error("Node allocations changed elsewhere. Close and reopen this node.");
        }
        const deltas = new Map();
        const addDelta = (allocation, direction) => {
          const disk = disks.find((item) => item.id === allocation.diskId) || disks.find((item) => item.disk === allocation.disk);
          if (!disk) throw new Error(`Disk ${allocation.disk} no longer exists.`);
          const amount = Number(allocation.allocatedGB) * 1_000_000_000 * direction;
          deltas.set(disk.id, (deltas.get(disk.id) || 0) + amount);
        };
        (current.allocations || []).forEach((a) => addDelta(a, -1));
        nextAllocations.forEach((a) => addDelta(a, 1));
        const diskEntries = [...deltas.entries()].map(([id, delta]) => ({ ref: doc(db, "disks", id), delta }));
        const diskSnaps = await Promise.all(diskEntries.map(({ ref }) => transaction.get(ref)));

        diskEntries.forEach(({ ref, delta }, index) => {
          const data = diskSnaps[index].data();
          if (!data || data.userId !== uid) throw new Error("An allocated disk is no longer available.");
          const used = Number(data.used || 0) + delta;
          if (used < 0 || used > Number(data.total || 0)) throw new Error(`${data.disk} has insufficient capacity or invalid usage.`);
          transaction.update(ref, { used, free: Number(data.total) - used });
        });

        transaction.update(nodeRef, {
        nodeId: local.nodeId.trim(),
        node: local.node.trim(),
        type: local.type,
        cluster: local.cluster,
        clusterId: cl.id,
        ipAddress: local.ipAddress.trim(),
        username: local.username || "",
        link: local.link || "",
        allocations: nextAllocations,
        allocated: totalAllocatedBytes,
        updatedAt: serverTimestamp(),
        });
        linked.forEach((item) => transaction.update(doc(db, "containers", item.id), { nodeId: local.nodeId.trim(), nodeRefId: node.id }));
      });

      setEditMode(false);
      setInfo("✅ Node updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update node.");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------- DELETE ----------------------- */
  function handleDelete() {
    // Check for linked containers
    const linkedContainers = (containers || []).filter(c => c.nodeRefId ? c.nodeRefId === node.id : c.nodeId === node.nodeId);
    if (linkedContainers.length > 0) {
      setError(`Cannot delete node. It has ${linkedContainers.length} active container(s).`);
      return;
    }
    setConfirmDelete(true);
  }

  async function executeDelete() {
    setError("");
    setSaving(true);
    try {
      const nodeRef = doc(db, "nodes", local.id);
      await runTransaction(db, async (transaction) => {
        const currentSnap = await transaction.get(nodeRef);
        const current = currentSnap.data();
        if (!current || current.userId !== uid) throw new Error("Node no longer exists.");
        const deltas = new Map();
        for (const a of current.allocations || []) {
          const disk = disks.find((item) => item.id === a.diskId) || disks.find((item) => item.disk === a.disk);
          if (!disk) throw new Error(`Disk ${a.disk} no longer exists.`);
          deltas.set(disk.id, (deltas.get(disk.id) || 0) + Number(a.allocatedGB) * 1_000_000_000);
        }
        const entries = [...deltas.entries()].map(([id, bytes]) => ({ ref: doc(db, "disks", id), bytes }));
        const diskSnaps = await Promise.all(entries.map(({ ref }) => transaction.get(ref)));
        entries.forEach(({ ref, bytes }, index) => {
          const data = diskSnaps[index].data();
          if (!data || data.userId !== uid) throw new Error("An allocated disk is no longer available.");
          const used = Number(data.used || 0) - bytes;
          if (used < 0) throw new Error(`${data.disk} has invalid usage.`);
          transaction.update(ref, { used, free: Number(data.total) - used });
        });
        transaction.delete(nodeRef);
      });

      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Delete failed.");
    } finally {
      setSaving(false);
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
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Node ${node.node}`} tabIndex={-1} onKeyDown={onDialogKeyDown} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D100D] rounded-2xl border border-white/10 w-full max-w-lg p-4 md:p-6 overflow-y-auto max-h-[90dvh] custom-scrollbar shadow-2xl">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
                        const upd = { ...local, cluster: val, clusterId: clusters.find((c) => c.cluster === val)?.id || "" };
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

              <div>
                <Field label="Username">
                  <input
                    disabled={!editMode}
                    value={local.username || ""}
                    onChange={(e) => setLocal({ ...local, username: e.target.value })}
                    className="input"
                  />
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
                      aria-label="Open node link"
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
                        value={a.diskId || clusterDisks.find((d) => d.disk === a.disk)?.id || ""}
                        onChange={(val) => {
                          const selected = clusterDisks.find((d) => d.id === val);
                          setLocal((prev) => ({
                            ...prev,
                            allocations: prev.allocations.map((item, index) => index === i ? { ...item, diskId: val, disk: selected?.disk || "" } : item),
                          }));
                        }}
                        options={clusterDisks.map((d) => {
                          const freeGB =
                            ((d.total || 0) - (d.used || 0)) / 1_000_000_000;
                          return {
                            value: d.id,
                            label: d.disk,
                            subLabel: `${freeGB.toFixed(1)} GB free`,
                          };
                        })}
                        placeholder="Select disk"
                        disabled={!editMode}
                      />
                    </div>
                    <div className="w-full sm:w-32">
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
                        className="w-full sm:w-auto px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
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
