import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { MagnifyingGlass, Globe, Circuitry, Warning, Funnel, XCircle, CaretUp, CaretDown } from "@phosphor-icons/react";
import FilterModal from "../components/FilterModal";
import CustomSelect from "../components/CustomSelect";
import LoadError from "../components/LoadError";
import { DashboardLoadingState } from "../components/LoadingState";
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

    // SORTING LOGIC
    if (sortConfig.key) {
      const sortFn = (a, b) => {
        let A = a[sortConfig.key];
        let B = b[sortConfig.key];

        // Derived/Specific Sort Handlers
        if (sortConfig.key === "nodeId") {
          // Might need specific handling if numeric or string
        }

        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();

        if (A < B) return sortConfig.direction === "asc" ? -1 : 1;
        if (A > B) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      };

      nResult.sort(sortFn);
      cResult.sort(sortFn);
    }

    return { nodes: nResult, clusters: cResult };
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

  /* ---------------- Matrix Logic ---------------- */ // Matrix Logic
  const matrixActiveIndices = useMemo(() => {
    if (!matrixClusterId || !matrixSubnet) return [];
    const selectedCluster = clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster) return [];

    return [...new Set(nodes
      .filter((node) => node && (node.clusterId
        ? node.clusterId === matrixClusterId
        : node.cluster === selectedCluster.cluster) && node.ipAddress?.startsWith(matrixSubnet + "."))
      .map(n => {
        const parts = n.ipAddress.split('.');
        return parts.length === 4 ? parseInt(parts[3]) : -1;
      }).filter((index) => index >= 1 && index <= 254))];
  }, [nodes, clusters, matrixClusterId, matrixSubnet]);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;
  if (!loaded.nodes || !loaded.clusters) return <DashboardLoadingState label="Loading network inventory" />;


  /* ---------------- UI Components ---------------- */
  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

      {/* SIDEBAR */}
      <aside className="w-full lg:w-80 bg-[#0D100D] rounded-3xl p-6 flex flex-col gap-6 shrink-0 border border-white/5 h-fit lg:h-full lg:overflow-y-auto content-scrollbar">
        {/* Search */}
        <div className="relative w-full h-12 rounded-xl p-[2px] bg-gradient-to-r from-[#A8C9AD] to-[#69639E] transition-all">
          <div className="w-full h-full bg-[#161D22] rounded-[10px] flex items-center px-4 gap-3">
            <MagnifyingGlass size={20} className="text-[#A8C9AD]" weight="bold" />
            <input
              type="text"
              placeholder="Search Network..."
              aria-label="Search network inventory"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-white text-base w-full placeholder:text-white/40 h-full"
            />
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-2 h-10">
          <button
            onClick={() => setShowFilter(true)}
            className="bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center gap-2 text-white/70 hover:text-white transition-all cursor-pointer border border-white/5 text-xs font-bold"
          >
            <Funnel size={16} />
            <span>Filter</span>
          </button>
          <button
            onClick={clearFilters}
            className="bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center gap-2 text-white/70 hover:text-white transition-all cursor-pointer border border-white/5 text-xs font-bold"
          >
            <XCircle size={16} />
            <span>Clear</span>
          </button>
        </div>

        {/* VIEW TABS (Moved from Main Content) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#161D22] rounded-xl w-full border border-white/5 shrink-0">
          <button
            onClick={() => setActiveTab("nodes")}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-center ${activeTab === "nodes" ? "bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            Nodes
          </button>
          <button
            onClick={() => setActiveTab("clusters")}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-center ${activeTab === "clusters" ? "bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            Clusters
          </button>
        </div>

        {/* Stats - Compact for Sidebar */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Nodes" value={(nodes || []).length} icon={Circuitry} compact />
          <StatCard label="Clusters" value={(clusters || []).length} icon={Globe} compact />
        </div>

        {/* NETWORK MATRIX */}
        <div className="flex flex-col gap-3 mt-auto border-t border-white/5 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white/50 font-bold text-xs tracking-wider">Subnet Map</h3>
            <div className="text-xs text-white/60 font-mono">/24 inventory view</div>
          </div>

          <div className="relative z-20">
            <CustomSelect
              value={matrixClusterId}
              onChange={setMatrixClusterId}
              options={(clusters || []).map((cluster) => ({
                value: cluster.id,
                label: cluster.cluster || "Unnamed cluster",
                color: cluster.color,
              }))}
              placeholder="Select Cluster"
              size="compact"
              renderOption={(option) => (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color || "#69639E" }} />
                  <span className="truncate">{option.label}</span>
                </div>
              )}
            />
          </div>

          {availableSubnets.length > 1 && (
            <div className="relative z-10 -mt-2">
              <CustomSelect
                value={matrixSubnet}
                onChange={setMatrixSubnet}
                options={availableSubnets.map(s => ({ value: s, label: s + ".0/24" }))}
                placeholder="Select Subnet"
                size="compact"
              />
            </div>
          )}

          <div role="img" aria-label={`${matrixActiveIndices.length} node IP addresses recorded in ${matrixSubnet || "the selected"} /24 view`} className="bg-[#161D22]/40 rounded-xl p-3 border border-white/5 shadow-inner">
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 254 }).map((_, i) => {
                const index = i + 1;
                const isActive = matrixActiveIndices.includes(index);
                return (
                  <div
                    key={index}
                    title={`Address .${index}: ${isActive ? "recorded node" : "not recorded"}`}
                    aria-hidden="true"
                    className={`h-2 md:h-auto md:aspect-square rounded-[1px] transition-all duration-300 ${isActive ? "bg-[#00FF94] shadow-[0_0_6px_#00FF94] z-10 scale-125" : "bg-[#161D22] border border-white/5"}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between items-center mt-2 px-1 border-t border-white/5 pt-1">
              <div className="text-xs text-white/60 font-mono">{matrixSubnet ? matrixSubnet + ".1" : "1"}</div>
              <div className="text-xs text-white/60 font-mono">{matrixSubnet ? matrixSubnet + ".254" : "254"}</div>
            </div>
          </div>
          <div className="text-xs text-white/70 text-center flex justify-center gap-4">
            <span className="text-[#A8C9AD]">{matrixActiveIndices.length} recorded</span>
            <span>{254 - matrixActiveIndices.length} not recorded</span>
          </div>
        </div>
      </aside>

      {/* CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-3xl border border-white/5 flex flex-col overflow-hidden relative shadow-2xl p-6 gap-6 overflow-y-auto custom-scrollbar">



        {/* TABLE HEADERS */}
        <div className="grid grid-cols-[1.5fr_1fr_1.5fr] md:grid-cols-[0.8fr_1.5fr_0.8fr_1.2fr_1.2fr_1.5fr] gap-4 px-4 text-xs font-bold text-white/50 tracking-wider mb-[-10px] select-none">
          <button type="button" onClick={() => handleSort("nodeId")} className="hidden md:flex cursor-pointer hover:text-white items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Node ID {sortConfig.key === "nodeId" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort(activeTab === "nodes" ? "node" : "cluster")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Name {sortConfig.key === (activeTab === "nodes" ? "node" : "cluster") && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("type")} className="hidden md:flex cursor-pointer hover:text-white items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Type {sortConfig.key === "type" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("cluster")} className="hidden md:flex cursor-pointer hover:text-white items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Cluster {sortConfig.key === "cluster" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("subnetMask")} className="hidden md:flex cursor-pointer hover:text-white items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Subnet Mask {sortConfig.key === "subnetMask" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("ipAddress")} className="text-right md:text-left cursor-pointer hover:text-white flex items-center gap-1 group justify-end md:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            IP Address {sortConfig.key === "ipAddress" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
        </div>

        {/* TABLE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "nodes" ? (
            <div className="flex flex-col gap-2">
              {filteredData.nodes.length === 0 && <div className="text-white/70 text-center py-10">{nodes.length === 0 ? <>No nodes recorded yet. <Link to="/nodes" className="text-[#A8C9AD] underline">Go to nodes</Link></> : "No nodes match your filters."}</div>}
              {filteredData.nodes.map(n => (
                <NetworkRow
                  key={n.id}
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
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredData.clusters.length === 0 && <div className="text-white/70 text-center py-10">{clusters.length === 0 ? <>No clusters recorded yet. <Link to="/clusters" className="text-[#A8C9AD] underline">Create cluster</Link></> : "No clusters match your filters."}</div>}
              {filteredData.clusters.map(c => (
                <NetworkRow
                  key={c.id}
                  name={c.cluster}
                  type="Cluster"
                  ip={c.ipAddress}
                  subnetMask={c.subnetMask}
                  cluster={c.cluster} // Self-referential for color
                  clusterColor={c.color}
                  validation={validation}
                />
              ))}
            </div>
          )}
        </div>

      </section>

      {/* MODALS */}
      {showFilter && (
        <FilterModal
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

function NetworkRow({ name, nodeId, type, ip, subnetMask, cluster, clusterColor, validation }) {
  const isBad = validation.isInvalid(ip);
  const isDup = validation.isDuplicate(ip);
  const statusColor = isBad || isDup ? "text-red-400" : "text-white/70";
  const statusBg = isBad || isDup ? "bg-red-500/10 border-red-500/20" : "bg-[#161D22]/60 hover:bg-[#161D22] border-white/0 hover:border-white/5";

  return (
    <div className={`rounded-xl border transition-all group ${statusBg}`}>
      {/* DESKTOP ROW */}
      <div className="hidden md:grid grid-cols-[0.8fr_1.5fr_0.8fr_1.2fr_1.2fr_1.5fr] gap-4 p-4 items-center">
        {/* Node ID */}
        <div className="text-sm text-white/60 truncate">{nodeId || "—"}</div>
        {/* Name */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: clusterColor || "#69639E" }}></div>
          <div className="text-sm font-bold text-white truncate">{name}</div>
        </div>
        {/* Type */}
        <div>
          <div className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-bold text-white/90 w-fit">{type}</div>
        </div>
        {/* Cluster */}
        <div className="text-xs text-white/50">{cluster}</div>
        {/* Subnet Mask */}
        <div className="text-xs text-white/50 font-mono">{subnetMask || "—"}</div>
        {/* IP */}
        <div className={`text-sm font-mono flex items-center gap-2 ${statusColor}`}>
          {ip}
          {(isBad || isDup) && <Warning size={16} weight="fill" />}
        </div>
      </div>

      {/* MOBILE CARD */}
      <div className="md:hidden flex flex-col gap-3 p-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: clusterColor || "#69639E" }}></div>
            <div className="text-sm font-bold text-white">{name}</div>
          </div>
          <div className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-bold text-white/90">{type}</div>
        </div>

        <div className="flex justify-between items-center border-t border-white/5 pt-2">
          <div className="flex flex-col gap-0.5">
            <div className="text-xs text-white/60 font-mono">{cluster}</div>
            <div className="text-xs text-white/60 font-mono">{nodeId || "—"}</div>
          </div>
          <div className={`text-xs font-mono flex items-center gap-2 ${statusColor}`}>
            {ip}
            {(isBad || isDup) && <Warning size={14} weight="fill" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, fill, compact, icon: Icon }) {
  return (
    <div className={`w-full ${fill ? "flex-1" : compact ? "h-20" : "h-24"} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-md group hover:border-[#69639E]/50 transition-all`}>
      <div className="flex justify-between items-start">
        <div className={`text-white/70 font-medium tracking-tight ${fill ? "text-sm md:text-xl" : compact ? "text-xs" : "text-sm"}`}>{label}</div>
        {Icon && <Icon size={compact ? 18 : 24} className="text-[#A8C9AD] opacity-50 group-hover:opacity-100 transition-opacity" weight="duotone" />}
      </div>
      <div className={`text-white font-bold leading-none bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent ${fill ? "text-3xl md:text-7xl" : compact ? "text-2xl" : "text-3xl"}`}>{value}</div>
    </div>
  );
}
