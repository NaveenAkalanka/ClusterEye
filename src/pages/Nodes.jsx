// src/pages/Nodes.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import NodeModal from "../components/NodeModal";

export default function Nodes() {
  const [uid, setUid] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewNode, setViewNode] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Add Node form fields
  const [nodeId, setNodeId] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [type, setType] = useState("LXC");
  const [cluster, setCluster] = useState("");
  const [ipAddress, setIpAddress] = useState("");

  const [allocRows, setAllocRows] = useState([]); // always lives here

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [filterDisk, setFilterDisk] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  /* ---------------- Auth Listener ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  /* ---------------- Load Data ---------------- */
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
      () => {
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

  /* ---------------- Helpers ---------------- */
  function isValidIP(ip) {
    return (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)
    );
  }

  function addAlloc() {
    if (!cluster) return setError("Select a cluster first.");
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

  /* ---------------- Create Node ---------------- */
  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    if (!uid) return setError("You must be signed in.");
    if (!nodeId.trim()) return setError("Node ID is required.");
    if (!nodeName.trim()) return setError("Node name is required.");
    if (!cluster) return setError("Cluster is required.");
    if (!ipAddress.trim()) return setError("Enter IP address.");
    if (!isValidIP(ipAddress)) return setError("Invalid IP.");

    const idExists = nodes.some(
      (n) => n.nodeId?.toLowerCase() === nodeId.trim().toLowerCase()
    );
    if (idExists) return setError("Node ID already exists.");

    if (allocRows.length === 0)
      return setError("At least one disk must be allocated.");

    const clObj = clusters.find((c) => c.cluster === cluster);
    if (!clObj?.ipAddress) return setError("Cluster missing base IP.");

    const subnet = clObj.ipAddress.split(".").slice(0, 3).join(".");
    const nodeNet = ipAddress.split(".").slice(0, 3).join(".");

    if (subnet !== nodeNet)
      return setError(`IP must match cluster subnet (${subnet}.x)`);

    // check IP collisions
    const allIPs = [
      ...nodes.map((n) => n.ipAddress),
      ...clusters.map((c) => c.ipAddress),
    ];
    if (allIPs.includes(ipAddress))
      return setError("This IP is already used.");

    // Validate allocations
    const allocations = [];
    for (const r of allocRows) {
      const disk = disks.find((d) => d.id === r.diskId);
      if (!disk) return setError("Invalid disk selection.");

      const gbNum = Number(r.gb);
      if (!gbNum || gbNum <= 0) return setError("Enter valid GB.");

      const freeGB = (disk.free || 0) / 1_000_000_000;
      if (gbNum > freeGB)
        return setError(`${disk.disk} has only ${freeGB.toFixed(1)} GB free.`);

      allocations.push({ disk: disk.disk, allocatedGB: gbNum });
    }

    const doc = {
      userId: uid,
      nodeId: nodeId.trim(),
      node: nodeName.trim(),
      type,
      cluster,
      ipAddress: ipAddress.trim(),
      allocations,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      await addDoc(collection(db, "nodes"), doc);
      resetForm();
      setShowCreate(false);
    } catch (err) {
      setError("Failed to create.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setNodeId("");
    setNodeName("");
    setType("LXC");
    setCluster("");
    setIpAddress("");
    setAllocRows([]);
  }

  /* ---------------- Filters ---------------- */
  const filteredNodes = useMemo(() => {
    let result = [...nodes];

    if (search.trim()) {
      result = result.filter(
        (n) =>
          n.node.toLowerCase().includes(search.toLowerCase()) ||
          n.nodeId.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filterType) result = result.filter((n) => n.type === filterType);
    if (filterCluster) result = result.filter((n) => n.cluster === filterCluster);
    if (filterDisk)
      result = result.filter((n) =>
        n.allocations?.some((a) => a.disk === filterDisk)
      );

    if (sortConfig.key) {
      result.sort((a, b) => {
        const A = a[sortConfig.key] || "";
        const B = b[sortConfig.key] || "";
        if (A < B) return sortConfig.direction === "asc" ? -1 : 1;
        if (A > B) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [nodes, search, filterType, filterCluster, filterDisk, sortConfig]);

  function clearFilters() {
    setSearch("");
    setFilterType("");
    setFilterCluster("");
    setFilterDisk("");
  }

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  const totalNodes = nodes.length;
  const totalVM = nodes.filter((n) => n.type === "VM").length;
  const totalLXC = nodes.filter((n) => n.type === "LXC").length;

  return (
    <div className="flex gap-4 text-white">

      {/* ---------------- LEFT COLUMN ---------------- */}
      <div className="w-[10%] min-w-[250px] space-y-4">

        <input
          type="text"
          placeholder="Search by Node name or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800/70 border border-white/10"
        />

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            + Add Node
          </button>

          <button
            onClick={() => setShowFilter(true)}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            Filter
          </button>

          <button
            onClick={clearFilters}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            Clear
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <StatCard label="Total Nodes" value={totalNodes} />
          <StatCard label="Total VMs" value={totalVM} />
          <StatCard label="Total LXCs" value={totalLXC} />
        </div>
      </div>

      {/* ---------------- RIGHT COLUMN ---------------- */}
      <div className="flex-1">
        {loading ? (
          <div className="text-white/60">Loading...</div>
        ) : filteredNodes.length === 0 ? (
          <div className="text-white/60">No nodes found.</div>
        ) : (
          <div className="w-full overflow-auto rounded-xl border border-white/10">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <Th onClick={() => handleSort("nodeId")}>ID</Th>
                  <Th onClick={() => handleSort("node")}>Node</Th>
                  <Th onClick={() => handleSort("type")}>Type</Th>
                  <Th onClick={() => handleSort("cluster")}>Cluster</Th>
                  <Th>Disks</Th>
                  <Th>Allocated</Th>
                  <Th onClick={() => handleSort("ipAddress")}>IP</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>

              <tbody>
                {filteredNodes.map((n) => (
                  <tr key={n.id} className="hover:bg-white/5">
                    <Td>{n.nodeId}</Td>
                    <Td>{n.node}</Td>
                    <Td>{n.type}</Td>
                    <Td>{n.cluster}</Td>
                    <Td>{n.allocations?.map((a) => a.disk).join(", ")}</Td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- MODALS ---------------- */}

      {showFilter && (
        <FilterModal
          onClose={() => setShowFilter(false)}
          clusters={clusters}
          disks={disks}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCluster={filterCluster}
          setFilterCluster={setFilterCluster}
          filterDisk={filterDisk}
          setFilterDisk={setFilterDisk}
        />
      )}

      {showCreate && (
        <AddNodeModal
          onClose={() => setShowCreate(false)}
          handleCreate={handleCreate}
          clusters={clusters}
          disks={disks}
          nodeId={nodeId}
          setNodeId={setNodeId}
          nodeName={nodeName}
          setNodeName={setNodeName}
          type={type}
          setType={setType}
          cluster={cluster}
          setCluster={setCluster}
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
          allocRows={allocRows}
          addAlloc={addAlloc}
          removeAlloc={removeAlloc}
          changeAlloc={changeAlloc}
          error={error}
          saving={saving}
        />
      )}

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

/* ---------------- Small Components ---------------- */

function Th({ children, onClick }) {
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 font-medium text-white/80 border-b border-white/10 cursor-pointer hover:text-white"
    >
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-3 border-b border-white/5">{children}</td>;
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800/70 border border-white/10 rounded-xl p-4 text-center">
      <div className="text-white/60 text-sm">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

/* ---------------- Filter Modal ---------------- */

function FilterModal({
  onClose,
  clusters,
  disks,
  filterType,
  setFilterType,
  filterCluster,
  setFilterCluster,
  filterDisk,
  setFilterDisk,
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/10 p-5 w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Filter Nodes</h3>

        <div className="space-y-3">
          <Field label="Type">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input w-full"
            >
              <option value="">All Types</option>
              <option value="VM">VM</option>
              <option value="LXC">LXC</option>
            </select>
          </Field>

          <Field label="Cluster">
            <select
              value={filterCluster}
              onChange={(e) => setFilterCluster(e.target.value)}
              className="input w-full"
            >
              <option value="">All Clusters</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.cluster}>
                  {c.cluster}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Disk">
            <select
              value={filterDisk}
              onChange={(e) => setFilterDisk(e.target.value)}
              className="input w-full"
            >
              <option value="">All Disks</option>
              {disks.map((d) => (
                <option key={d.id} value={d.disk}>
                  {d.disk}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Close
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Add Node Modal ---------------- */

function AddNodeModal({
  onClose,
  handleCreate,
  clusters,
  disks,
  nodeId,
  setNodeId,
  nodeName,
  setNodeName,
  type,
  setType,
  cluster,
  setCluster,
  ipAddress,
  setIpAddress,
  allocRows,
  addAlloc,
  removeAlloc,
  changeAlloc,
  error,
  saving,
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Add New Node</h3>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">

          <Field label="Node ID">
            <input
              type="text"
              placeholder="Unique Node ID"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="input w-full"
            />
          </Field>

          <Field label="Node Name">
            <input
              type="text"
              placeholder="Node name"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              className="input w-full"
            />
          </Field>

          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input w-full"
            >
              <option value="LXC">LXC</option>
              <option value="VM">VM</option>
            </select>
          </Field>

          <Field label="Cluster">
            <select
              value={cluster}
              onChange={(e) => {
                setCluster(e.target.value);
                setAllocRows([]); // allowed here, inside Nodes() modal receives this prop
              }}
              className="input w-full"
            >
              <option value="">Select cluster</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.cluster}>
                  {c.cluster}
                </option>
              ))}
            </select>
          </Field>

          <Field label="IP Address">
            <input
              type="text"
              placeholder="IPv4 address"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="input w-full"
            />
          </Field>

          {/* Allocations */}
          <div className="border border-white/10 rounded-lg p-3 mt-2">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-white/80">Disk Allocations</div>
              <button
                type="button"
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
                        onChange={(e) =>
                          changeAlloc(i, "diskId", e.target.value)
                        }
                        className="input"
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
                        placeholder="Allocated (GB)"
                        value={r.gb}
                        onChange={(e) =>
                          changeAlloc(i, "gb", e.target.value)
                        }
                        className="w-36 input"
                      />

                      <button
                        type="button"
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
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-600/20 text-red-200 border border-red-600/30 rounded-lg px-3 py-2 mt-3">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Shared Components ---------------- */

function Field({ label, children }) {
  return (
    <div>
      <div className="text-white/70 mb-1">{label}</div>
      {children}
    </div>
  );
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
