import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Funnel, Warning, XCircle } from "@phosphor-icons/react";
import FilterModal from "../components/FilterModal";
import CustomSelect from "../components/CustomSelect";
import LoadError from "../components/LoadError";
import { DashboardLoadingState } from "../components/LoadingState";
import { EmptyState, SearchField, SortHeader, ToolButton } from "../components/ui";
import { DEFAULT_CLUSTER_COLOR, sortRecords } from "../utils/format";
import { Link } from "react-router-dom";

const NETWORK_CLUSTER_STORAGE_PREFIX = "clustereye:network:matrix-cluster:";

function readRememberedCluster(userId) {
  if (!userId) return "";
  try {
    return window.localStorage.getItem(`${NETWORK_CLUSTER_STORAGE_PREFIX}${userId}`) || "";
  } catch {
    return "";
  }
}

function rememberCluster(userId, clusterId) {
  if (!userId) return;
  try {
    const key = `${NETWORK_CLUSTER_STORAGE_PREFIX}${userId}`;
    if (clusterId) window.localStorage.setItem(key, clusterId);
    else window.localStorage.removeItem(key);
  } catch {
    // The selector still works when browser storage is unavailable.
  }
}

export default function Network({ uid }) {
  const [nodes, setNodes] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loaded, setLoaded] = useState({ nodes: false, clusters: false });
  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState("nodes");
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Matrix State
  const [matrixClusterId, setMatrixClusterId] = useState(() => readRememberedCluster(uid));
  const [matrixSubnet, setMatrixSubnet] = useState("");

  /* ---------------- Data ---------------- */
  useEffect(() => {
    setLoadError(false);
    setLoaded({ nodes: false, clusters: false });
    if (!uid) {
      setNodes([]);
      setClusters([]);
      return;
    }

    const qNodes = query(collection(db, "nodes"), where("userId", "==", uid), orderBy("node"));
    const qClusters = query(collection(db, "clusters"), where("userId", "==", uid), orderBy("cluster"));

    const unsubNodes = onSnapshot(qNodes, (snap) => {
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded((current) => ({ ...current, nodes: true }));
    }, () => setLoadError(true));
    const unsubClusters = onSnapshot(qClusters, (snap) => {
      setClusters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded((current) => ({ ...current, clusters: true }));
    }, () => setLoadError(true));

    return () => { unsubNodes(); unsubClusters(); };
  }, [uid, retryKey]);

  // Keep the matrix on a valid cluster when clusters are added, renamed, or deleted.
  useEffect(() => {
    if (!loaded.clusters) return;
    if (clusters.length === 0) {
      setMatrixClusterId("");
    } else if (!clusters.some((cluster) => cluster.id === matrixClusterId)) {
      setMatrixClusterId(clusters[0].id);
    }
  }, [clusters, loaded.clusters, matrixClusterId]);

  useEffect(() => {
    if (!loaded.clusters) return;
    rememberCluster(uid, matrixClusterId);
  }, [loaded.clusters, matrixClusterId, uid]);

  /* ---------------- Logic: IP Validation ---------------- */
  const validation = useMemo(() => {
    const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

    // SAFE MAPPING
    const nodeIPs = (nodes || []).map(n => n?.ipAddress || "").filter(Boolean);
    const clusterIPs = (clusters || []).map(c => c?.ipAddress || "").filter(Boolean);
    const allIPs = [...nodeIPs, ...clusterIPs];

    const duplicates = allIPs.filter((ip, idx) => ip && allIPs.indexOf(ip) !== idx);

    return {
      isInvalid: (ip) => !ip || !ipRegex.test(ip),
      isDuplicate: (ip) => ip && duplicates.includes(ip)
    };
  }, [nodes, clusters]);

  /* ---------------- Filters ---------------- */
  const filteredData = useMemo(() => {
    const q = (search || "").toLowerCase().trim();

    // SAFE FILTERING
    let nResult = (nodes || []).filter(n =>
      n && (!q || (n.node || "").toLowerCase().includes(q) || (n.ipAddress || "").includes(q))
    );
    let cResult = (clusters || []).filter(c =>
      c && (!q || (c.cluster || "").toLowerCase().includes(q) || (c.ipAddress || "").includes(q))
    );

    // Apply active filters
    if (filterType) nResult = nResult.filter(n => n.type === filterType);
    if (filterCluster) {
      nResult = nResult.filter(n => n.cluster === filterCluster);
      cResult = cResult.filter(c => c.cluster === filterCluster);
    }

    return { nodes: sortRecords(nResult, sortConfig), clusters: sortRecords(cResult, sortConfig) };
  }, [nodes, clusters, search, filterType, filterCluster, sortConfig]);

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function clearFilters() {
    setSearch("");
    setFilterType("");
    setFilterCluster("");
    setSortConfig({ key: null, direction: "asc" });
  }

  // Group recorded node IPs into /24 slices for the inventory map.
  const availableSubnets = useMemo(() => {
    if (!matrixClusterId) return [];

    const selectedCluster = clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster) return [];
    const clusterNodes = nodes.filter((node) => node && (node.clusterId
      ? node.clusterId === matrixClusterId
      : node.cluster === selectedCluster.cluster));
    const subnets = new Set();

    if (selectedCluster?.ipAddress) subnets.add(selectedCluster.ipAddress.split(".").slice(0, 3).join("."));

    clusterNodes.forEach(n => {
      if (n && n.ipAddress) {
        const parts = n.ipAddress.split('.');
        if (parts.length === 4) {
          subnets.add(parts.slice(0, 3).join('.'));
        }
      }
    });
    return Array.from(subnets).sort();
  }, [nodes, clusters, matrixClusterId]);

  // Auto-select first subnet
  useEffect(() => {
    if (availableSubnets.length > 0 && !availableSubnets.includes(matrixSubnet)) {
      setMatrixSubnet(availableSubnets[0]);
    } else if (availableSubnets.length === 0) {
      setMatrixSubnet("");
    }
  }, [availableSubnets, matrixSubnet]);

  /* ---------------- Matrix Logic ---------------- */
  // Which node holds each host address, so hovering a map cell names it.
  const matrixHosts = useMemo(() => {
    const hosts = new Map();
    const selectedCluster = clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster || !matrixSubnet) return hosts;
    nodes.forEach((node) => {
      const inCluster = node.clusterId ? node.clusterId === matrixClusterId : node.cluster === selectedCluster.cluster;
      if (!inCluster || !node.ipAddress?.startsWith(matrixSubnet + ".")) return;
      const host = parseInt(node.ipAddress.split(".")[3]);
      if (host >= 1 && host <= 254) hosts.set(host, [...(hosts.get(host) || []), node.node]);
    });
    return hosts;
  }, [nodes, clusters, matrixClusterId, matrixSubnet]);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;
  if (!loaded.nodes || !loaded.clusters) return <DashboardLoadingState label="Loading network inventory" />;

  const hasFilters = Boolean(filterType || filterCluster);
  const showingNodes = activeTab === "nodes";
  const nodeColumns = "md:grid-cols-[0.6fr_1.5fr_0.6fr_1.4fr_1.1fr_1.4fr]";
  const clusterColumns = "md:grid-cols-[2fr_1fr_1.4fr]";

  const subnetMap = (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Subnet Map</h2>
        <div className="text-xs text-white/70">/24 View</div>
      </div>

      <CustomSelect
        label="Cluster for Subnet Map"
        value={matrixClusterId}
        onChange={setMatrixClusterId}
        options={(clusters || []).map((cluster) => ({
          value: cluster.id,
          label: cluster.cluster || "Unnamed cluster",
          color: cluster.color,
        }))}
        placeholder="Select Cluster"
        clearable={false}
        renderOption={(option) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color || DEFAULT_CLUSTER_COLOR }} />
            <span className="truncate">{option.label}</span>
          </div>
        )}
      />

      {availableSubnets.length > 1 && (
        <CustomSelect
          label="Subnet"
          value={matrixSubnet}
          onChange={setMatrixSubnet}
          options={availableSubnets.map(s => ({ value: s, label: s + ".0/24" }))}
          placeholder="Select Subnet"
          clearable={false}
        />
      )}

      <div role="img" aria-label={`${matrixHosts.size} node IP addresses recorded in the ${matrixSubnet || "selected"} /24 view`} className="rounded-xl border border-line bg-raised/40 p-3">
        <div key={`${matrixClusterId}-${matrixSubnet}`} className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px]">
          {Array.from({ length: 254 }).map((_, i) => {
            const index = i + 1;
            const names = matrixHosts.get(index);
            return (
              <div
                key={index}
                title={`.${index}: ${names ? names.join(", ") : "no record"}`}
                className={`aspect-square rounded-[1px] ${names ? "cell-lit bg-accent" : "border border-line bg-raised"}`}
                style={names ? { "--cell": index } : undefined}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-1 font-mono text-xs text-white/70">
          <div>{matrixSubnet ? matrixSubnet + ".1" : "1"}</div>
          <div>{matrixSubnet ? matrixSubnet + ".254" : "254"}</div>
        </div>
      </div>
      <p className="text-xs text-white/70">{matrixHosts.size} of 254 addresses recorded. Other addresses haven't been checked and may be in use.</p>
    </div>
  );

  return (
    <div className="telemetry-inventory flex min-h-0 w-full flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">

      {/* SIDEBAR */}
      <aside className="telemetry-surface flex h-fit w-full shrink-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5 lg:h-full lg:w-72 lg:overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold text-white">Network</h1>
        </div>

        <SearchField value={search} onChange={setSearch} label="Search network inventory" placeholder="Name or IP Address..." />

        <div className="flex gap-2">
          <div role="group" aria-label="Show records" className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-lg border border-line bg-raised p-1">
            {[["nodes", "Nodes"], ["clusters", "Clusters"]].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md text-xs font-semibold transition-colors ${activeTab === tab ? "bg-accent text-on-accent" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ToolButton label="Filter Network" active={hasFilters} onClick={() => setShowFilter(true)}><Funnel size={18} /></ToolButton>
          <ToolButton label="Clear Search and Filters" disabled={!hasFilters && !search && !sortConfig.key} onClick={clearFilters}><XCircle size={18} /></ToolButton>
        </div>

        <div className="hidden lg:block lg:border-t lg:border-line lg:pt-4">{subnetMap}</div>
      </aside>

      {/* CONTENT */}
      <section aria-label={showingNodes ? "Node addresses" : "Cluster addresses"} className="telemetry-surface flex h-fit min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:p-5 lg:h-full lg:flex-1 lg:overflow-y-auto">

        {/* TABLE HEADERS */}
        {(showingNodes ? filteredData.nodes : filteredData.clusters).length > 0 && (
          <div className={`hidden gap-4 px-4 md:grid ${showingNodes ? nodeColumns : clusterColumns}`}>
            {showingNodes && <SortHeader label="Node ID" sortKey="nodeId" sortConfig={sortConfig} onSort={handleSort} />}
            <SortHeader label="Name" sortKey={showingNodes ? "node" : "cluster"} sortConfig={sortConfig} onSort={handleSort} />
            {showingNodes && <SortHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />}
            {showingNodes && <SortHeader label="Cluster" sortKey="cluster" sortConfig={sortConfig} onSort={handleSort} />}
            {showingNodes
              ? <div className="text-xs font-semibold text-white/70">Subnet Mask</div>
              : <SortHeader label="Subnet Mask" sortKey="subnetMask" sortConfig={sortConfig} onSort={handleSort} />}
            <SortHeader label="IP Address" sortKey="ipAddress" sortConfig={sortConfig} onSort={handleSort} />
          </div>
        )}

        {/* TABLE CONTENT */}
        <div className="stagger-rows flex flex-1 flex-col gap-2">
          {showingNodes ? (
            <>
              {filteredData.nodes.length === 0 && (
                <EmptyState
                  message={nodes.length === 0 ? "No nodes recorded yet." : "No nodes match your search and filters."}
                  action={nodes.length === 0
                    ? <Link to="/nodes" className="btn btn-secondary">Go to Nodes</Link>
                    : <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search and Filters</button>}
                />
              )}
              {filteredData.nodes.map(n => (
                <NetworkRow
                  key={n.id}
                  columns={nodeColumns}
                  name={n.node}
                  nodeId={n.nodeId}
                  type={n.type}
                  ip={n.ipAddress}
                  cluster={n.cluster}
                  clusterColor={(clusters || []).find(c => c.cluster === n.cluster)?.color}
                  subnetMask={(clusters || []).find(c => c.cluster === n.cluster)?.subnetMask}
                  validation={validation}
                />
              ))}
            </>
          ) : (
            <>
              {filteredData.clusters.length === 0 && (
                <EmptyState
                  message={clusters.length === 0 ? "No clusters recorded yet." : "No clusters match your search and filters."}
                  action={clusters.length === 0
                    ? <Link to="/clusters" className="btn btn-secondary">Go to Clusters</Link>
                    : <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search and Filters</button>}
                />
              )}
              {filteredData.clusters.map(c => (
                <NetworkRow
                  key={c.id}
                  columns={clusterColumns}
                  isCluster
                  name={c.cluster}
                  ip={c.ipAddress}
                  subnetMask={c.subnetMask}
                  clusterColor={c.color}
                  validation={validation}
                />
              ))}
            </>
          )}
        </div>
      </section>

      <section aria-label="Subnet map" className="telemetry-surface rounded-2xl border p-4 sm:p-5 lg:hidden">{subnetMap}</section>

      {/* MODALS */}
      {showFilter && (
        <FilterModal
          title="Filter Network"
          onClose={() => setShowFilter(false)}
          clusters={clusters}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCluster={filterCluster}
          setFilterCluster={setFilterCluster}
        />
      )}
    </div>
  );
}

function NetworkRow({ columns, isCluster = false, name, nodeId, type, ip, subnetMask, cluster, clusterColor, validation }) {
  const problem = validation.isInvalid(ip) ? "Invalid IP" : validation.isDuplicate(ip) ? "Duplicate IP" : "";
  const rowTone = problem ? "border-alert/30 bg-alert/10" : "border-line bg-raised hover:border-line-strong hover:bg-raised-hover";
  const address = (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2 font-mono ${problem ? "text-alert" : "text-white/90"}`}>
      <span className="whitespace-nowrap">{ip || "—"}</span>
      {problem && (
        <span className="flex items-center gap-1 whitespace-nowrap font-sans text-xs font-semibold">
          <Warning size={14} weight="fill" aria-hidden="true" />
          {problem}
        </span>
      )}
    </div>
  );
  const nameCell = (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: clusterColor || DEFAULT_CLUSTER_COLOR }}></div>
      <div className="truncate text-sm font-semibold text-white" title={name}>{name}</div>
    </div>
  );

  return (
    <div className={`rounded-xl border transition-colors ${rowTone}`}>
      {/* DESKTOP ROW */}
      <div className={`hidden min-h-12 items-center gap-4 px-4 py-2 text-sm md:grid ${columns}`}>
        {!isCluster && <div className="truncate font-mono text-white/70">{nodeId || "—"}</div>}
        {nameCell}
        {!isCluster && <div className="w-fit rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">{type}</div>}
        {!isCluster && <div className="truncate text-xs text-white/70" title={cluster}>{cluster}</div>}
        <div className="truncate font-mono text-xs text-white/70">{subnetMask || "255.255.255.0"}</div>
        {address}
      </div>

      {/* MOBILE CARD */}
      <div className="flex flex-col gap-2 p-3 text-sm md:hidden">
        <div className="flex items-center justify-between gap-2">
          {nameCell}
          {!isCluster && <div className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">{type}</div>}
        </div>
        {address}
        <div className="truncate text-xs text-white/70">{isCluster ? `Mask ${subnetMask || "255.255.255.0"}` : `${cluster} · ID ${nodeId || "—"}`}</div>
      </div>
    </div>
  );
}
