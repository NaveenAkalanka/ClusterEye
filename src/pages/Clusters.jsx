// src/pages/Clusters.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";

/* ----------------------------- Component ----------------------------- */

export default function Clusters() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);

  // create
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // feedback
  const [error, setError] = useState("");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIp, setEditIp] = useState("");
  const [editConfirm, setEditConfirm] = useState("");
  const [editError, setEditError] = useState("");

  // delete modal
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delTypeToConfirm, setDelTypeToConfirm] = useState("");
  const [delStats, setDelStats] = useState({ nodes: 0, disks: 0 });

  const recomputeTimer = useRef(null);

  /* ----------------------------- Auth ----------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  /* ----------------------------- Live data ----------------------------- */
  useEffect(() => {
    if (!uid) {
      setClusters([]);
      setDisks([]);
      setNodes([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const qClusters = query(
      collection(db, "clusters"),
      where("userId", "==", uid),
      orderBy("cluster")
    );
    const unsubClusters = onSnapshot(
      qClusters,
      (snap) => {
        setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load clusters.");
        setLoading(false);
      }
    );

    const unsubDisks = onSnapshot(
      query(collection(db, "disks"), where("userId", "==", uid)),
      (snap) => setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubNodes = onSnapshot(
      query(collection(db, "nodes"), where("userId", "==", uid)),
      (snap) => setNodes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubClusters();
      unsubDisks();
      unsubNodes();
    };
  }, [uid]);

  /* ------------------------- Client-side recompute ------------------------- */
  useEffect(() => {
    if (!uid) return;
    if (recomputeTimer.current) clearTimeout(recomputeTimer.current);
    recomputeTimer.current = setTimeout(async () => {
      try {
        await recomputeAndPersist({ clusters, disks, nodes });
      } catch (e) {
        console.error("Aggregate recompute failed:", e);
      }
    }, 150);
  }, [uid, clusters, disks, nodes]);

  /* ------------------------------ Create ------------------------------ */
  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!uid) return setError("You must be signed in.");

    const cluster = normalizeName(name);
    if (!cluster) return setError("Enter a cluster name.");

    // Validate IP format
    const ipRegex =
      /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(ipAddress))
      return setError("Invalid IP format (must be X.X.X.X).");

    // Check duplicates
    const nameExists = clusters.some(
      (c) => c.cluster.toLowerCase() === cluster.toLowerCase()
    );
    if (nameExists) return setError(`Cluster "${cluster}" already exists.`);

    const ipExists =
      clusters.some((c) => c.ipAddress === ipAddress) ||
      nodes.some((n) => n.ipAddress === ipAddress);
    if (ipExists) return setError("IP address already in use.");

    setSaving(true);
    try {
      await addDoc(collection(db, "clusters"), {
        userId: uid,
        cluster,
        ipAddress,
        nodes: 0,
        disks: 0,
        total: 0,
        used: 0,
        free: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setName("");
      setIpAddress("");
    } catch (e) {
      console.error(e);
      setError("Could not create cluster.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------ Edit ------------------------------ */
  function openEdit(c) {
    setEditTarget(c);
    setEditName(c.cluster);
    setEditIp(c.ipAddress || "");
    setEditConfirm("");
    setEditError("");
    setEditOpen(true);
  }

  async function doRename() {
    if (!uid || !editTarget) return;
    setEditError("");

    const oldName = editTarget.cluster;
    const newName = normalizeName(editName);
    const newIp = editIp.trim();

    const ipRegex =
      /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(newIp))
      return setEditError("Invalid IP format (must be X.X.X.X).");

    if (editConfirm.trim() !== oldName)
      return setEditError(`Type "${oldName}" to confirm.`);

    // Check name duplicates
    const nameExists = clusters
      .filter((c) => c.id !== editTarget.id)
      .some((c) => c.cluster.toLowerCase() === newName.toLowerCase());
    if (nameExists) return setEditError(`Cluster "${newName}" already exists.`);

    // Check IP duplicates
    const ipExists =
      clusters
        .filter((c) => c.id !== editTarget.id)
        .some((c) => c.ipAddress === newIp) ||
      nodes.some((n) => n.ipAddress === newIp);
    if (ipExists) return setEditError("IP address already in use.");

    try {
      const batch = writeBatch(db);

      const clusterRef = doc(collection(db, "clusters"), editTarget.id);
      batch.update(clusterRef, {
        cluster: newName,
        ipAddress: newIp,
        updatedAt: serverTimestamp(),
      });

      const qNodesInCluster = query(
        collection(db, "nodes"),
        where("userId", "==", uid),
        where("cluster", "==", oldName)
      );
      const nodesSnap = await getDocs(qNodesInCluster);
      nodesSnap.forEach((nref) => {
        batch.update(doc(collection(db, "nodes"), nref.id), {
          cluster: newName,
          updatedAt: serverTimestamp(),
        });
      });

      const qDisksInCluster = query(
        collection(db, "disks"),
        where("userId", "==", uid),
        where("cluster", "==", oldName)
      );
      const disksSnap = await getDocs(qDisksInCluster);
      disksSnap.forEach((dref) => {
        batch.update(doc(collection(db, "disks"), dref.id), {
          cluster: newName,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      setEditError("Update failed.");
    }
  }

  /* ------------------------------ Delete ------------------------------ */
  async function openDelete(c) {
    setDelTarget(c);
    setDelTypeToConfirm("");
    const [nCount, dCount] = await Promise.all([
      countDocs(
        query(
          collection(db, "nodes"),
          where("userId", "==", uid),
          where("cluster", "==", c.cluster)
        )
      ),
      countDocs(
        query(
          collection(db, "disks"),
          where("userId", "==", uid),
          where("cluster", "==", c.cluster)
        )
      ),
    ]);
    setDelStats({ nodes: nCount, disks: dCount });
    setDelOpen(true);
  }

  async function confirmDeleteCascade() {
    if (!uid || !delTarget) return;
    setError("");

    const clusterName = delTarget.cluster;
    const ipToRemove = delTarget.ipAddress;

    if (delStats.nodes + delStats.disks > 0) {
      if (delTypeToConfirm.trim() !== clusterName) {
        return setError(`Type "${clusterName}" to confirm deletion.`);
      }
    }

    try {
      const batch = writeBatch(db);

      const clusterRef = doc(db, "clusters", delTarget.id);
      const clusterSnap = await getDoc(clusterRef);
      if (!clusterSnap.exists() || clusterSnap.data()?.userId !== uid) {
        setError("You don't own this cluster.");
        return;
      }

      const qNodesInCluster = query(
        collection(db, "nodes"),
        where("userId", "==", uid),
        where("cluster", "==", clusterName)
      );
      const nodesSnap = await getDocs(qNodesInCluster);
      nodesSnap.forEach((nref) =>
        batch.delete(doc(collection(db, "nodes"), nref.id))
      );

      const qDisksInCluster = query(
        collection(db, "disks"),
        where("userId", "==", uid),
        where("cluster", "==", clusterName)
      );
      const disksSnap = await getDocs(qDisksInCluster);
      disksSnap.forEach((dref) =>
        batch.delete(doc(collection(db, "disks"), dref.id))
      );

      batch.delete(clusterRef);

      if (ipToRemove) {
        const ipRef = doc(collection(db, "ipIndex"), ipToRemove);
        const ipSnap = await getDoc(ipRef);
        if (ipSnap.exists() && ipSnap.data()?.userId === uid) {
          batch.delete(ipRef);
        }
      }

      await batch.commit();
      setDelOpen(false);
    } catch (e) {
      console.error(e);
      setError("Delete failed.");
    }
  }

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Clusters</h2>
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New cluster name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
          />
          <input
            type="text"
            placeholder="IP Address (X.X.X.X)"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Cluster"}
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
        ) : clusters.length === 0 ? (
          <div className="text-white/70 border border-white/10 rounded-xl p-5">
            <div className="text-lg font-semibold mb-1">No clusters yet</div>
          </div>
        ) : (
          <div className="w-full overflow-auto rounded-xl border border-white/10">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <Th>Cluster</Th>
                  <Th>IP Address</Th>
                  <Th>Nodes</Th>
                  <Th>Disks</Th>
                  <Th>Total</Th>
                  <Th>Used</Th>
                  <Th>Free</Th>
                  <Th>Usage</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c) => (
                  <ClusterRow
                    key={c.id}
                    row={c}
                    onEdit={() => openEdit(c)}
                    onDelete={() => openDelete(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <Modal title={`Edit cluster: ${editTarget?.cluster}`} onClose={() => setEditOpen(false)}>
          <div className="space-y-3">
            <label className="block text-white/80">Cluster Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
            />
            <label className="block text-white/80">IP Address</label>
            <input
              type="text"
              value={editIp}
              onChange={(e) => setEditIp(e.target.value)}
              placeholder="X.X.X.X"
              className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
            />
            <div className="text-white/70">
              Type <b>{editTarget?.cluster}</b> to confirm:
            </div>
            <input
              type="text"
              value={editConfirm}
              onChange={(e) => setEditConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
            />

            {editError && (
              <div className="rounded-lg bg-red-600/20 text-red-200 px-3 py-2 border border-red-600/30">
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={doRename}
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
        <Modal title={`Delete cluster: ${delTarget?.cluster}`} onClose={() => setDelOpen(false)}>
          <div className="space-y-3">
            <div className="text-white/80">
              This cluster has <b>{delStats.nodes}</b> node(s) and{" "}
              <b>{delStats.disks}</b> disk(s).
            </div>
            <div className="text-white/70">
              Type <b>{delTarget?.cluster}</b> to confirm:
            </div>
            <input
              type="text"
              value={delTypeToConfirm}
              onChange={(e) => setDelTypeToConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDelOpen(false)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCascade}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
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

/* ----------------------------- UI Bits ----------------------------- */

function Th({ children, className = "" }) {
  return (
    <th className={`px-4 py-3 font-medium text-white/80 border-b border-white/10 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-3 border-b border-white/5">{children}</td>;
}

function ClusterRow({ row, onEdit, onDelete }) {
  const total = row.total ?? 0;
  const used = row.used ?? 0;
  const free = row.free ?? Math.max(total - used, 0);
  const pct = useMemo(() => {
    if (!total || total <= 0) return 0;
    const p = (used / total) * 100;
    return Math.max(0, Math.min(100, p));
  }, [used, total]);

  return (
    <tr className="hover:bg-white/5">
      <Td className="font-semibold">{row.cluster}</Td>
      <Td>{row.ipAddress || "—"}</Td>
      <Td>{row.nodes ?? 0}</Td>
      <Td>{row.disks ?? 0}</Td>
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
          <button onClick={onEdit} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20">
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

/* ---------------------------- Helpers ---------------------------- */

function fmtBytes(bytes) {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 MB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}

function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

async function countDocs(qry) {
  const snap = await getDocs(qry);
  return snap.size;
}

async function recomputeAndPersist({ clusters, disks, nodes }) {
  const GB = 1_000_000_000;

  const allocByDiskName = new Map();
  for (const n of nodes) {
    const nodeId = n.id;
    const allocs = Array.isArray(n.allocations) ? n.allocations : [];
    for (const a of allocs) {
      if (!a || typeof a.disk !== "string") continue;
      const key = a.disk;
      const addBytes = Math.max(0, Math.round(Number(a.allocatedGB || 0) * GB));
      if (!allocByDiskName.has(key)) allocByDiskName.set(key, { used: 0, nodeIds: new Set() });
      const ent = allocByDiskName.get(key);
      ent.used += addBytes;
      ent.nodeIds.add(nodeId);
    }
  }

  const diskUpdates = [];
  for (const d of disks) {
    const entry = allocByDiskName.get(d.disk) || { used: 0, nodeIds: new Set() };
    const used = Math.min(entry.used, Number(d.total || 0));
    const free = Math.max(0, Number(d.total || 0) - used);
    const nodesCount = entry.nodeIds.size;
    const need =
      Number(d.used || 0) !== used ||
      Number(d.free || 0) !== free ||
      Number(d.nodes || 0) !== nodesCount;
    if (need) {
      diskUpdates.push({
        id: d.id,
        data: { used, free, nodes: nodesCount, updatedAt: serverTimestamp() },
      });
    }
  }

  const clusterAgg = new Map();
  for (const d of disks) {
    const cname = d.cluster;
    if (!cname) continue;
    if (!clusterAgg.has(cname)) clusterAgg.set(cname, { total: 0, used: 0, disks: 0, nodes: 0 });
    const agg = clusterAgg.get(cname);
    const recomputed = allocByDiskName.get(d.disk);
    const used = Math.min(recomputed?.used ?? d.used ?? 0, Number(d.total || 0));
    agg.total += Number(d.total || 0);
    agg.used += used;
    agg.disks += 1;
  }
  for (const n of nodes) {
    const cname = n.cluster;
    if (!cname) continue;
    if (!clusterAgg.has(cname)) clusterAgg.set(cname, { total: 0, used: 0, disks: 0, nodes: 0 });
    clusterAgg.get(cname).nodes += 1;
  }

  const clusterUpdates = [];
  for (const c of clusters) {
    const agg = clusterAgg.get(c.cluster) || { total: 0, used: 0, disks: 0, nodes: 0 };
    const total = agg.total;
    const used = agg.used;
    const free = Math.max(0, total - used);

    const need =
      Number(c.total || 0) !== total ||
      Number(c.used || 0) !== used ||
      Number(c.free || 0) !== free ||
      Number(c.disks || 0) !== agg.disks ||
      Number(c.nodes || 0) !== agg.nodes;

    if (need) {
      clusterUpdates.push({
        id: c.id,
        data: { total, used, free, disks: agg.disks, nodes: agg.nodes, updatedAt: serverTimestamp() },
      });
    }
  }

  const writes = [];
  for (const u of diskUpdates) writes.push(updateDoc(doc(collection(db, "disks"), u.id), u.data));
  for (const u of clusterUpdates) writes.push(updateDoc(doc(collection(db, "clusters"), u.id), u.data));
  await Promise.all(writes);
}
