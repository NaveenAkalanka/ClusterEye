import { useState, useMemo, useEffect } from "react";
import { collection, query, where, orderBy, deleteDoc, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { MagnifyingGlass, Plus, Funnel, XCircle, Trash, PencilSimple, Warning, CheckCircle, Cube, HardDrives, CaretCircleRight } from "@phosphor-icons/react";
import AddContainerModal from "../components/AddContainerModal";
import ContainerModal from "../components/ContainerModal";
import FilterModal from "../components/FilterModal";

// Reusing Components from Theme (Matching Nodes.jsx)
function StatCard({ label, value, icon: Icon, fullWidth }) {
  return (
    <div className={`w-full ${fullWidth ? "col-span-1" : ""} bg-gradient-to-br from-[#161D22] via-[#161D22] to-[#69639E]/20 border border-white/5 rounded-xl px-4 flex items-center justify-between shadow-md group hover:border-[#69639E]/50 transition-all h-12`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon size={20} className="text-[#A8C9AD] opacity-50 group-hover:opacity-100 transition-opacity" weight="duotone" />}
        <div className="text-white/70 font-bold text-xs uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-white font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent text-xl">{value}</div>
    </div>
  );
}

export default function Docker() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [viewContainer, setViewContainer] = useState(null);

  // Filtering
  const [showFilter, setShowFilter] = useState(false);
  const [filterNode, setFilterNode] = useState("");

  const user = auth.currentUser;

  // Data Fetching
  const [containers, setContainers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  // Fetch Containers
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "containers"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Client-side sort
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setContainers(data);
      setLoadingContainers(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Nodes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "nodes"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Clusters
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "clusters"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClusters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Derived Stats
  const totalContainers = containers.length;
  const uniqueDockerServers = new Set(containers.map(c => c.nodeId)).size;

  // Filter Logic
  const filteredContainers = useMemo(() => {
    const s = search.toLowerCase();
    return containers.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(s) ||
        (c.containerId && c.containerId.toLowerCase().includes(s)) ||
        (c.port && c.port.toString().includes(s));
      const matchesNode = filterNode ? c.nodeId === filterNode : true;
      return matchesSearch && matchesNode;
    });
  }, [containers, search, filterNode]);

  // Helpers
  const getNodeName = (nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    return node ? node.node : "Unknown Node";
  };

  const getClusterColor = (nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    if (!node || !node.cluster) return "#69639E";
    const cluster = clusters.find(c => c.cluster === node.cluster);
    return cluster ? cluster.color : "#69639E";
  };

  const getNodeIP = (nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId || n.id === nodeId);
    return node ? node.ipAddress : "—";
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">

      {/* TOP CONTROL BODY */}
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
              className={`w-12 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-white/5 ${filterNode ? "text-white border-[#69639E]" : "text-white/70"}`}
            >
              <Funnel size={18} weight={filterNode ? "fill" : "regular"} />
            </button>
            <button
              onClick={() => { setFilterNode(""); setSearch(""); }}
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
            <StatCard label="Docker Servers" value={uniqueDockerServers} icon={HardDrives} fullWidth />
          </div>
        </div>

      </div>

      {/* MAIN CONTENT */}
      <section className="flex-1 bg-[#0D100D] rounded-[20px] p-4 md:p-6 md:h-full md:overflow-y-auto custom-scrollbar h-fit">

        {/* Table Headers (Hidden on mobile) */}
        <div className="hidden md:grid grid-cols-5 text-white/50 text-sm font-semibold mb-4 px-6">
          <span>ID</span>
          <span>Name</span>
          <span>Port</span>
          <span>Server Name</span>
          <span>Server IP</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {loadingContainers ? (
            <div className="flex justify-center items-center h-40 text-white/30 animate-pulse">Loading containers...</div>
          ) : filteredContainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
              <Cube size={48} weight="duotone" className="opacity-20" />
              <div className="text-sm">No containers found</div>
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
                    <div
                      onClick={() => setViewContainer(c)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#69639E] hover:text-[#A8C9AD] flex items-center gap-1 cursor-pointer"
                      title="View Container"
                    >
                      <CaretCircleRight size={22} weight="fill" />
                    </div>
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
                      <CaretCircleRight
                        size={20}
                        weight="fill"
                        onClick={() => setViewContainer(c)}
                        className="text-[#69639E] active:scale-95 transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Row 2: Subtitle (ID & Node) */}
                  <div className="flex items-center gap-3 text-[10px] text-white/50">
                    <span>{c.containerId}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#69639E]"></div>
                      <span>{getNodeName(c.nodeId)}</span>
                    </div>
                  </div>

                  {/* Row 3: Stats Grid (Compact) */}
                  <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/5">
                    <div>
                      <div className="text-[9px] text-white/30 uppercase font-bold">Port</div>
                      <div className="text-xs text-[#A8C9AD]">:{c.port}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/30 uppercase font-bold">IP</div>
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
      {/* Filter Modal Logic Simplified (Inline) */}
      {showFilter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowFilter(false); }}>
          <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Filter Containers</h2>

            <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">By Node</label>
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
            <button onClick={() => setShowFilter(false)} className="w-full mt-6 bg-[#161D22] text-white py-3 rounded-xl font-bold hover:bg-white/10 transition-colors">Close</button>
          </div>
        </div>
      )}

    </div>
  );
}