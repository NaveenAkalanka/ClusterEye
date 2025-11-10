import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import NodeModal from "../components/NodeModal";

export default function Nodes() {
  const [uid, setUid] = useState(null);

  // form state
  const [nodeName, setNodeName] = useState("");
  const [type, setType] = useState("LXC");
  const [cluster, setCluster] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [allocRows, setAllocRows] = useState([]);

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewNode, setViewNode] = useState(null);

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  // load clusters, disks, nodes
  useEffect(() => {
    if (!uid) {
      setClusters([]);
      setDisks([]);
      setNodes([]);
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
      (snap) => setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubNodes = onSnapshot(
      query(collection(db, "nodes"), where("userId", "==", uid), orderBy("node")),
      (snap) => {
        setNodes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Failed to load nodes.");
        setLoading(false);
      }
    );

    return () => {
      unsubClusters();
      unsubDisks();
      unsubNodes();
    };
  }, [uid]);

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

  // detect duplicate / invalid / mismatch IPs
  const invalidIPs = useMemo(() => {
    const allIPs = [];
    const ipMap = {};
    const invalid = new Set();

    for (const n of nodes) {
      allIPs.push({ ip: n.ipAddress, id: n.id, cluster: n.cluster });
    }
    for (const c of clusters) {
      allIPs.push({ ip: c.ipAddress, id: c.id, cluster: c.cluster });
    }

    for (const { ip, id } of allIPs) {
      if (!ip || !isValidIP(ip)) {
        invalid.add(id);
        continue;
      }
      if (ipMap[ip]) {
        invalid.add(id);
        invalid.add(ipMap[ip].id);
      } else {
        ipMap[ip] = { id };
      }
    }

    for (const n of nodes) {
      const cl = clusters.find((c) => c.cluster === n.cluster);
      if (cl?.ipAddress && !isSameSubnet(n.ipAddress, cl.ipAddress)) {
        invalid.add(n.id);
      }
    }

    return invalid;
  }, [nodes, clusters]);

  // allocation helpers
  function addAlloc() {
    if (!cluster) {
      setError("Select a cluster first before assigning disks.");
      return;
    }
    setAllocRows((prev) => [...prev, { diskId: "", gb: "" }]);
  }
  function removeAlloc(i) {
    setAllocRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function changeAlloc(i, field, value) {
    setAllocRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  // total allocated
  const allocatedBytes = useMemo(() => {
    const GB = 1_000_000_000;
    let sum = 0;
    for (const r of allocRows) {
      const n = Number(r.gb);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum * GB);
  }, [allocRows]);

  // create node
  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    if (!uid) return setError("You must be signed in.");
    const n = nodeName.trim();
    const ip = ipAddress.trim();
    if (!n) return setError("Enter node name.");
    if (!cluster) return setError("Select a cluster.");
    if (!ip) return setError("Enter IP address.");
    if (!isValidIP(ip)) return setError("Invalid IPv4 format.");

    const clObj = clusters.find((c) => c.cluster === cluster);
    if (!clObj?.ipAddress) return setError("Selected cluster missing base IP.");

    const subnet = clObj.ipAddress.split(".").slice(0, 3).join(".");
    const nodeNet = ip.split(".").slice(0, 3).join(".");
    if (subnet !== nodeNet)
      return setError(`IP not in same subnet as cluster (${subnet}.x)`);

    const allIPs = [
      ...nodes.map((n) => n.ipAddress),
      ...clusters.map((c) => c.ipAddress),
    ];
    if (allIPs.includes(ip)) {
      return setError("This IP address is already used by another node or cluster.");
    }

    if (allocRows.length === 0) return setError("Add at least one disk allocation.");

    const allocations = [];
    for (const r of allocRows) {
      const disk = disks.find((d) => d.id === r.diskId);
      if (!disk) return setError("Select a valid disk.");
      const gbNum = Number(r.gb);
      if (!Number.isFinite(gbNum) || gbNum <= 0)
        return setError("Enter valid GB allocations.");
      const freeGB = (disk.free || 0) / 1_000_000_000;
      if (gbNum > freeGB)
        return setError(`Disk ${disk.disk} has only ${freeGB.toFixed(1)} GB free.`);
      allocations.push({ disk: disk.disk, allocatedGB: gbNum });
    }

    const nodeDoc = {
      userId: uid,
      node: n,
      type,
      cluster,
      ipAddress: ip,
      allocations,
      allocated: allocatedBytes,
      username: "",
      password: "",
      link: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      await addDoc(collection(db, "nodes"), nodeDoc);
      setNodeName("");
      setType("LXC");
      setCluster("");
      setIpAddress("");
      setAllocRows([]);
    } catch (err) {
      console.error(err);
      setError("Could not create node.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-white">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-3xl font-semibold">Nodes</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Node name"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          >
            <option value="LXC">LXC</option>
            <option value="VM">VM</option>
          </select>
          <select
            value={cluster}
            onChange={(e) => {
              setCluster(e.target.value);
              setAllocRows([]);
            }}
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
            type="text"
            placeholder="IP address"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
          />
        </form>
      </div>

      {/* Disk allocations */}
      <div className="mt-4 border border-white/10 rounded-xl p-3">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Disk Allocations</h3>
          <button
            onClick={addAlloc}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            + Add Disk
          </button>
        </div>

        {allocRows.length === 0 ? (
          <div className="text-white/60 mt-3">No allocations yet.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {allocRows.map((r, i) => {
              const filteredDisks = disks.filter((d) => d.cluster === cluster);
              return (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                  <select
                    value={r.diskId}
                    onChange={(e) => changeAlloc(i, "diskId", e.target.value)}
                    className="px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
                  >
                    <option value="">Select disk</option>
                    {filteredDisks.map((d) => {
                      const freeGB = (d.free || 0) / 1_000_000_000;
                      return (
                        <option key={d.id} value={d.id}>
                          {d.disk} ({freeGB.toFixed(1)} GB free)
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Allocated (GB)"
                    value={r.gb}
                    onChange={(e) => changeAlloc(i, "gb", e.target.value)}
                    className="w-36 px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
                  />
                  <button
                    onClick={() => removeAlloc(i)}
                    className="px-3 py-2 rounded-lg bg-red-600/70 hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex justify-between items-center">
          <div className="text-white/70">
            Total Allocated: <b>{fmtBytes(allocatedBytes)}</b>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Node"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-600/20 text-red-200 px-3 py-2 border border-red-600/30">
            {error}
          </div>
        )}
      </div>

      {/* Node Table */}
      <div className="mt-6">
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : nodes.length === 0 ? (
          <div className="text-white/60">No nodes yet. Add one above.</div>
        ) : (
          <div className="w-full overflow-auto rounded-xl border border-white/10">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <Th>Node</Th>
                  <Th>Type</Th>
                  <Th>Cluster</Th>
                  <Th>Disks</Th>
                  <Th>Allocated</Th>
                  <Th>IP</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => {
                  const invalid = invalidIPs.has(n.id);
                  return (
                    <tr
                      key={n.id}
                      className={`hover:bg-white/5 ${
                        invalid ? "bg-red-900/40 text-red-300" : ""
                      }`}
                    >
                      <Td className="font-semibold">{n.node}</Td>
                      <Td>{n.type}</Td>
                      <Td>{n.cluster}</Td>
                      <Td>
                        {Array.isArray(n.allocations)
                          ? n.allocations.map((a) => a.disk).join(", ")
                          : "-"}
                      </Td>
                      <Td>{fmtBytes(n.allocated || 0)}</Td>
                      <Td>{n.ipAddress}</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => setViewNode(n)}
                          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                        >
                          View
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewNode && (
        <NodeModal
          node={viewNode}
          onClose={() => setViewNode(null)}
          clusters={clusters}
          disks={disks}
          uid={uid}
        />
      )}
    </div>
  );
}

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
function fmtBytes(bytes) {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 MB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}
