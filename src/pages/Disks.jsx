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
import { CaretCircleRight, Funnel, Plus, XCircle } from "@phosphor-icons/react";

import AddDiskModal from "../components/AddDiskModal";
import DiskModal from "../components/DiskModal";
import FilterModal from "../components/FilterModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import SidebarInsight from "../components/SidebarInsight";
import useOpenParam from "../components/useOpenParam";
import { EmptyState, SearchField, SortHeader, StatCard, ToolButton } from "../components/ui";
import { DEFAULT_CLUSTER_COLOR, fmtBytes, openOnRowClick, sortRecords } from "../utils/format";
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
  const [viewDiskId, setViewDiskId] = useState(null);

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
      setCreateError("Could not add the disk. Check your connection and try again.");
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

    return sortRecords(res, sortConfig);
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

  const diskDistribution = useMemo(() => [...disks]
    .map((disk) => {
      const total = Math.max(0, Number(disk.total) || 0);
      const used = Math.max(0, Number(disk.used) || 0);
      const percentage = total ? Math.min(100, (used / total) * 100) : 0;
      return {
        key: disk.id,
        label: disk.disk || "Unnamed disk",
        color: percentage >= 85 ? "#D6B77A" : "#A8C9AD",
        meta: `${Math.round(percentage)}% allocated`,
        percentage,
        detail: `${fmtBytes(used)} / ${fmtBytes(total)}`,
      };
    })
    .sort((a, b) => b.percentage - a.percentage || a.label.localeCompare(b.label)), [disks]);

  /* ----------------------------- UI ----------------------------- */
  useOpenParam(disks, !loading, setViewDiskId);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;

  const hasFilters = Boolean(filterCluster || filterModel || filterRole);
  const viewDisk = disks.find((d) => d.id === viewDiskId);
  const clusterColor = (d) => clusters.find(c => c.cluster === d.cluster)?.color || DEFAULT_CLUSTER_COLOR;
  const usedPercent = (d) => (d.total > 0 ? (Number(d.used || 0) / d.total) * 100 : 0);
  const rowColumns = "grid-cols-[minmax(7rem,1.5fr)_3.5rem_4rem_minmax(6rem,1.1fr)_3rem_4.5rem_4.5rem_4.5rem_minmax(5.5rem,1fr)_2rem]";

  return (
    <div className="telemetry-inventory flex min-h-0 w-full flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">

      {/* LEFT SIDEBAR */}
      <aside className="telemetry-surface flex h-fit w-full shrink-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5 lg:h-full lg:w-72 lg:overflow-y-auto">

        <div>
          <h1 className="text-lg font-semibold text-white">Disks</h1>
        </div>

        <SearchField value={search} onChange={setSearch} label="Search disks" placeholder="Search Disks..." />

        <div className="flex gap-2">
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary min-w-0 flex-1">
            <Plus size={16} weight="bold" />
            Add Disk
          </button>
          <ToolButton label="Filter Disks" active={hasFilters} onClick={() => setFilterOpen(true)}><Funnel size={18} /></ToolButton>
          <ToolButton label="Clear Search and Filters" disabled={!hasFilters && !search && !sortConfig.key} onClick={clearFilters}><XCircle size={18} /></ToolButton>
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-2">
          <StatCard label="Total Disks" value={stats.count} primary loading={loading} />
          <StatCard label="Total Storage" value={stats.storage} loading={loading} />
          <StatCard label="Free Capacity" value={stats.free} loading={loading} />
        </div>

        <SidebarInsight
          title="Capacity by Disk"
          description="How much of each disk is allocated"
          items={diskDistribution}
          emptyMessage="Disk capacity will appear after storage is added."
        />
      </aside>

      {/* RIGHT CONTENT */}
      <section aria-label="Disk list" className="telemetry-surface relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <LoadingState label="Loading disks" rows={6} />
          ) : filteredDisks.length === 0 ? (
            <EmptyState
              message={search || hasFilters ? "No disks match your search and filters." : clusters.length === 0 ? "Create a cluster before adding disks." : "No disks yet. Add one to record its storage capacity."}
              action={search || hasFilters
                ? <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search and Filters</button>
                : clusters.length === 0 ? <Link to="/clusters" className="btn btn-secondary">Go to Clusters</Link>
                : <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary">Add Disk</button>}
            />
          ) : (
            <div className="stagger-rows space-y-2">
              {/* Header Row (Desktop) */}
              <div className={`mb-3 hidden items-center gap-3 px-4 xl:grid ${rowColumns}`}>
                <SortHeader label="Disk" sortKey="disk" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Model" sortKey="model" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Role" sortKey="role" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Cluster" sortKey="cluster" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Nodes" sortKey="nodes" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Total" sortKey="total" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Allocated" sortKey="used" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Free" sortKey="free" sortConfig={sortConfig} onSort={handleSort} />
                <div className="text-xs font-semibold text-white/70">Usage</div>
              </div>

              {/* Rows */}
              {filteredDisks.map(d => (
                <div key={d.id}>
                  {/* Desktop Row */}
                  <div onClick={openOnRowClick(() => setViewDiskId(d.id))} className={`hidden h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-white transition-colors hover:border-line-strong hover:bg-raised-hover xl:grid ${rowColumns}`}>
                    <div className="truncate" title={d.disk}>{d.disk}</div>
                    <div className="w-fit rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">{d.model}</div>
                    <div className="text-xs font-normal text-white/80">{d.role}</div>
                    <div className="flex min-w-0 items-center gap-2 font-normal text-white/80">
                      <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor(d) }}></div>
                      <span className="truncate" title={d.cluster}>{d.cluster}</span>
                    </div>
                    <div className="font-mono font-normal text-white/80">{d.nodes || 0}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes(d.total)}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes(d.used || 0)}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes((d.total || 0) - (d.used || 0))}</div>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className={`bar-fill h-full rounded-full transition-[width] duration-500 ${usedPercent(d) >= 85 ? "bg-caution" : "bg-accent"}`} style={{ width: `${Math.min(100, usedPercent(d))}%` }}></div>
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-xs font-normal text-white/70">{Math.round(usedPercent(d))}%</span>
                    </div>
                    <button type="button" onClick={() => setViewDiskId(d.id)} className="row-open" aria-label={`View ${d.disk}`}>
                      <CaretCircleRight size={20} weight="fill" />
                    </button>
                  </div>

                  {/* Mobile Card */}
                  <div onClick={openOnRowClick(() => setViewDiskId(d.id))} className="flex cursor-pointer flex-col gap-3 rounded-xl border border-line bg-raised p-3 text-white xl:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{d.disk}</div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-white/70">
                          <span className="shrink-0">{d.model} · {d.role} ·</span>
                          <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor(d) }}></div>
                          <span className="truncate">{d.cluster}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setViewDiskId(d.id)} aria-label={`View ${d.disk}`} className="row-open -mr-1 -mt-1">
                        <CaretCircleRight size={20} weight="fill" />
                      </button>
                    </div>
                    <dl className="grid grid-cols-4 gap-x-3 text-xs">
                      {[["Total", fmtBytes(d.total)], ["Allocated", fmtBytes(d.used)], ["Free", fmtBytes((d.total || 0) - (d.used || 0))], ["Nodes", d.nodes || 0]].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="font-semibold text-white/70">{label}</dt>
                          <dd className="truncate font-mono text-white/90">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`bar-fill h-full rounded-full ${usedPercent(d) >= 85 ? "bg-caution" : "bg-accent"}`} style={{ width: `${Math.min(100, usedPercent(d))}%` }}></div>
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
        <AddDiskModal
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
          disk={diskName} setDisk={setDiskName}
          model={model} setModel={setModel}
          role={role} setRole={setRole}
          cluster={cluster} setCluster={setCluster}
          totalGB={totalGB} setTotalGB={setTotalGB}
          saving={createSaving}
          error={createError}
        />
      )}

      {viewDisk && (
        <DiskModal
          disk={viewDisk}
          onClose={() => setViewDiskId(null)}
          uid={uid}
          allNodes={nodes}
          clusters={clusters}
          allDisks={disks}
        />
      )}

      {filterOpen && (
        <FilterModal
          title="Filter Disks"
          onClose={() => setFilterOpen(false)}
          clusters={clusters}
          filterCluster={filterCluster}
          setFilterCluster={setFilterCluster}
          filterModel={filterModel}
          setFilterModel={setFilterModel}
          filterRole={filterRole}
          setFilterRole={setFilterRole}
        />
      )}

    </div>
  );
}
