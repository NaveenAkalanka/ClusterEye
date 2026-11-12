import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { CaretCircleRight, Funnel, Plus, Warning, XCircle } from "@phosphor-icons/react";
import AddContainerModal from "../components/AddContainerModal";
import ContainerModal from "../components/ContainerModal";
import FilterModal from "../components/FilterModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import SidebarInsight from "../components/SidebarInsight";
import useOpenParam from "../components/useOpenParam";
import { EmptyState, SearchField, SortHeader, StatCard, ToolButton } from "../components/ui";
import { DEFAULT_CLUSTER_COLOR, openOnRowClick, sortRecords } from "../utils/format";
import { Link } from "react-router-dom";

export default function Docker({ user }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [viewContainerId, setViewContainerId] = useState(null);

  // Filtering
  const [showFilter, setShowFilter] = useState(false);
  const [filterNode, setFilterNode] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Data Fetching
  const [containers, setContainers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [loadedNodes, setLoadedNodes] = useState(false);
  const [loadedClusters, setLoadedClusters] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Fetch Containers
  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    setLoadingContainers(true);
    const q = query(collection(db, "containers"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Client-side sort
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setContainers(data);
      setLoadingContainers(false);
    }, () => { setLoadError(true); setLoadingContainers(false); });
    return () => unsubscribe();
  }, [user, retryKey]);

  // Fetch Nodes
  useEffect(() => {
    if (!user) return;
    setLoadedNodes(false);
    const q = query(collection(db, "nodes"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadedNodes(true);
    }, () => setLoadError(true));
    return () => unsubscribe();
  }, [user, retryKey]);

  // Fetch Clusters
  useEffect(() => {
    if (!user) return;
    setLoadedClusters(false);
    const q = query(collection(db, "clusters"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClusters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadedClusters(true);
    }, () => setLoadError(true));
    return () => unsubscribe();
  }, [user, retryKey]);

  // Derived Stats
  const totalContainers = containers.length;
  const uniqueDockerServers = new Set(containers.map(c => c.nodeId)).size;

  // Helpers
  const findNode = useCallback((nodeId) => nodes.find(n => n.nodeId === nodeId || n.id === nodeId), [nodes]);

  const getNodeName = useCallback((nodeId) => findNode(nodeId)?.node || "Unknown Node", [findNode]);

  const getClusterColor = (nodeId) => {
    const node = findNode(nodeId);
    if (!node || !node.cluster) return DEFAULT_CLUSTER_COLOR;
    const cluster = clusters.find(c => c.cluster === node.cluster);
    return cluster ? cluster.color : DEFAULT_CLUSTER_COLOR;
  };

  const getNodeIP = useCallback((nodeId) => findNode(nodeId)?.ipAddress || "—", [findNode]);

  const hostDistribution = useMemo(() => {
    const counts = new Map();
    containers.forEach((c) => counts.set(c.nodeId, (counts.get(c.nodeId) || 0) + 1));
    const max = Math.max(1, ...counts.values());
    return Array.from(counts, ([nodeId, count]) => {
      const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
      const cluster = clusters.find(c => c.cluster === node?.cluster);
      return {
        key: nodeId || "unknown",
        label: node?.node || "Unknown Node",
        color: node ? cluster?.color || "#A8C9AD" : "#D6B77A",
        meta: String(count),
        percentage: (count / max) * 100,
      };
    }).sort((a, b) => b.percentage - a.percentage || a.label.localeCompare(b.label));
  }, [containers, nodes, clusters]);

  // Filter Logic
  const filteredContainers = useMemo(() => {
    const s = search.toLowerCase();
    let res = containers.filter(c => {
      const matchesSearch =
        (c.name || "").toLowerCase().includes(s) ||
        (c.containerId || "").toLowerCase().includes(s) ||
        (c.port && c.port.toString().includes(s));
      const matchesNode = filterNode ? c.nodeId === filterNode : true;
      return matchesSearch && matchesNode;
    });

    return sortRecords(res, sortConfig, (c, key) => {
      if (key === "nodeId") return getNodeName(c.nodeId);
      if (key === "ip") return getNodeIP(c.nodeId);
      return c[key];
    });
  }, [containers, search, filterNode, sortConfig, getNodeName, getNodeIP]);

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function clearFilters() {
    setSearch("");
    setFilterNode("");
    setSortConfig({ key: null, direction: "asc" });
  }

  useOpenParam(containers, !loadingContainers, setViewContainerId);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;

  const hasFilters = Boolean(filterNode);
  const viewContainer = containers.find((c) => c.id === viewContainerId);
  const loading = loadingContainers || !loadedNodes || !loadedClusters;
  const rowColumns = "grid-cols-[0.8fr_1.4fr_0.6fr_1.4fr_minmax(8.5rem,1fr)_2rem]";

  return (
    <div className="telemetry-inventory flex min-h-0 w-full flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">

      {/* LEFT SIDEBAR */}
      <aside className="telemetry-surface flex h-fit w-full shrink-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5 lg:h-full lg:w-72 lg:overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold text-white">Docker</h1>
        </div>

        <SearchField value={search} onChange={setSearch} label="Search containers" placeholder="Name, ID, or Port..." />

        <div className="flex gap-2">
          <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary min-w-0 flex-1">
            <Plus size={16} weight="bold" />
            Add Container
          </button>
          <ToolButton label="Filter Containers" active={hasFilters} onClick={() => setShowFilter(true)}><Funnel size={18} /></ToolButton>
          <ToolButton label="Clear Search and Filters" disabled={!hasFilters && !search && !sortConfig.key} onClick={clearFilters}><XCircle size={18} /></ToolButton>
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid">
          <StatCard label="Containers" value={totalContainers} loading={loading} />
          <StatCard label="Host Nodes" value={uniqueDockerServers} loading={loading} />
        </div>

        <SidebarInsight
          title="Containers by Host"
          description="Relative container count on each node"
          items={hostDistribution}
          emptyMessage="This will fill in after the first container is added."
        />
      </aside>

      {/* MAIN CONTENT */}
      <section aria-label="Container list" className="telemetry-surface h-fit min-w-0 flex-1 rounded-2xl border p-4 lg:h-full lg:overflow-y-auto">

        {/* Table Headers (Hidden on mobile) */}
        {!loading && filteredContainers.length > 0 && (
          <div className={`mb-3 hidden gap-3 px-4 xl:grid ${rowColumns}`}>
            <SortHeader label="ID" sortKey="containerId" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Port" sortKey="port" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Host Node" sortKey="nodeId" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Host IP" sortKey="ip" sortConfig={sortConfig} onSort={handleSort} />
          </div>
        )}

        {/* List */}
        <div className="stagger-rows flex flex-col gap-2">
          {loading ? (
            <LoadingState label="Loading containers" rows={6} />
          ) : filteredContainers.length === 0 ? (
            <EmptyState
              message={search || hasFilters ? "No containers match your search and filters." : nodes.length === 0 ? "Add a node before adding containers." : "No containers yet. Add one to record its port and host."}
              action={search || hasFilters
                ? <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search and Filters</button>
                : nodes.length === 0 ? <Link to="/nodes" className="btn btn-secondary">Go to Nodes</Link>
                : <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary">Add Container</button>}
            />
          ) : (
            filteredContainers.map(c => {
              const unknownHost = !findNode(c.nodeId);
              return (
                <div key={c.id}>
                  {/* DESKTOP ROW */}
                  <div onClick={openOnRowClick(() => setViewContainerId(c.id))} className={`hidden h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-white transition-colors hover:border-line-strong hover:bg-raised-hover xl:grid ${rowColumns}`}>
                    <div className="truncate font-mono text-white/70" title={c.containerId}>{c.containerId || "—"}</div>
                    <div className="truncate" title={c.name}>{c.name}</div>
                    <div className="w-fit rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent">:{c.port}</div>
                    <div className="flex min-w-0 items-center gap-2 font-normal text-white/80">
                      {unknownHost ? <Warning size={14} weight="fill" className="shrink-0 text-caution" aria-hidden="true" /> : <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: getClusterColor(c.nodeId) }} />}
                      <span className={`truncate ${unknownHost ? "text-caution" : ""}`}>{getNodeName(c.nodeId)}</span>
                    </div>
                    <div className="truncate font-mono font-normal text-white/90">{getNodeIP(c.nodeId)}</div>
                    <button type="button" onClick={() => setViewContainerId(c.id)} className="row-open" aria-label={`View ${c.name}`}>
                      <CaretCircleRight size={20} weight="fill" />
                    </button>
                  </div>

                  {/* Mobile View (Card) */}
                  <div onClick={openOnRowClick(() => setViewContainerId(c.id))} className="flex cursor-pointer flex-col gap-2 rounded-xl border border-line bg-raised p-3 text-white xl:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate text-sm font-bold text-white">{c.name}</div>
                      <button type="button" onClick={() => setViewContainerId(c.id)} aria-label={`View ${c.name}`} className="row-open -mr-1 -mt-1">
                        <CaretCircleRight size={20} weight="fill" />
                      </button>
                    </div>

                    <div className="-mt-1 flex min-w-0 items-center gap-3 text-xs text-white/70">
                      <span className="shrink-0 font-mono">{c.containerId}</span>
                      <div className="flex min-w-0 items-center gap-1.5">
                        {unknownHost ? <Warning size={12} weight="fill" className="shrink-0 text-caution" aria-hidden="true" /> : <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: getClusterColor(c.nodeId) }} />}
                        <span className={`truncate ${unknownHost ? "text-caution" : ""}`}>{getNodeName(c.nodeId)}</span>
                      </div>
                    </div>

                    <div className="mt-1 grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
                      <div>
                        <div className="font-semibold text-white/70">Port</div>
                        <div className="font-mono text-accent">:{c.port}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-white/70">Host IP</div>
                        <div className="font-mono text-white/90">{getNodeIP(c.nodeId)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* MODALS */}
      {showAdd && (
        <AddContainerModal
          onClose={() => setShowAdd(false)}
          nodes={nodes}
          containers={containers}
          clusters={clusters}
        />
      )}
      {viewContainer && (
        <ContainerModal
          onClose={() => setViewContainerId(null)}
          container={viewContainer}
          nodes={nodes}
          containers={containers}
        />
      )}
      {showFilter && (
        <FilterModal
          title="Filter Containers"
          onClose={() => setShowFilter(false)}
          nodes={nodes}
          filterNode={filterNode}
          setFilterNode={setFilterNode}
        />
      )}

    </div>
  );
}
