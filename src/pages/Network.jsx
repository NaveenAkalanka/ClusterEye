import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { MagnifyingGlass, Globe, Circuitry, Warning, Funnel, XCircle } from "@phosphor-icons/react";
import FilterModal from "../components/FilterModal";
import CustomSelect from "../components/CustomSelect";

export default function Network() {
  const [uid, setUid] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState("nodes");
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCluster, setFilterCluster] = useState("");

  const [matrixCluster, setMatrixCluster] = useState("");

  /* ---------------- Auth & Data ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setNodes([]);
      setClusters([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const qNodes = query(collection(db, "nodes"), where("userId", "==", uid), orderBy("node"));
    const qClusters = query(collection(db, "clusters"), where("userId", "==", uid), orderBy("cluster"));

    const unsubNodes = onSnapshot(qNodes, (snap) => setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClusters = onSnapshot(qClusters, (snap) => setClusters(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    setLoading(false);
    return () => { unsubNodes(); unsubClusters(); };
  }, [uid]);

  // Set default matrix cluster
  useEffect(() => {
    if (clusters.length > 0 && !matrixCluster) {
      setMatrixCluster(clusters[0].cluster);
    }
  }, [clusters, matrixCluster]);

  /* ---------------- Logic: IP Validation ---------------- */
  const validation = useMemo(() => {
    const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    const allIPs = [...nodes.map(n => n.ipAddress), ...clusters.map(c => c.ipAddress)];
    const duplicates = allIPs.filter((ip, idx) => ip && allIPs.indexOf(ip) !== idx);

    return {
      isInvalid: (ip) => !ip || !ipRegex.test(ip),
      isDuplicate: (ip) => duplicates.includes(ip)
    };
  }, [nodes, clusters]);

  /* ---------------- Matrix Logic ---------------- */
  const matrixActiveIndices = useMemo(() => {
    if (!matrixCluster) return [];
    return nodes
      .filter(n => n.cluster === matrixCluster)
      .map(n => {
        const parts = n.ipAddress.split('.');
        return parts.length === 4 ? parseInt(parts[3]) : -1;
      });
  }, [nodes, matrixCluster]);

  /* ---------------- Filters ---------------- */
  const filteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    let nResult = nodes.filter(n =>
      (!q || n.node.toLowerCase().includes(q) || n.ipAddress.includes(q))
    );
    let cResult = clusters.filter(c =>
      (!q || c.cluster.toLowerCase().includes(q) || c.ipAddress.includes(q))
    );

    // Apply active filters
    if (filterType) nResult = nResult.filter(n => n.type === filterType);
    if (filterCluster) {
      nResult = nResult.filter(n => n.cluster === filterCluster);
      // For clusters tab, filterCluster just selects that specific cluster
      cResult = cResult.filter(c => c.cluster === filterCluster);
    }

    return { nodes: nResult, clusters: cResult };
  }, [nodes, clusters, search, filterType, filterCluster]);

  function clearFilters() {
    setSearch("");
    setFilterType("");
    setFilterCluster("");
  }

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
              placeholder="Search network..."
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

        {/* Stats - Compact for Sidebar */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Nodes" value={nodes.length} icon={Circuitry} compact />
          <StatCard label="Gateways" value={clusters.length} icon={Globe} compact />
        </div>

        {/* NETWORK MATRIX */}
        <div className="flex flex-col gap-3 mt-auto border-t border-white/5 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white/50 font-bold text-xs uppercase tracking-wider">Subnet Map</h3>
            <div className="text-[10px] text-white/30 font-mono">/24</div>
          </div>

          <CustomSelect
            value={matrixCluster}
            onChange={setMatrixCluster}
            options={clusters.map(c => c.cluster)}
            placeholder="Select Cluster"
            className="w-full"
          />

          <div className="bg-[#161D22]/40 rounded-xl p-3 border border-white/5 shadow-inner">
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 254 }).map((_, i) => {
                const index = i + 1;
                const isActive = matrixActiveIndices.includes(index);
                return (
                  <div
                    key={index}
                    title={`Host .${index}`}
                    className={`h-2 md:h-auto md:aspect-square rounded-[1px] transition-all duration-300 ${isActive ? "bg-[#00FF94] shadow-[0_0_6px_#00FF94] z-10 scale-125" : "bg-[#161D22] border border-white/5"}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between items-center mt-2 px-1 border-t border-white/5 pt-1">
              <div className="text-[9px] text-white/20 font-mono">1</div>
              <div className="text-[9px] text-white/20 font-mono">254</div>
            </div>
          </div>
          <div className="text-[10px] text-white/30 text-center flex justify-center gap-4">
            <span className="text-[#00FF94] drop-shadow-[0_0_3px_#00FF94]">{matrixActiveIndices.length} ACTIVE</span>
            <span>{254 - matrixActiveIndices.length} FREE</span>
          </div>
        </div>
      </aside>

      {/* CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-3xl border border-white/5 flex flex-col overflow-hidden relative shadow-2xl p-6 gap-6 overflow-y-auto custom-scrollbar">

        {/* TABS */}
        <div className="flex gap-1 p-1 bg-[#161D22] rounded-xl w-fit border border-white/5">
          <button
            onClick={() => setActiveTab("nodes")}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "nodes" ? "bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            Nodes Network
          </button>
          <button
            onClick={() => setActiveTab("clusters")}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === "clusters" ? "bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            Cluster Gateways
          </button>
        </div>

        {/* TABLE HEADERS */}
        <div className="grid grid-cols-[1.5fr_1fr_1.5fr] md:grid-cols-[0.8fr_1.5fr_0.8fr_1.2fr_1.5fr] gap-4 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider mb-[-10px]">
          <div className="hidden md:block">Node ID</div>
          <div>Name</div>
          <div className="hidden md:block">Type</div>
          <div className="hidden md:block">Cluster</div>
          <div className="text-right md:text-left">IP Address</div>
        </div>

        {/* TABLE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "nodes" ? (
            <div className="flex flex-col gap-2">
              {filteredData.nodes.length === 0 && <div className="text-white/30 text-center py-10">No nodes found.</div>}
              {filteredData.nodes.map(n => (
                <NetworkRow
                  key={n.id}
                  name={n.node}
                  nodeId={n.nodeId}
                  type={n.type}
                  ip={n.ipAddress}
                  cluster={n.cluster}
                  clusterColor={clusters.find(c => c.cluster === n.cluster)?.color}
                  validation={validation}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredData.clusters.length === 0 && <div className="text-white/30 text-center py-10">No clusters found.</div>}
              {filteredData.clusters.map(c => (
                <NetworkRow
                  key={c.id}
                  name={c.cluster}
                  type="Cluster"
                  ip={c.ipAddress}
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

function NetworkRow({ name, nodeId, type, ip, cluster, clusterColor, validation }) {
  const isBad = validation.isInvalid(ip);
  const isDup = validation.isDuplicate(ip);
  const statusColor = isBad || isDup ? "text-red-400" : "text-white/70";
  const statusBg = isBad || isDup ? "bg-red-500/10 border-red-500/20" : "bg-[#161D22]/60 hover:bg-[#161D22] border-white/0 hover:border-white/5";

  return (
    <div className={`rounded-xl border transition-all group ${statusBg}`}>
      {/* DESKTOP ROW */}
      <div className="hidden md:grid grid-cols-[0.8fr_1.5fr_0.8fr_1.2fr_1.5fr] gap-4 p-4 items-center">
        {/* Node ID */}
        <div className="text-xs font-mono text-white/40 truncate">{nodeId || "—"}</div>
        {/* Name */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: clusterColor || "#69639E" }}></div>
          <div className="text-sm font-bold text-white truncate">{name}</div>
        </div>
        {/* Type */}
        <div>
          <div className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90 w-fit">{type}</div>
        </div>
        {/* Cluster */}
        <div className="text-xs text-white/50">{cluster}</div>
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
          <div className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">{type}</div>
        </div>

        <div className="flex justify-between items-center border-t border-white/5 pt-2">
          <div className="flex flex-col gap-0.5">
            <div className="text-[10px] text-white/40 font-mono">{cluster}</div>
            <div className="text-[9px] text-white/30 font-mono">{nodeId || "—"}</div>
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
