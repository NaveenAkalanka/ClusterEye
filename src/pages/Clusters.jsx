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
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { CaretCircleRight, Plus, XCircle } from "@phosphor-icons/react";
import AddClusterModal from "../components/AddClusterModal";
import ClusterModal from "../components/ClusterModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import SidebarInsight from "../components/SidebarInsight";
import useOpenParam from "../components/useOpenParam";
import { EmptyState, SearchField, SortHeader, StatCard, ToolButton } from "../components/ui";
import { DEFAULT_CLUSTER_COLOR, fmtBytes, openOnRowClick, sortRecords } from "../utils/format";
import { isValidSubnetMask } from "../utils/network";

/* ----------------------------- Component ----------------------------- */

export default function Clusters({ uid }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // data
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);

  // create
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [subnetMask, setSubnetMask] = useState("255.255.255.0");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_CLUSTER_COLOR);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // view/edit modal
  const [viewClusterId, setViewClusterId] = useState(null);

  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const recomputeTimer = useRef(null);

  /* ----------------------------- Live data ----------------------------- */
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
        setLoadError(true);
        setLoading(false);
      }
    );

    const unsubDisks = onSnapshot(
      query(collection(db, "disks"), where("userId", "==", uid)),
      (snap) => setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

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
      return setCreateError("Enter a complete IPv4 address, such as 192.168.1.1.");

    if (!isValidSubnetMask(subnetMask))
      return setCreateError("Enter a valid subnet mask, such as 255.255.255.0.");

    // Check duplicates
    const nameExists = clusters.some(
      (c) => (c.cluster || "").toLowerCase() === cluster.toLowerCase()
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
      setCreateError("Could not add the cluster. Check your connection and try again.");
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
          (c.cluster || "").toLowerCase().includes(q) ||
          (c.ipAddress || "").includes(q)
      );
    }

    return sortRecords(res, sortConfig);
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

  const clusterDistribution = useMemo(() => {
    const maxNodes = Math.max(0, ...clusters.map((cluster) => Number(cluster.nodes) || 0));
    return [...clusters]
      .sort((a, b) => (Number(b.nodes) || 0) - (Number(a.nodes) || 0) || (a.cluster || "").localeCompare(b.cluster || ""))
      .map((cluster) => {
        const count = Number(cluster.nodes) || 0;
        return {
          key: cluster.id,
          label: cluster.cluster || "Unnamed cluster",
          color: cluster.color || DEFAULT_CLUSTER_COLOR,
          meta: `${count} ${count === 1 ? "node" : "nodes"}`,
          percentage: maxNodes ? (count / maxNodes) * 100 : 0,
          detail: fmtBytes(cluster.total || 0),
        };
      });
  }, [clusters]);

  /* ------------------------------ UI ------------------------------ */
  useOpenParam(clusters, !loading, setViewClusterId);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;

  const rowColumns = "grid-cols-[0.5rem_minmax(7rem,1.4fr)_minmax(8rem,1fr)_minmax(7rem,1fr)_3rem_4.5rem_4.5rem_4.5rem_3rem_minmax(4rem,1fr)_2rem]";
  const usedPercent = (c) => (c.total > 0 ? (Number(c.used || 0) / c.total) * 100 : 0);

  return (
    <div className="telemetry-inventory flex min-h-0 w-full flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">

      {/* LEFT SIDEBAR */}
      <aside className="telemetry-surface flex h-fit w-full shrink-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5 lg:h-full lg:w-72 lg:overflow-y-auto">

        <div>
          <h1 className="text-lg font-semibold text-white">Clusters</h1>
        </div>

        <SearchField value={search} onChange={setSearch} label="Search clusters" placeholder="Search Clusters..." />

        <div className="flex gap-2">
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary min-w-0 flex-1">
            <Plus size={16} weight="bold" />
            Add Cluster
          </button>
          <ToolButton label="Clear Search and Sorting" disabled={!search && !sortConfig.key} onClick={clearFilters}><XCircle size={18} /></ToolButton>
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-2">
          <StatCard label="Total Clusters" value={stats.count} primary loading={loading} />
          <StatCard label="Total Storage" value={stats.storage} loading={loading} />
          <StatCard label="Total Nodes" value={stats.nodes} loading={loading} />
        </div>

        <SidebarInsight
          title="Nodes per Cluster"
          description="Relative node count, with recorded storage"
          items={clusterDistribution}
          emptyMessage="This will fill in after the first cluster is created."
        />
      </aside>

      {/* RIGHT CONTENT */}
      <section aria-label="Cluster list" className="telemetry-surface relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <LoadingState label="Loading clusters" rows={6} />
          ) : filteredClusters.length === 0 ? (
            <EmptyState
              message={search ? "No clusters match your search." : "Start by creating a cluster. You can then add disks and nodes."}
              action={search
                ? <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search</button>
                : <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary">Add Cluster</button>}
            />
          ) : (
            <div className="stagger-rows space-y-2">
              {/* Header Row (Desktop) */}
              <div className={`mb-3 hidden items-center gap-3 px-4 xl:grid ${rowColumns}`}>
                <div></div>
                <SortHeader label="Cluster" sortKey="cluster" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="IP Address" sortKey="ipAddress" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Subnet Mask" sortKey="subnetMask" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Disks" sortKey="disks" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Total" sortKey="total" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Allocated" sortKey="used" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Free" sortKey="free" sortConfig={sortConfig} onSort={handleSort} />
                <SortHeader label="Nodes" sortKey="nodes" sortConfig={sortConfig} onSort={handleSort} />
                <div className="text-xs font-semibold text-white/70">Usage</div>
              </div>

              {/* Rows */}
              {filteredClusters.map(c => (
                <div key={c.id}>
                  {/* Desktop Row */}
                  <div onClick={openOnRowClick(() => setViewClusterId(c.id))} className={`hidden h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-white transition-colors hover:border-line-strong hover:bg-raised-hover xl:grid ${rowColumns}`}>
                    <div className="size-2 rounded-full" style={{ backgroundColor: c.color || DEFAULT_CLUSTER_COLOR }}></div>
                    <div className="truncate" title={c.cluster}>{c.cluster}</div>
                    <div className="truncate font-mono font-normal text-white/80">{c.ipAddress || "—"}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/70">{c.subnetMask || "255.255.255.0"}</div>
                    <div className="font-mono font-normal text-white/80">{c.disks || 0}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes(c.total || 0)}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes(c.used || 0)}</div>
                    <div className="truncate font-mono text-xs font-normal text-white/80">{fmtBytes((c.total || 0) - (c.used || 0))}</div>
                    <div className="font-mono font-normal text-white/80">{c.nodes || 0}</div>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="bar-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, usedPercent(c))}%`, backgroundColor: c.color || DEFAULT_CLUSTER_COLOR }}></div>
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-xs font-normal text-white/70">{usedPercent(c).toFixed(0)}%</span>
                    </div>
                    <button type="button" onClick={() => setViewClusterId(c.id)} className="row-open" aria-label={`View ${c.cluster}`}>
                      <CaretCircleRight size={20} weight="fill" />
                    </button>
                  </div>

                  {/* Mobile Card */}
                  <div onClick={openOnRowClick(() => setViewClusterId(c.id))} className="flex cursor-pointer flex-col gap-3 rounded-xl border border-line bg-raised p-3 text-white xl:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color || DEFAULT_CLUSTER_COLOR }}></div>
                        <span className="truncate text-sm font-bold">{c.cluster}</span>
                      </div>
                      <button type="button" onClick={() => setViewClusterId(c.id)} aria-label={`View ${c.cluster}`} className="row-open -mr-1 -mt-1">
                        <CaretCircleRight size={20} weight="fill" />
                      </button>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 md:grid-cols-6">
                      {[["IP Address", c.ipAddress], ["Nodes", c.nodes || 0], ["Disks", c.disks || 0], ["Total", fmtBytes(c.total)], ["Allocated", fmtBytes(c.used)], ["Free", fmtBytes((c.total || 0) - (c.used || 0))]].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className="font-semibold text-white/70">{label}</dt>
                          <dd className="truncate font-mono text-white/90">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-white/70">
                        <span>Usage</span>
                        <span className="font-mono">{usedPercent(c).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="bar-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, usedPercent(c))}%`, backgroundColor: c.color || DEFAULT_CLUSTER_COLOR }}></div>
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
          onClose={() => {
            setAddOpen(false);
            setName("");
            setIpAddress("");
            setSubnetMask("255.255.255.0");
            setSelectedColor(DEFAULT_CLUSTER_COLOR);
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

  // NOTE: disk.used is maintained by Nodes.jsx/NodeModal.jsx in transactions — do NOT
  // overwrite it here or we race with in-flight allocation changes. We only persist
  // derived fields that no one else maintains: free and the node count using each disk.
  const diskUpdates = [];
  for (const d of disks) {
    const entry = allocByDiskName.get(d.disk) || { used: 0, nodeIds: new Set() };
    const usedNow = Number(d.used || 0);
    const free = Math.max(0, Number(d.total || 0) - usedNow);
    const nodesCount = entry.nodeIds.size;
    const need =
      Number(d.free || 0) !== free ||
      Number(d.nodes || 0) !== nodesCount;
    if (need) {
      diskUpdates.push({
        id: d.id,
        data: { free, nodes: nodesCount, updatedAt: serverTimestamp() },
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
