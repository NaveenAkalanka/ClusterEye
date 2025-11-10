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
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function NodeModal({ node, onClose, clusters, disks, uid }) {
  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState({ ...node });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPass, setShowPass] = useState(false);

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

  // Cluster change info / warning
  useEffect(() => {
    if (!editMode) return;
    if (!local.cluster) return;
    const cl = clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress) return;
    if (!isSameSubnet(local.ipAddress, cl.ipAddress)) {
      setInfo(
        `Cluster changed and IP subnet mismatch detected. Please update IP to match ${cl.ipAddress
          .split(".")
          .slice(0, 3)
          .join(".")}.x`
      );
    } else {
      setInfo("");
    }
  }, [local.cluster, editMode]);

  /* ----------------------- SAVE ----------------------- */
  async function handleSave() {
    setError("");
    setInfo("");

    if (!local.node?.trim()) return setError("Node name cannot be empty.");
    if (!local.cluster) return setError("Select a cluster.");
    if (!local.ipAddress || !isValidIP(local.ipAddress))
      return setError("Invalid IPv4 address format.");

    const cl = clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress)
      return setError("Selected cluster missing IP base address.");
    if (!isSameSubnet(local.ipAddress, cl.ipAddress))
      return setError(`IP not in same subnet as cluster (${cl.ipAddress}).`);

    // ✅ calculate total allocated bytes
    const totalAllocatedBytes = (local.allocations || []).reduce((sum, a) => {
      const gb = Number(a.allocatedGB) || 0;
      return sum + gb * 1_000_000_000;
    }, 0);

    // ✅ validate allocations (safe resizing)
    for (const a of local.allocations || []) {
      const d = disks.find((x) => x.disk === a.disk);
      if (!d) return setError(`Disk ${a.disk} no longer exists.`);
      const totalGB = (d.total || 0) / 1_000_000_000;
      const usedGB = (d.used || 0) / 1_000_000_000;
      const oldAlloc = (node.allocations || []).find((x) => x.disk === a.disk);
      const prevGB = oldAlloc ? Number(oldAlloc.allocatedGB) : 0;
      const availableGB = totalGB - usedGB + prevGB;
      if (Number(a.allocatedGB) > availableGB)
        return setError(
          `Disk ${a.disk} has only ${availableGB.toFixed(1)} GB available.`
        );
    }

    // ✅ update node
    const nodeRef = doc(db, "nodes", local.id);
    setSaving(true);
    try {
      await updateDoc(nodeRef, {
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
  async function handleDelete() {
    if (!window.confirm(`Delete node "${local.node}"? This cannot be undone.`))
      return;
    setError("");
    try {
      const nodeRef = doc(db, "nodes", local.id);
      await deleteDoc(nodeRef);
      const ipQuery = query(
        collection(db, "ipIndex"),
        where("userId", "==", uid),
        where("nodeId", "==", local.id)
      );
      const ipSnap = await getDocs(ipQuery);
      for (const s of ipSnap.docs) await deleteDoc(s.ref);
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
  const clusterLocked =
    editMode && local.allocations && local.allocations.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-xl p-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">
            {editMode ? "Edit Node" : `Node: ${local.node}`}
          </h3>
          <button
            onClick={onClose}
            className="px-2 py-1 bg-white/10 rounded-lg hover:bg-white/20"
          >
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

        <div className="space-y-3">
          <Field label="Node Name">
            <input
              disabled={!editMode}
              value={local.node}
              onChange={(e) => setLocal({ ...local, node: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Type">
            <select
              disabled={!editMode}
              value={local.type}
              onChange={(e) => setLocal({ ...local, type: e.target.value })}
              className="input"
            >
              <option value="LXC">LXC</option>
              <option value="VM">VM</option>
            </select>
          </Field>

          {/* Cluster – disabled when allocations exist */}
          <Field label="Cluster">
            <select
              disabled={!editMode || clusterLocked}
              value={local.cluster}
              onChange={(e) => setLocal({ ...local, cluster: e.target.value })}
              className={`input ${
                clusterLocked ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.cluster}>
                  {c.cluster}
                </option>
              ))}
            </select>
            {clusterLocked && (
              <div className="text-xs text-yellow-300 mt-1">
                ⚠️ Remove all disk allocations before changing cluster.
              </div>
            )}
          </Field>

          <Field label="IP Address">
            <input
              disabled={!editMode}
              value={local.ipAddress}
              onChange={(e) => setLocal({ ...local, ipAddress: e.target.value })}
              className="input"
            />
          </Field>

          <hr className="border-white/10" />

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
                onChange={(e) => setLocal({ ...local, password: e.target.value })}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>

          <Field label="Link">
            <input
              disabled={!editMode}
              value={local.link || ""}
              onChange={(e) => setLocal({ ...local, link: e.target.value })}
              className="input"
            />
          </Field>

          <hr className="border-white/10" />

          {/* Allocations */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-white/80 font-medium">Allocations</div>
              {editMode && (
                <button
                  onClick={addAlloc}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500"
                >
                  + Add
                </button>
              )}
            </div>

            {(!local.allocations || local.allocations.length === 0) && (
              <div className="text-white/60">No allocations.</div>
            )}

            {local.allocations?.map((a, i) => {
              const filteredDisks = clusterDisks;
              return (
                <div key={i} className="flex flex-wrap gap-2 items-center mt-1">
                  <select
                    disabled={!editMode}
                    value={a.disk}
                    onChange={(e) => changeAlloc(i, "disk", e.target.value)}
                    className="input"
                  >
                    <option value="">Select disk</option>
                    {filteredDisks.map((d) => {
                      const freeGB = (d.free || 0) / 1_000_000_000;
                      return (
                        <option key={d.id} value={d.disk}>
                          {d.disk} ({freeGB.toFixed(1)} GB free)
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    disabled={!editMode}
                    value={a.allocatedGB}
                    onChange={(e) =>
                      changeAlloc(i, "allocatedGB", Number(e.target.value))
                    }
                    className="w-32 input"
                  />
                  {editMode && (
                    <button
                      onClick={() => removeAlloc(i)}
                      className="px-3 py-2 rounded-lg bg-red-600/70 hover:bg-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------- UI Helper ----------------------- */
function Field({ label, children }) {
  return (
    <div>
      <div className="text-white/70 mb-1">{label}</div>
      {children}
    </div>
  );
}
