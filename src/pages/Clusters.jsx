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
import { MagnifyingGlass, Funnel, XCircle, Plus, CaretCircleRight, Globe, HardDrives, Circuitry, CaretUp, CaretDown } from "@phosphor-icons/react";
import AddClusterModal from "../components/AddClusterModal";
import ClusterModal from "../components/ClusterModal";
import { isValidSubnetMask } from "../utils/network";

/* ----------------------------- Component ----------------------------- */

export default function Clusters() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);

  // create
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [subnetMask, setSubnetMask] = useState("255.255.255.0");
  const [selectedColor, setSelectedColor] = useState("#69639E");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // view/edit modal
  const [viewClusterId, setViewClusterId] = useState(null);

  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

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
    setCreateError("");
    if (!uid) return setCreateError("You must be signed in.");

    const cluster = normalizeName(name);
    if (!cluster) return setCreateError("Enter a cluster name.");

    // Validate IP format
    const ipRegex =
      /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(ipAddress))
      return setCreateError("Invalid IP format (must be X.X.X.X).");

    if (!isValidSubnetMask(subnetMask))
      return setCreateError("Invalid subnet mask format.");

    // Check duplicates
    const nameExists = clusters.some(
      (c) => c.cluster.toLowerCase() === cluster.toLowerCase()
    );
    if (nameExists) return setCreateError(`Cluster "${cluster}" already exists.`);

    const ipExists =
      clusters.some((c) => c.ipAddress === ipAddress) ||
      nodes.some((n) => n.ipAddress === ipAddress);
    if (ipExists) return setCreateError("IP address already in use.");

    setSaving(true);
    try {
      await addDoc(collection(db, "clusters"), {
        userId: uid,
        cluster,
        ipAddress,
        subnetMask,
        color: selectedColor,
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
      setSubnetMask("255.255.255.0");
      setAddOpen(false);
    } catch (e) {
      console.error(e);
      setCreateError("Could not create cluster.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------ Filter/Stats ------------------------------ */
  const filteredClusters = useMemo(() => {
    let res = [...clusters];
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (c) =>
          c.cluster.toLowerCase().includes(q) ||
          (c.ipAddress || "").includes(q)
      );
    }

    if (sortConfig.key) {
      res.sort((a, b) => {
        let A = a[sortConfig.key];
        let B = b[sortConfig.key];

        // Handle numeric fields safely
        if (["total", "used", "free", "nodes", "disks"].includes(sortConfig.key)) {
          A = Number(A || 0);
          B = Number(B || 0);
        } else {
          A = (A || "").toString().toLowerCase();
          B = (B || "").toString().toLowerCase();
        }

        if (A < B) return sortConfig.direction === "asc" ? -1 : 1;
        if (A > B) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [clusters, search, sortConfig]);

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function clearFilters() {
    setSearch("");
    setSortConfig({ key: null, direction: "asc" });
  }

  const stats = useMemo(() => {
    const totalStorage = clusters.reduce((acc, c) => acc + (c.total || 0), 0);
    const totalNodes = clusters.reduce((acc, c) => acc + (c.nodes || 0), 0);

    return {
      count: clusters.length,
      storage: fmtBytes(totalStorage),
      nodes: totalNodes
    }
  }, [clusters]);

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

      {/* LEFT SIDEBAR */}
      {/* LEFT SIDEBAR */}
      <aside className="w-full lg:w-80 bg-[#0D100D] rounded-3xl p-6 flex flex-col gap-6 shrink-0 border border-white/5 h-fit lg:h-full lg:overflow-y-auto content-scrollbar">

        {/* Search */}
        <div className="relative w-full h-12 rounded-xl p-[2px] bg-gradient-to-r from-[#A8C9AD] to-[#69639E] transition-all">
          <div className="w-full h-full bg-[#161D22] rounded-[10px] flex items-center px-4 gap-3">
            <MagnifyingGlass size={20} className="text-[#A8C9AD]" weight="bold" />
            <input
              type="text"
              placeholder="Search Clusters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-white text-base w-full placeholder:text-white/40 h-full"
            />
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-5 gap-2 h-12">
          <button
            onClick={() => setAddOpen(true)}
            className="col-span-4 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] rounded-xl flex items-center justify-center gap-2 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            <span>Add Cluster</span>
          </button>
          <button
            onClick={clearFilters}
            className="col-span-1 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3 lg:flex-1">
          <StatCard label="Total Clusters" value={stats.count} icon={Globe} fill />
          <StatCard label="Total Storage" value={stats.storage} icon={HardDrives} fill />
          <StatCard label="Total Nodes" value={stats.nodes} icon={Circuitry} fill />
        </div>

      </aside>

      {/* RIGHT CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-3xl border border-white/5 flex flex-col overflow-hidden relative shadow-2xl">
        <div className="flex-1 overflow-auto p-4 content-scrollbar">
          {loading ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm animate-pulse">Loading clusters...</div>
          ) : filteredClusters.length === 0 ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm">
              {search ? "No clusters match your search." : "No clusters found. Add one to get started."}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header Row (Desktop) */}
              <div className="hidden md:grid grid-cols-[auto_1.5fr_1.2fr_1fr_0.5fr_1fr_1fr_1fr_0.5fr_2fr] gap-4 px-6 py-2 text-xs font-bold text-white/50 tracking-wider items-center select-none">
                <div className="w-2"></div> {/* Color Dot Spacer */}
                <div onClick={() => handleSort("cluster")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Cluster Name {sortConfig.key === "cluster" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("ipAddress")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  IP Address {sortConfig.key === "ipAddress" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("subnetMask")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Subnet Mask {sortConfig.key === "subnetMask" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("disks")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Disks {sortConfig.key === "disks" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("total")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Total {sortConfig.key === "total" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("used")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Used {sortConfig.key === "used" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("free")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Free {sortConfig.key === "free" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div onClick={() => handleSort("nodes")} className="cursor-pointer hover:text-white flex items-center gap-1 group">
                  Nodes {sortConfig.key === "nodes" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </div>
                <div className="text-left cursor-default">Usage</div>
              </div>

              {/* Rows */}
              {filteredClusters.map(c => (
                <div key={c.id}>
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[auto_1.5fr_1.2fr_1fr_0.5fr_1fr_1fr_1fr_0.5fr_2fr] gap-4 bg-[#161D22]/60 hover:bg-[#161D22] rounded-xl h-12 px-6 items-center text-white text-sm font-medium transition-all group border border-white/0 hover:border-white/5">

                    {/* Color Dot */}
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: c.color || "#69639E" }}></div>

                    <div className="truncate">{c.cluster}</div>

                    <div className="text-white/70 font-mono text-sm truncate">{c.ipAddress || "—"}</div>
                    <div className="text-white/50 font-mono text-xs truncate">{c.subnetMask || "/24"}</div>

                    <div className="text-white/80 text-sm">{c.disks || 0}</div>

                    <div className="text-white/70 text-sm font-mono">{fmtBytes(c.total || 0)}</div>
                    <div className="text-white/70 text-sm font-mono">{fmtBytes(c.used || 0)}</div>
                    <div className="text-white/70 text-sm font-mono">{fmtBytes((c.total || 0) - (c.used || 0))}</div>

                    <div className="text-white/80 text-sm">{c.nodes || 0}</div>

                    {/* Progress Bar with Percentage */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (c.used / c.total) * 100 || 0)}%`,
                            backgroundColor: c.color || "#69639E" // Use cluster color for bar
                          }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-white/50 w-8 text-right font-mono">
                        {((c.used / c.total) * 100 || 0).toFixed(0)}%
                      </span>
                      <div
                        onClick={() => setViewClusterId(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white cursor-pointer"
                        title="View Cluster"
                      >
                        <CaretCircleRight size={20} weight="fill" />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden flex flex-col bg-[#161D22]/60 rounded-xl p-4 gap-3 text-white transition-all border border-white/5 group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: c.color || "#69639E" }}></div>
                        <span className="font-bold text-sm">{c.cluster}</span>
                      </div>
                      <CaretCircleRight
                        onClick={() => setViewClusterId(c.id)}
                        size={24}
                        weight="fill"
                        className="text-white active:scale-95 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-white/70">
                      <div>IP: <span className="text-white">{c.ipAddress}</span></div>
                      <div>Nodes: <span className="text-white">{c.nodes}</span></div>
                      <div>Disks: <span className="text-white">{c.disks}</span></div>
                      <div>Total: <span className="text-white">{fmtBytes(c.total)}</span></div>
                      <div>Used: <span className="text-white">{fmtBytes(c.used || 0)}</span></div>
                      <div>Free: <span className="text-white">{fmtBytes((c.total || 0) - (c.used || 0))}</span></div>
                    </div>
                    <div className="mt-1">
                      <div className="flex justify-between text-xs mb-1 text-white/50">
                        <span>Usage</span>
                        <span>{((c.used / c.total) * 100 || 0).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (c.used / c.total) * 100 || 0)}%`,
                            backgroundColor: c.color || "#69639E"
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODALS */}
      {addOpen && (
        <AddClusterModal
          open={addOpen}
          onClose={() => {
            setAddOpen(false);
            setName("");
            setIpAddress("");
            setSubnetMask("255.255.255.0");
            setSelectedColor("#69639E");
            setCreateError("");
          }}
          handleCreate={handleCreate}
          name={name}
          setName={setName}
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
          subnetMask={subnetMask}
          setSubnetMask={setSubnetMask}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          saving={saving}
          error={createError}
        />
      )}

      {/* View/Edit Modal - Derive active cluster from ID */}
      {viewClusterId && (() => {
        const activeCluster = clusters.find(c => c.id === viewClusterId);
        return activeCluster ? (
          <ClusterModal
            cluster={activeCluster}
            onClose={() => setViewClusterId(null)}
            uid={uid}
            allClusters={clusters}
            allNodes={nodes}
            disks={disks}
          />
        ) : null;
      })()}

    </div>
  );
}
/* ---------------------------- Components ---------------------------- */

function StatCard({ label, value, fill }) {
  return (
    <div className={`w-full ${fill ? "flex-1" : "h-24"} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-md group hover:border-[#69639E]/50 transition-all`}>
      <div className={`text-white/70 font-medium tracking-tight ${fill ? "text-sm md:text-xl" : "text-sm"}`}>{label}</div>
      <div className={`text-white font-bold leading-none bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent ${fill ? "text-3xl md:text-7xl" : "text-3xl"}`}>{value}</div>
    </div>
  );
}

/* ---------------------------- Helpers ---------------------------- */

function fmtBytes(bytes) {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 GB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}

function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

/* ------------------------- Logic ------------------------- */
async function recomputeAndPersist({ clusters, disks, nodes }) {
  const GB = 1_000_000_000;
  // ... (Keep existing logic, functionality unchanged, just styling updated)

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
    // const recomputed = allocByDiskName.get(d.disk); // Unused
    const used = Math.min(d.used || 0, Number(d.total || 0)); // Use persisted disk usage
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
  if (writes.length > 0) await Promise.all(writes);
}
