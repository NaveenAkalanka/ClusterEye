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
  doc,
  writeBatch,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Desktop,
  HardDrives,
  Cpu,
  Memory,
  CaretUp,
  CaretDown,
  MagnifyingGlass,
  CaretCircleRight,
  Plus,
  Funnel,
  XCircle,
  Globe,
  Circuitry,
} from "@phosphor-icons/react";
import { db, auth } from "../firebaseConfig";
import { isIpInSubnet, calculateNetworkAddress } from "../utils/network";
import NodeModal from "../components/NodeModal";
import AddNodeModal from "../components/AddNodeModal";
import FilterModal from "../components/FilterModal";

export default function Nodes() {
  const [uid, setUid] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [containers, setContainers] = useState([]);
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
      setContainers([]);
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

    const unsubContainers = onSnapshot(
      query(collection(db, "containers"), where("userId", "==", uid)),
      (snap) => setContainers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubClusters();
      unsubDisks();
      unsubNodes();
      unsubContainers();
    };
  }, [uid]);

  // ... (lines 111-520 unchanged)

  {
    viewNode && (
      <NodeModal
        node={viewNode}
        onClose={() => setViewNode(null)}
        clusters={clusters}
        disks={disks}
        containers={containers}
        uid={uid}
      />
    )
  }

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

    if (nodeId.length > 50) return setError("Node ID max 50 chars.");
    if (!/^[a-zA-Z0-9-_]+$/.test(nodeId)) return setError("Node ID: letters, numbers, -, _ only.");
    if (nodeName.length > 50) return setError("Node Name max 50 chars.");

    const idExists = nodes.some(
      (n) => n.nodeId?.toLowerCase() === nodeId.trim().toLowerCase()
    );
    if (idExists) return setError("Node ID already exists.");

    const nameExists = nodes.some(
      (n) => n.node?.toLowerCase() === nodeName.trim().toLowerCase()
    );
    if (nameExists) return setError("Node name already exists.");

    if (allocRows.length === 0)
      return setError("At least one disk must be allocated.");

    const clObj = clusters.find((c) => c.cluster === cluster);
    if (!clObj?.ipAddress) return setError("Cluster missing base IP.");

    // Strict Subnet Validation
    const mask = clObj.subnetMask || "255.255.255.0"; // Default to /24 if missing
    if (!isIpInSubnet(ipAddress, clObj.ipAddress, mask)) {
      const requiredNet = calculateNetworkAddress(clObj.ipAddress, mask);
      return setError(`IP must be in the ${requiredNet} network (Mask: ${mask})`);
    }

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

      const freeGB = ((disk.total || 0) - (disk.used || 0)) / 1_000_000_000;
      if (gbNum > freeGB)
        return setError(`${disk.disk} has only ${freeGB.toFixed(1)} GB free.`);

      allocations.push({ disk: disk.disk, allocatedGB: gbNum });
    }

    // Calculate total allocated bytes
    const totalAllocatedBytes = allocations.reduce(
      (sum, a) => sum + (Number(a.allocatedGB) || 0) * 1_000_000_000,
      0
    );

    const nodePayload = {
      userId: uid,
      nodeId: nodeId.trim(),
      node: nodeName.trim(),
      type,
      cluster,
      ipAddress: ipAddress.trim(),
      allocations,
      allocated: totalAllocatedBytes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };



    setSaving(true);
    try {
      const batch = writeBatch(db);

      // Create new node ref
      const newNodeRef = doc(collection(db, "nodes"));
      batch.set(newNodeRef, nodePayload);

      // Update disk usage
      for (const a of allocations) {
        // Find disk ID by name (since we stored disk name in allocations, but need ID for doc ref)
        // Wait, allocations array build in previous loop used `disk.disk` name. 
        // We need the ID. Let's fix the allocation building loop above or lookup here.
        // Actually, looking at lines 156-166, we iterate allocRows which has diskId.
        // Let's refine the loop below to match disk names to IDs or just rely on the fact we need IDs.

        // Correct approach: We need to find the disk ID for the update.
        // In the previous loop (lines 155-167), we found `disk` object. 
        // `allocations` currently stores { disk: "diskName", ... }. 
        // We should probably change usages to use IDs or looking it up again.
        // Let's just look it up again for safety/simplicity in this batch block.
        const diskObj = disks.find(d => d.disk === a.disk);
        if (diskObj) {
          const diskRef = doc(db, "disks", diskObj.id);
          const bytesToAdd = (Number(a.allocatedGB) || 0) * 1_000_000_000;
          batch.update(diskRef, { used: increment(bytesToAdd) });
        }
      }

      await batch.commit();
      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
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

  function resetAddForm() {
    setNodeId("");
    setNodeName("");
    setType("LXC");
    setCluster("");
    setIpAddress("");
    setAllocRows([]);
    setError("");
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
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <aside className="w-full lg:w-80 bg-[#0D100D] rounded-3xl p-6 flex flex-col gap-6 shrink-0 border border-white/5 h-fit lg:h-full lg:overflow-y-auto content-scrollbar">

        <div className="relative">
          <div className="w-full h-12 rounded-xl p-[2px] bg-gradient-to-r from-[#A8C9AD] to-[#69639E] transition-all">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-full bg-[#161D22] rounded-[10px] px-4 text-white text-base focus:outline-none placeholder:text-white/40"
            />
          </div>
          <div className="absolute right-4 top-3.5 text-[#A8C9AD] opacity-80">
            <MagnifyingGlass size={20} />
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-5 gap-2 h-12">
          <button
            onClick={() => setShowCreate(true)}
            className="col-span-3 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] rounded-xl flex items-center justify-center gap-2 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            <span>Add Node</span>
          </button>
          <button
            onClick={() => setShowFilter(true)}
            className="col-span-1 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <Funnel size={18} />
          </button>
          <button
            onClick={clearFilters}
            className="col-span-1 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Row 3: Stats (Grid on mobile, column on desktop) */}
        <div className="flex-1 grid grid-cols-3 md:flex md:flex-col gap-3 mt-2 min-h-0">
          <StatCard mockup label="Total nodes" value={totalNodes} fill />
          <StatCard mockup label="Total vms" value={totalVM} fill />
          <StatCard mockup label="Total lxcs" value={totalLXC} fill />
        </div>
      </aside>

      {/* ---------------- RIGHT CONTENT AREA ---------------- */}
      <section className="flex-1 bg-[#0D100D] rounded-[20px] p-4 md:p-6 md:h-full md:overflow-y-auto custom-scrollbar h-fit">

        {/* Table Headers (Hidden on mobile) */}
        <div className="hidden md:grid grid-cols-7 text-white/50 text-sm font-semibold mb-4 px-6">
          <span>ID</span>
          <span>Node</span>
          <span>Type</span>
          <span>Cluster</span>
          <span>Disk</span>
          <span>Allocated</span>
          <span>Ip address</span>
        </div>

        {/* Table Rows */}
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="text-white/40 text-center py-12 text-lg">Loading system nodes...</div>
          ) : filteredNodes.length === 0 ? (
            <div className="text-white/40 text-center py-12 text-lg">No nodes found in this sector.</div>
          ) : (
            filteredNodes.map((n) => (
              <div key={n.id}>
                {/* Desktop View */}
                <div
                  className="hidden md:grid grid-cols-7 bg-[#161D22]/60 hover:bg-[#161D22] rounded-xl h-12 px-6 items-center text-white text-sm font-medium transition-all group border border-white/0 hover:border-white/5"
                >
                  <div className="truncate pr-4 text-white/60">{n.nodeId}</div>
                  <div className="truncate pr-4">{n.node}</div>
                  <div className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90 w-fit">{n.type}</div>
                  <div className="flex items-center gap-2 truncate pr-4">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clusters.find(c => c.cluster === n.cluster)?.color || "#69639E" }}></div>
                    <span className="text-sm font-normal text-white/80 truncate">{n.cluster}</span>
                  </div>
                  <div className="truncate pr-4 text-sm font-normal text-white/60">{n.allocations?.map(a => a.disk).join(", ") || "—"}</div>
                  <div className="text-sm font-normal text-white/80">{fmtBytes(n.allocated || 0)}</div>
                  <div className="flex justify-between items-center text-sm text-white/90">
                    <span>{n.ipAddress}</span>
                    <div
                      onClick={() => setViewNode(n)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#69639E] hover:text-[#A8C9AD] flex items-center gap-1 cursor-pointer"
                      title="View Node"
                    >
                      <CaretCircleRight size={22} weight="fill" />
                    </div>
                  </div>
                </div>

                {/* Mobile View (Card) */}
                <div
                  className="md:hidden flex flex-col bg-[#161D22]/60 rounded-xl p-3 gap-2 text-white transition-all border border-white/5 group"
                >
                  {/* Row 1: Name, Type, Arrow */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-white">{n.node}</div>
                      <div className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">{n.type}</div>
                    </div>
                    <CaretCircleRight
                      onClick={() => setViewNode(n)}
                      size={20}
                      weight="fill"
                      className="text-[#69639E] active:scale-95 transition-all cursor-pointer"
                    />
                  </div>

                  {/* Row 2: Subtitle (ID & Cluster) */}
                  <div className="flex items-center gap-3 text-[10px] text-white/50 -mt-1">
                    <span className="font-mono">{n.nodeId}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: clusters.find(c => c.cluster === n.cluster)?.color || "#69639E" }}></div>
                      <span>{n.cluster}</span>
                    </div>
                  </div>

                  {/* Row 3: Stats Grid (Compact) */}
                  <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-white/5">
                    <div>
                      <div className="text-[9px] text-white/30 uppercase font-bold">IP</div>
                      <div className="text-xs text-white/80 font-mono truncate">{n.ipAddress}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/30 uppercase font-bold">Alloc</div>
                      <div className="text-xs text-white/80">{fmtBytes(n.allocated || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/30 uppercase font-bold">Disks</div>
                      <div className="text-xs text-white/60 truncate">{n.allocations?.map(a => a.disk).join(", ") || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

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
          onClose={() => {
            resetAddForm();
            setShowCreate(false);
          }}
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
          setAllocRows={setAllocRows}
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
          containers={containers}
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

function StatCard({ label, value, mockup, fill }) {
  if (mockup) {
    return (
      <div className={`w-full ${fill ? "flex-1" : "h-24"} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-md group hover:border-[#69639E]/50 transition-all`}>
        <div className={`text-white/70 font-medium tracking-tight ${fill ? "text-sm md:text-xl" : "text-sm"}`}>{label}</div>
        <div className={`text-white font-bold leading-none bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent ${fill ? "text-3xl md:text-7xl" : "text-3xl"}`}>{value}</div>
      </div>
    );
  }
  return (
    <div className="bg-gray-800/70 border border-white/10 rounded-xl p-4 text-center">
      <div className="text-white/60 text-sm">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
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
