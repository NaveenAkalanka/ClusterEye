import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { MagnifyingGlass, Plus, Funnel, XCircle, Cube, HardDrives, CaretCircleRight, CaretUp, CaretDown } from "@phosphor-icons/react";
import AddContainerModal from "../components/AddContainerModal";
import ContainerModal from "../components/ContainerModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import { Link } from "react-router-dom";
import useDialogFocus from "../components/useDialogFocus";

// Reusing Components from Theme (Matching Nodes.jsx)
function StatCard({ label, value, icon: Icon, fullWidth }) {
  return (
    <div className={`w-full ${fullWidth ? "col-span-1" : ""} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl px-4 flex items-center justify-between shadow-md group hover:border-[#69639E]/50 transition-all h-12`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon size={20} className="text-[#A8C9AD] opacity-50 group-hover:opacity-100 transition-opacity" weight="duotone" />}
        <div className="text-white/70 font-bold text-xs tracking-wider">{label}</div>
      </div>
      <div className="text-white font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent text-xl">{value}</div>
    </div>
  );
}

export default function Docker({ user }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [viewContainer, setViewContainer] = useState(null);

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
  const getNodeName = useCallback((nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    return node ? node.node : "Unknown Node";
  }, [nodes]);

  const getClusterColor = (nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    if (!node || !node.cluster) return "#69639E";
    const cluster = clusters.find(c => c.cluster === node.cluster);
    return cluster ? cluster.color : "#69639E";
  };

  const getNodeIP = useCallback((nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    return node ? node.ipAddress : "—";
  }, [nodes]);

  // Filter Logic
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

    if (sortConfig.key) {
      res.sort((a, b) => {
        let A = a[sortConfig.key];
        let B = b[sortConfig.key];

        // Derived fields logic
        if (sortConfig.key === "nodeId") {
          A = getNodeName(A);
          B = getNodeName(B);
        }

        if (sortConfig.key === "ip") {
          // Sort by Node IP logic might be complex if we don't have it on the object
          // We can look it up
          A = getNodeIP(a.nodeId);
          B = getNodeIP(b.nodeId);
        }

        // Handle numeric fields safely
        if (["port"].includes(sortConfig.key)) {
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

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;



  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">

      {/* TOP CONTROL BODY */}
      <div className="w-full bg-[#0D100D] rounded-3xl p-6 border border-white/5 shrink-0 flex flex-col 2xl:flex-row gap-6 h-auto 2xl:h-auto">

        {/* Left Section: Search & Actions */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 h-auto lg:h-12">
          {/* Search */}
          <div className="relative z-10 w-full lg:flex-1 h-12">
            <div className="w-full h-full rounded-xl p-[2px] bg-gradient-to-r from-[#A8C9AD] to-[#69639E] transition-all">
              <input
                type="text"
                placeholder="Search Containers (Name, ID, Port)..."
                aria-label="Search containers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-full bg-[#161D22] rounded-[10px] px-4 text-white text-base focus:outline-none placeholder:text-white/40"
              />
            </div>
            <div className="absolute right-4 top-3.5 text-[#A8C9AD] opacity-80">
              <MagnifyingGlass size={20} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 h-12 shrink-0 w-full lg:w-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex-1 lg:flex-none lg:px-6 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] rounded-xl flex items-center justify-center gap-2 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-lg cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} weight="bold" />
              <span>Add Container</span>
            </button>
            <button
              onClick={() => setShowFilter(true)}
              aria-label="Filter containers"
              className={`w-12 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-white/5 ${filterNode ? "text-white border-[#69639E]" : "text-white/70"}`}
            >
              <Funnel size={18} weight={filterNode ? "fill" : "regular"} />
            </button>
            <button
              onClick={clearFilters}
              aria-label="Clear container filters"
              className="w-12 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer border border-white/5"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* Right Section: Stats */}
        <div className="flex flex-col sm:flex-row gap-3 2xl:w-auto w-full shrink-0">
          <div className="w-full sm:w-48">
            <StatCard label="Containers" value={totalContainers} icon={Cube} fullWidth />
          </div>
          <div className="w-full sm:w-48">
            <StatCard label="Docker servers" value={uniqueDockerServers} icon={HardDrives} fullWidth />
          </div>
        </div>

      </div>

      {/* MAIN CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-[20px] p-4 md:p-6 md:h-full md:overflow-y-auto custom-scrollbar h-fit">

        {/* Table Headers (Hidden on mobile) */}
        <div className="hidden md:grid grid-cols-5 text-white/50 text-xs font-bold tracking-wider mb-4 px-6 select-none">
          <button type="button" onClick={() => handleSort("containerId")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            ID {sortConfig.key === "containerId" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("name")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Name {sortConfig.key === "name" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("port")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Port {sortConfig.key === "port" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("nodeId")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Server Name {sortConfig.key === "nodeId" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
          <button type="button" onClick={() => handleSort("ip")} className="cursor-pointer hover:text-white flex items-center gap-1 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded-sm">
            Server IP {sortConfig.key === "ip" && (sortConfig.direction === "asc" ? <CaretUp weight="bold" className="text-white" /> : <CaretDown weight="bold" className="text-white" />)}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {loadingContainers || !loadedNodes || !loadedClusters ? (
            <LoadingState label="Loading containers" rows={6} />
          ) : filteredContainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/70 gap-4 py-10">
              <Cube size={48} weight="duotone" className="opacity-20" />
              <div className="text-sm">{search || filterNode ? "No containers match your filters." : nodes.length === 0 ? "Add a node before adding containers." : "No containers yet."}</div>
              {!search && !filterNode && (nodes.length === 0 ? <Link to="/nodes" className="text-sm text-[#A8C9AD] underline">Go to nodes</Link> : <button type="button" onClick={() => setShowAdd(true)} className="text-sm text-[#A8C9AD] underline">Add container</button>)}
            </div>
          ) : (
            filteredContainers.map(c => (
              <div key={c.id}>
                {/* DESKTOP ROW */}
                <div className="hidden md:grid grid-cols-5 bg-[#161D22]/60 hover:bg-[#161D22] rounded-xl h-12 px-6 items-center text-white text-sm font-medium transition-all group border border-white/0 hover:border-white/5">
                  {/* Container ID */}
                  <div className="truncate pr-4 text-white/60 text-sm">
                    {c.containerId || "—"}
                  </div>
                  {/* Name */}
                  <div className="flex items-center gap-3 truncate pr-4">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                      <Cube size={14} weight="fill" />
                    </div>
                    <span className="truncate">{c.name}</span>
                  </div>
                  {/* Port */}
                  <div className="text-[#A8C9AD] bg-[#A8C9AD]/10 px-1.5 py-0.5 rounded w-fit text-xs font-bold">
                    :{c.port}
                  </div>
                  {/* Server Name */}
                  <div className="text-white/80 flex items-center gap-2 truncate pr-4">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getClusterColor(c.nodeId) }} />
                    <span className="truncate">{getNodeName(c.nodeId)}</span>
                  </div>
                  {/* Server IP + Actions */}
                  <div className="flex justify-between items-center text-white/90">
                    <span className="truncate">{getNodeIP(c.nodeId)}</span>
                    <button type="button"
                      onClick={() => setViewContainer(c)}
                      className="text-[#A8C9AD] hover:text-white flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded"
                      aria-label={`View ${c.name}`}
                    >
                      <CaretCircleRight size={22} weight="fill" />
                    </button>
                  </div>
                </div>

                {/* Mobile View (Card) */}
                <div className="md:hidden flex flex-col bg-[#161D22]/60 rounded-xl p-3 gap-2 text-white transition-all border border-white/5 group mt-2">
                  {/* Row 1: Name, Icon, Actions */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <Cube size={16} weight="fill" className="text-blue-400" />
                        {c.name}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setViewContainer(c)} aria-label={`View ${c.name}`} className="text-[#A8C9AD] p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] rounded">
                        <CaretCircleRight size={20} weight="fill" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Subtitle (ID & Node) */}
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    <span>{c.containerId}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#69639E]"></div>
                      <span>{getNodeName(c.nodeId)}</span>
                    </div>
                  </div>

                  {/* Row 3: Stats Grid (Compact) */}
                  <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/5">
                    <div>
                      <div className="text-xs text-white/60 font-bold">Port</div>
                      <div className="text-xs text-[#A8C9AD]">:{c.port}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60 font-bold">IP</div>
                      <div className="text-xs text-white/80">{getNodeIP(c.nodeId)}</div>
                    </div>
                  </div>
                </div>

              </div>
            ))
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
          onClose={() => setViewContainer(null)}
          container={viewContainer}
          nodes={nodes}
          containers={containers}
        />
      )}
      {showFilter && (
        <DockerFilterDialog
          nodes={nodes}
          filterNode={filterNode}
          setFilterNode={setFilterNode}
          onClose={() => setShowFilter(false)}
        />
      )}

    </div>
  );
}

function DockerFilterDialog({ nodes, filterNode, setFilterNode, onClose }) {
  const { dialogRef, onDialogKeyDown } = useDialogFocus(onClose);
  return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Filter containers" tabIndex={-1} onKeyDown={onDialogKeyDown} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Filter Containers</h2>

            <div className="text-xs font-bold text-white/70 tracking-wider mb-2 block">By Node</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setFilterNode("")}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${filterNode === "" ? "bg-[#69639E] border-[#69639E] text-white" : "bg-[#161D22] border-white/5 text-white/60 hover:bg-[#161D22]/80"}`}
              >
                All Nodes
              </button>
              {nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => setFilterNode(n.nodeId)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${filterNode === n.nodeId ? "bg-[#69639E] border-[#69639E] text-white" : "bg-[#161D22] border-white/5 text-white/60 hover:bg-[#161D22]/80"}`}
                >
                  {n.node}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full mt-6 bg-[#161D22] text-white py-3 rounded-xl font-bold hover:bg-white/10 transition-colors">Close</button>
          </div>
        </div>
  );
}
