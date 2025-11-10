// src/pages/Disks.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDocs,
  writeBatch,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";

export default function Disks() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // form
  const [disk, setDisk] = useState("");
  const [model, setModel] = useState("SSD");
  const [role, setRole] = useState("DATA");
  const [cluster, setCluster] = useState("");
  const [totalGB, setTotalGB] = useState("");

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);

  // modals
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delStats, setDelStats] = useState({ nodes: 0 });

  /* ----------------------------- AUTH ----------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  /* ----------------------------- LOAD DATA ----------------------------- */
  useEffect(() => {
    if (!uid) {
      setClusters([]);
      setDisks([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubClusters = onSnapshot(
      query(collection(db, "clusters"), where("userId", "==", uid), orderBy("cluster")),
      (snap) => setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubDisks = onSnapshot(
      query(collection(db, "disks"), where("userId", "==", uid), orderBy("disk")),
      (snap) => {
        setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load disks.");
        setLoading(false);
      }
    );

    return () => {
      unsubClusters();
      unsubDisks();
    };
  }, [uid]);

  /* ----------------------------- CREATE ----------------------------- */
  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!uid) return setError("You must be signed in.");

    const name = disk.trim();
    const cl = cluster.trim();
    const gb = Number(totalGB);

    if (!name) return setError("Enter a disk name.");
    if (!cl) return setError("Choose a cluster.");
    if (!Number.isFinite(gb) || gb <= 0) return setError("Enter a valid total size in GB.");

    const totalBytes = Math.round(gb * 1_000_000_000);
    setSaving(true);
    try {
      await addDoc(collection(db, "disks"), {
        userId: uid,
        disk: name,
        model,
        role,
        cluster: cl,
        total: totalBytes,
        used: 0,
        free: totalBytes,
        nodes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDisk("");
      setModel("SSD");
      setRole("DATA");
      setCluster("");
      setTotalGB("");
    } catch (err) {
      console.error(err);
      setError("Could not create disk.");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------------- EDIT ----------------------------- */
  function openEdit(d) {
    setEditTarget(d);
    setEditName(d.disk);
    setEditOpen(true);
  }

  async function handleRename() {
    if (!uid || !editTarget) return;
    const newName = editName.trim();
    if (!newName) return setError("Disk name cannot be empty.");

    // prevent duplicate
    const exists = disks
      .filter((d) => d.id !== editTarget.id)
      .some((d) => d.disk.toLowerCase() === newName.toLowerCase());
    if (exists) return setError(`Disk "${newName}" already exists.`);

    try {
      const batch = writeBatch(db);

      // update disk
      const diskRef = doc(db, "disks", editTarget.id);
      batch.update(diskRef, { disk: newName, updatedAt: serverTimestamp() });

      await batch.commit();
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      setError("Rename failed.");
    }
  }

  /* ----------------------------- DELETE ----------------------------- */
  async function openDelete(d) {
    setDelTarget(d);
    setError("");
    if (!uid) return;

    const qNodes = query(collection(db, "nodes"), where("userId", "==", uid));
    const snap = await getDocs(qNodes);
    let linked = 0;

    snap.forEach((n) => {
      const allocs = n.data()?.allocations || [];
      if (allocs.some((a) => a.disk === d.disk)) linked++;
    });

    setDelStats({ nodes: linked });
    setDelOpen(true);
  }

  async function confirmDeleteCascade() {
    if (!uid || !delTarget) return;
    setError("");

    if (delStats.nodes > 0) {
      return setError(
        `Cannot delete "${delTarget.disk}" because it is still linked to ${delStats.nodes} node(s). Remove it from those nodes first.`
      );
    }

    try {
      const diskRef = doc(db, "disks", delTarget.id);
      await deleteDoc(diskRef);
      setDelOpen(false);
    } catch (e) {
      console.error(e);
      setError("Delete failed.");
    }
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-3xl font-semibold">Disks</h2>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Disk name"
            value={disk}
            onChange={(e) => setDisk(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          >
            <option value="SSD">SSD</option>
            <option value="HDD">HDD</option>
            <option value="NVME">NVME</option>
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          >
            <option value="OS">OS</option>
            <option value="DATA">DATA</option>
          </select>
          <select
            value={cluster}
            onChange={(e) => setCluster(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          >
            <option value="">Select cluster</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.cluster}>
                {c.cluster}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Total (GB)"
            value={totalGB}
            onChange={(e) => setTotalGB(e.target.value)}
            className="w-32 px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Disk"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-600/20 text-red-200 px-3 py-2 border border-red-600/30">
          {error}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : disks.length === 0 ? (
          <div className="text-white/60">No disks yet. Create one above.</div>
        ) : (
          <div className="w-full overflow-auto rounded-xl border border-white/10">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <Th>Disk</Th>
                  <Th>Model</Th>
                  <Th>Role</Th>
                  <Th>Cluster</Th>
                  <Th>Nodes</Th>
                  <Th>Total</Th>
                  <Th>Used</Th>
                  <Th>Free</Th>
                  <Th>Usage</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {disks.map((d) => (
                  <DiskRow
                    key={d.id}
                    row={d}
                    onEdit={() => openEdit(d)}
                    onDelete={() => openDelete(d)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <Modal title={`Rename disk: ${editTarget?.disk}`} onClose={() => setEditOpen(false)}>
          <div className="space-y-3">
            <label className="block text-white/80">New name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {delOpen && (
        <Modal title={`Delete disk: ${delTarget?.disk}`} onClose={() => setDelOpen(false)}>
          <div className="space-y-3">
            {delStats.nodes === 0 ? (
              <div className="text-white/80">
                This disk has no linked node allocations. Deleting it cannot be undone.
              </div>
            ) : (
              <div className="text-red-400 font-medium">
                ⚠️ Cannot delete this disk because it is referenced by{" "}
                <b>{delStats.nodes}</b> node(s). Remove it from all linked nodes before deletion.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDelOpen(false)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Close
              </button>
              <button
                onClick={confirmDeleteCascade}
                disabled={delStats.nodes > 0}
                className={`px-4 py-2 rounded-lg ${
                  delStats.nodes > 0
                    ? "bg-red-900/50 text-white/50 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- UI Bits ---------- */
function Th({ children, className = "" }) {
  return (
    <th
      className={`px-4 py-3 font-medium text-white/80 border-b border-white/10 ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children }) {
  return <td className="px-4 py-3 border-b border-white/5">{children}</td>;
}
function DiskRow({ row, onEdit, onDelete }) {
  const total = row.total ?? 0;
  const used = row.used ?? 0;
  const free = row.free ?? Math.max(total - used, 0);
  const pct = useMemo(
    () => (!total ? 0 : Math.min(100, (used / total) * 100)),
    [used, total]
  );
  return (
    <tr className="hover:bg-white/5">
      <Td className="font-semibold">{row.disk}</Td>
      <Td>{row.model}</Td>
      <Td>{row.role}</Td>
      <Td>{row.cluster}</Td>
      <Td>{row.nodes ?? 0}</Td>
      <Td>{fmtBytes(total)}</Td>
      <Td>{fmtBytes(used)}</Td>
      <Td>{fmtBytes(free)}</Td>
      <Td>
        <div className="w-44">
          <UsageBar percent={pct} />
        </div>
      </Td>
      <Td>
        <div className="flex justify-end gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 rounded-lg bg-red-600/70 hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </Td>
    </tr>
  );
}
function UsageBar({ percent }) {
  return (
    <div className="w-full h-3 rounded-lg bg-white/10 overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 bg-white/10 rounded-lg hover:bg-white/20"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
function fmtBytes(bytes) {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 MB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}
