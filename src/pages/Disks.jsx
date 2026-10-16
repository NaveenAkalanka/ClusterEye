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
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  MagnifyingGlass,
  Funnel,
  XCircle,
  Plus,
  HardDrives,
  Database,
  CirclesThreePlus,
  CaretCircleRight,
  CaretUp,
  CaretDown
} from "@phosphor-icons/react";

import AddDiskModal from "../components/AddDiskModal";
import DiskModal from "../components/DiskModal";
import FilterModal from "../components/FilterModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import { Link } from "react-router-dom";

export default function Disks({ uid }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]); // Needed for delete checks in DiskModal

  // create modal
  const [addOpen, setAddOpen] = useState(false);
  const [diskName, setDiskName] = useState("");
  const [model, setModel] = useState("SSD");
  const [role, setRole] = useState("DATA");
  const [cluster, setCluster] = useState("");
  const [totalGB, setTotalGB] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // view/edit modal
  const [viewDisk, setViewDisk] = useState(null);

  // search/filter
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [filterCluster, setFilterCluster] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  /* ----------------------------- LOAD DATA ----------------------------- */
  useEffect(() => {
    setLoadError(false);
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
      (snap) => setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

    const unsubDisks = onSnapshot(
      query(collection(db, "disks"), where("userId", "==", uid), orderBy("disk")),
      (snap) => {
        setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoadError(true);
        setLoading(false);
      }
    );

    // Need nodes to check allocations
    const unsubNodes = onSnapshot(
      query(collection(db, "nodes"), where("userId", "==", uid)),
      (snap) => setNodes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

    return () => {
      unsubClusters();
      unsubDisks();
      unsubNodes();
    };
  }, [uid, retryKey]);

  /* ----------------------------- CREATE ----------------------------- */
  async function handleCreate() {
    setCreateError("");
    if (!uid) return setCreateError("You must be signed in.");

    const name = diskName.trim();
    const cl = cluster.trim();
    const gb = Number(totalGB);

    if (!name) return setCreateError("Enter a disk name.");
    if (!cl) return setCreateError("Choose a cluster.");
    const selectedCluster = clusters.find((item) => item.cluster === cl);
    if (!selectedCluster) return setCreateError("Selected cluster no longer exists.");
    if (!Number.isFinite(gb) || gb <= 0) return setCreateError("Enter a valid total size in GB.");

    // Dupe check
    if (disks.some(d => (d.disk || "").toLowerCase() === name.toLowerCase())) {
      return setCreateError(`Disk "${name}" already exists.`);
    }

    const totalBytes = Math.round(gb * 1_000_000_000);
    setCreateSaving(true);
    try {
      await addDoc(collection(db, "disks"), {
        userId: uid,
        disk: name,
        model,
        role,
        cluster: cl,
        clusterId: selectedCluster.id,
        total: totalBytes,
        used: 0,
        free: totalBytes,
        nodes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Reset
      setDiskName("");
      setModel("SSD");
      setRole("DATA");
      setCluster("");
      setTotalGB("");
      setAddOpen(false);
    } catch (err) {
      console.error(err);
      setCreateError("Could not create disk.");
    } finally {
      setCreateSaving(false);
    }
  }

  /* ----------------------------- FILTERS ----------------------------- */
  const filteredDisks = useMemo(() => {
    let res = [...disks];

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (d) =>
          (d.disk || "").toLowerCase().includes(q) ||
          (d.cluster || "").toLowerCase().includes(q)
      );
    }

    if (filterCluster) {
      res = res.filter(d => d.cluster === filterCluster);
    }
    if (filterModel) {
      res = res.filter(d => d.model === filterModel);
    }
    if (filterRole) {
      res = res.filter(d => d.role === filterRole);
    }

    if (sortConfig.key) {
      res.sort((a, b) => {
        let A = a[sortConfig.key];
        let B = b[sortConfig.key];

        // Handle numeric fields safely
        if (["total", "used", "free", "nodes"].includes(sortConfig.key)) {
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
  }, [disks, search, filterCluster, filterModel, filterRole, sortConfig]);

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function clearFilters() {
    setSearch("");
    setFilterCluster("");
    setFilterModel("");
    setFilterRole("");
    setSortConfig({ key: null, direction: "asc" });
  }

  const stats = useMemo(() => {
    const totalStorage = disks.reduce((acc, d) => acc + (d.total || 0), 0);
    const freeStorage = disks.reduce((acc, d) => {
      const used = d.used || 0;
      const total = d.total || 0;
      return acc + Math.max(0, total - used);
    }, 0);

    return {
      count: disks.length,
      storage: fmtBytes(totalStorage),
      free: fmtBytes(freeStorage)
    }
  }, [disks]);

  /* ----------------------------- UI ----------------------------- */
  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

      {/* LEFT SIDEBAR */}
      <aside className="w-full lg:w-80 bg-[#0D100D] rounded-3xl p-6 flex flex-col gap-6 shrink-0 border border-white/5 h-fit lg:h-full lg:overflow-y-auto content-scrollbar">

        {/* Search */}
        <div className="relative w-full h-12 rounded-xl p-[2px] bg-gradient-to-r from-[#A8C9AD] to-[#69639E] transition-all">
          <div className="w-full h-full bg-[#161D22] rounded-[10px] flex items-center px-4 gap-3">
            <MagnifyingGlass size={20} className="text-[#A8C9AD]" weight="bold" />
            <input
              type="text"
              placeholder="Search Disks..."
              aria-label="Search disks"
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
            className="col-span-3 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] rounded-xl flex items-center justify-center gap-2 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            <span>Add Disk</span>
          </button>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filter disks"
            className="col-span-1 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <Funnel size={18} />
          </button>
          <button
            onClick={clearFilters}
            aria-label="Clear disk filters"
            className="col-span-1 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3 lg:flex-1">
          <StatCard label="Total Disks" value={stats.count} fill />
          <StatCard label="Total Storage" value={stats.storage} fill />
          <StatCard label="Total Free" value={stats.free} fill />
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-3xl border border-white/5 flex flex-col overflow-hidden relative shadow-2xl">
        <div className="flex-1 overflow-auto p-4 content-scrollbar">
          {loading ? (
            <LoadingState label="Loading disks" rows={6} />
          ) : filteredDisks.length === 0 ? (
            <div className="flex h-full flex-col gap-3 items-center justify-center text-white/70 text-sm">
              <p>{search || filterCluster || filterModel || filterRole ? "No disks match your filters." : clusters.length === 0 ? "Create a cluster before adding disks." : "No disks yet. Add one to define storage capacity."}</p>
              {!search && !filterCluster && !filterModel && !filterRole && (clusters.length === 0 ? <Link to="/clusters" className="text-[#A8C9AD] underline">Create cluster</Link> : <button type="button" onClick={() => setAddOpen(true)} className="text-[#A8C9AD] underline">Add disk</button>)}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header Row (Desktop) */}
              <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_0.5fr_1fr_1fr_1fr_2fr] gap-4 px-6 py-2 text-xs font-bold text-white/50 tracking-wider items-center select-none">
                <button type="button" onClick={() => handleSort("disk")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Disk Name {sortConfig.key === "disk" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("model")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Model {sortConfig.key === "model" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("role")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Role {sortConfig.key === "role" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("cluster")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Cluster {sortConfig.key === "cluster" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("nodes")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Nodes {sortConfig.key === "nodes" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("total")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Total {sortConfig.key === "total" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("used")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Used {sortConfig.key === "used" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <button type="button" onClick={() => handleSort("free")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
                  Free {sortConfig.key === "free" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
                </button>
                <div className="text-left cursor-default">Usage</div>
              </div>

              {/* Rows */}
              {filteredDisks.map(d => (
                <div key={d.id}>
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_0.5fr_1fr_1fr_1fr_2fr] gap-4 bg-[#161D22]/60 hover:bg-[#161D22] rounded-xl h-12 px-6 items-center text-white text-sm font-medium transition-all group border border-white/0 hover:border-white/5">
                    <div className="truncate flex items-center gap-2">
                      <HardDrives size={16} className="text-white/30" />
                      {d.disk}
                    </div>
                    <div className="text-white/70 text-sm font-mono bg-white/5 px-2 py-0.5 rounded w-fit">{d.model}</div>
                    <div className="text-white/70 text-sm">{d.role}</div>
                    <div className="text-white/80 text-sm flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: clusters.find(c => c.cluster === d.cluster)?.color || "#69639E" }}
                      ></div>
                      {d.cluster}
                    </div>
                    <div className="text-white/60 text-sm text-center">{d.nodes || 0}</div>

                    <div className="text-white/70 text-sm font-mono">{fmtBytes(d.total)}</div>
                    <div className="text-white/70 text-sm font-mono">{fmtBytes(d.used || 0)}</div>
                    <div className="text-white/70 text-sm font-mono">{fmtBytes((d.total || 0) - (d.used || 0))}</div>

                    {/* Progress */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#69639E] to-[#A8C9AD] transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (d.used / d.total) * 100 || 0)}%`
                          }}
                        ></div>
                      </div>
                      <div className="text-xs font-mono text-white/50 w-8 text-right">
                        {Math.round((d.used / d.total) * 100) || 0}%
                      </div>
                      <button type="button"
                        onClick={() => setViewDisk(d)}
                        className="text-[#A8C9AD] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded"
                        aria-label={`View ${d.disk}`}
                      >
                        <CaretCircleRight size={20} weight="fill" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden flex flex-col bg-[#161D22]/60 rounded-xl p-4 gap-3 text-white transition-all border border-white/5 group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-[#161D22] to-[#69639E]/30 flex items-center justify-center border border-white/5">
                          <HardDrives size={16} className="text-[#A8C9AD]" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">{d.disk}</div>
                          <div className="text-xs text-white/50 flex gap-2">
                            <span>{d.model}</span>
                            <span>•</span>
                            <span>{d.role}</span>
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setViewDisk(d)} aria-label={`View ${d.disk}`} className="text-[#A8C9AD] p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded">
                        <CaretCircleRight size={24} weight="fill" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        Cluster:
                        <span className="text-white flex items-center gap-1.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: clusters.find(c => c.cluster === d.cluster)?.color || "#69639E" }}
                          ></div>
                          {d.cluster}
                        </span>
                      </div>
                      <div>Nodes: <span className="text-white">{d.nodes || 0}</span></div>
                      <div>Used: <span className="text-white">{fmtBytes(d.used)}</span></div>
                      <div>Free: <span className="text-white">{fmtBytes((d.total || 0) - (d.used || 0))}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODALS */}
      <AddDiskModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setDiskName("");
          setModel("SSD");
          setRole("DATA");
          setCluster("");
          setTotalGB("");
          setCreateError("");
        }}
        handleCreate={handleCreate}
        clusters={clusters}
        disks={disks} // Ensure disks is passed
        disk={diskName} setDisk={setDiskName}
        model={model} setModel={setModel}
        role={role} setRole={setRole}
        cluster={cluster} setCluster={setCluster}
        totalGB={totalGB} setTotalGB={setTotalGB}
        saving={createSaving}
        error={createError}
      />

      {viewDisk && (
        <DiskModal
          disk={viewDisk}
          onClose={() => setViewDisk(null)}
          uid={uid}
          allNodes={nodes}
          clusters={clusters}
          allDisks={disks} // Pass allDisks for validation
        />
      )}

      {filterOpen && (
        <FilterModal
          onClose={() => setFilterOpen(false)}
          clusters={clusters}

          // Active Filters for Disks
          filterCluster={filterCluster}
          setFilterCluster={setFilterCluster}
          filterModel={filterModel}
          setFilterModel={setFilterModel}
          filterRole={filterRole}
          setFilterRole={setFilterRole}

          // Unused
          filterType={null} setFilterType={null}
          filterDisk={null} setFilterDisk={null}
        />
      )}

    </div>
  );
}


function StatCard({ label, value, fill }) {
  return (
    <div className={`w-full ${fill ? "flex-1" : "h-24"} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-md group hover:border-[#69639E]/50 transition-all`}>
      <div className={`text-white/70 font-medium tracking-tight ${fill ? "text-sm md:text-xl" : "text-sm"}`}>{label}</div>
      <div className={`text-white font-bold leading-none bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent ${fill ? "text-3xl md:text-7xl" : "text-3xl"}`}>{value}</div>
    </div>
  );
}

function fmtBytes(bytes) {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 GB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
}
