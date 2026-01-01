import { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import { HardDrives, Graph, CirclesThree, CaretCircleRight, Monitor, Globe, Circuitry, ArrowRight, Cube } from "@phosphor-icons/react";
import CustomSelect from "../components/CustomSelect";

// --- HELPERS ---
const fmtBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    clusters: [],
    nodes: [],
    disks: [],
    containers: []
  });

  // Network Matrix State
  const [matrixCluster, setMatrixCluster] = useState("");

  // Load All Data
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Correct Query: Root Collection + userId filter (same as Docker.jsx)
    const unsubClusters = onSnapshot(query(collection(db, "clusters"), where("userId", "==", uid)), (snap) => {
      const clusters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(prev => ({ ...prev, clusters }));
      if (clusters.length > 0 && !matrixCluster) setMatrixCluster(clusters[0].cluster);
    });

    const unsubNodes = onSnapshot(query(collection(db, "nodes"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, nodes: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    const unsubDisks = onSnapshot(query(collection(db, "disks"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, disks: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    const unsubContainers = onSnapshot(query(collection(db, "containers"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, containers: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    return () => {
      unsubClusters();
      unsubNodes();
      unsubDisks();
      unsubContainers();
    };
  }, []);

  // Update default matrix cluster if data loaded late
  useEffect(() => {
    if (data.clusters.length > 0 && !matrixCluster) {
      setMatrixCluster(data.clusters[0].cluster);
    }
  }, [data.clusters, matrixCluster]);


  // --- STATS CALCULATION ---
  const nodeStats = useMemo(() => {
    const total = data.nodes.length;
    const vms = data.nodes.filter(n => n.type === 'VM').length;
    const lxc = data.nodes.filter(n => n.type === 'Container' || n.type === 'LXC').length;
    return { total, vms, lxc };
  }, [data.nodes]);

  const diskStats = useMemo(() => {
    const total = data.disks.length;
    const storageBytes = data.disks.reduce((acc, d) => acc + (d.total || 0), 0);
    const usedBytes = data.disks.reduce((acc, d) => acc + (d.used || 0), 0);
    const freeBytes = storageBytes - usedBytes;
    const percent = storageBytes > 0 ? ((usedBytes / storageBytes) * 100).toFixed(0) : 0;
    return {
      total,
      storage: fmtBytes(storageBytes),
      free: fmtBytes(freeBytes),
      percent
    };
  }, [data.disks]);

  const containerStats = useMemo(() => {
    const total = data.containers.length;
    const servers = new Set(data.containers.map(c => c.nodeId)).size;
    return { total, servers };
  }, [data.containers]);

  // Network Matrix Logic
  const matrixActiveIndices = useMemo(() => {
    if (!matrixCluster) return [];
    return data.nodes
      .filter(n => n.cluster === matrixCluster)
      .map(n => {
        if (!n.ipAddress) return -1;
        const parts = n.ipAddress.split('.');
        return parts.length === 4 ? parseInt(parts[3]) : -1;
      });
  }, [data.nodes, matrixCluster]);


  // --- RENDER ---
  return (
    <div className="flex-1 w-full h-full min-h-0 bg-[#060906] md:bg-transparent overflow-y-auto lg:overflow-hidden content-scrollbar md:pb-0 pb-20">

      {/* Bento Grid: 6 columns, 2 rows (fits one page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 lg:grid-rows-2 gap-4 h-full p-2 pb-6">

        {/* 1. NODE SECTION (2/6) */}
        <div className="lg:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] lg:min-h-0 animate-fadeInUp opacity-0" style={{ animationDelay: '0ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <Graph size={24} className="text-[#A8C9AD]" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Nodes</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col justify-center gap-6 min-h-0 overflow-hidden">
            <div className="flex flex-col shrink-0">
              <span className="text-5xl font-bold text-white leading-none">{nodeStats.total}</span>
              <span className="text-white/40 text-sm uppercase tracking-wider">Total Nodes</span>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{nodeStats.vms}</span>
                <span className="text-white/40 text-[10px] uppercase">Total VMs</span>
              </div>
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{nodeStats.lxc}</span>
                <span className="text-white/40 text-[10px] uppercase">Total LXC</span>
              </div>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/nodes')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Nodes</span>
            <ArrowRight size={18} className="text-[#A8C9AD] group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>


        {/* 2. CLUSTER SECTION (2/6) */}
        <div className="lg:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] lg:min-h-0 animate-fadeInUp opacity-0" style={{ animationDelay: '100ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <CirclesThree size={24} className="text-[#69639E]" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Clusters</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
            <div className="flex items-center gap-6 h-full min-h-0">
              {/* LEFT: Total Count */}
              <div className="flex flex-col items-center justify-center shrink-0 w-1/3 border-r border-white/5 pr-4 h-full">
                <span className="text-6xl font-bold text-white leading-none">{data.clusters.length}</span>
                <span className="text-white/40 text-[10px] uppercase tracking-wider mt-2 text-center">Total Clusters</span>
              </div>

              {/* RIGHT: List */}
              <div className="overflow-y-auto content-scrollbar flex-1 h-full pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 content-center min-h-full">
                  {data.clusters.map(c => (
                    <div key={c.id} className="bg-[#161D22]/50 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color || '#69639E' }}></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-xs font-bold truncate">{c.cluster}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/clusters')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Clusters</span>
            <ArrowRight size={18} className="text-[#69639E] group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>


        {/* 3. DISK SECTION (2/6) */}
        <div className="lg:col-span-2 md:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] lg:min-h-0 animate-fadeInUp opacity-0" style={{ animationDelay: '200ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <HardDrives size={24} className="text-blue-400" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Disks</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col justify-center gap-4 min-h-0 overflow-hidden">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{diskStats.storage}</span>
                <span className="text-white/40 text-[10px] uppercase">Storage</span>
              </div>
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-[#A8C9AD] leading-none">{diskStats.free}</span>
                <span className="text-white/40 text-[10px] uppercase">Free</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="bg-[#161D22] w-full h-3 rounded-full overflow-hidden border border-white/5 shrink-0">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${diskStats.percent}%` }}
              ></div>
            </div>

            <div className="px-2 shrink-0 flex justify-between items-center">
              <div>
                <span className="text-4xl font-bold text-white">{diskStats.total}</span>
                <span className="text-white/40 text-xs ml-2 uppercase tracking-wider">Physical Disks</span>
              </div>
              <span className="text-white/40 text-xs">{diskStats.percent}% Used</span>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/disks')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Disks</span>
            <ArrowRight size={18} className="text-blue-400 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>


        {/* 4. NETWORK SECTION (3/6) */}
        <div className="lg:col-span-3 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] lg:min-h-0 animate-fadeInUp opacity-0" style={{ animationDelay: '300ms' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-3">
              <Globe size={24} className="text-purple-400" weight="duotone" />
              <h2 className="text-xl font-bold text-white tracking-wide">Network</h2>
            </div>
            <div className="flex items-center gap-4">
              {/* Gateway Count */}
              <div className="flex items-center gap-2 px-3 py-1 bg-[#161D22] border border-white/5 rounded-lg">
                <Circuitry size={16} className="text-[#00FF94]" />
                <span className="text-white text-xs font-bold">{data.clusters.filter(c => c.ipAddress).length}</span>
                <span className="text-white/40 text-[10px] uppercase">Gateways</span>
              </div>

              {data.clusters.length > 0 && (
                <div className="w-32">
                  <CustomSelect
                    value={matrixCluster}
                    onChange={setMatrixCluster}
                    options={data.clusters.map(c => c.cluster)}
                    placeholder="Cluster"
                    className="h-8 text-[10px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Subnet Map Visual */}
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
            <div className="bg-[#161D22]/40 rounded-xl p-3 border border-white/5 shadow-inner h-full flex flex-col">
              <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] grid-rows-[repeat(16,minmax(0,1fr))] gap-[2px] w-full h-full">
                {Array.from({ length: 254 }).map((_, i) => {
                  const index = i + 1;
                  const isActive = matrixActiveIndices.includes(index);
                  return (
                    <div
                      key={index}
                      title={`Host .${index}`}
                      className={`w-full h-full rounded-[1px] transition-all duration-300 ${isActive ? "bg-[#00FF94] shadow-[0_0_4px_#00FF94] z-10" : "bg-[#161D22] border border-white/5"}`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between items-center mt-1 px-1 text-[9px] text-white/20 font-mono shrink-0">
                <span>1</span><span>254</span>
              </div>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/network')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Network</span>
            <ArrowRight size={18} className="text-purple-400 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 5. DOCKER SECTION (3/6) */}
        <div className="lg:col-span-3 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] lg:min-h-0 animate-fadeInUp opacity-0" style={{ animationDelay: '400ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <Cube size={24} className="text-orange-400" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Docker</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-10 min-h-0">
            <div className="flex flex-col items-center">
              <span className="text-6xl font-bold text-white">{containerStats.total}</span>
              <span className="text-white/40 text-sm uppercase tracking-wider mt-2">Total Containers</span>
            </div>
            <div className="hidden md:block w-[1px] h-20 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <div className="flex items-end gap-2">
                <Monitor size={32} className="text-orange-400 mb-2" weight="duotone" />
                <span className="text-6xl font-bold text-white">{containerStats.servers}</span>
              </div>
              <span className="text-white/40 text-sm uppercase tracking-wider mt-2">Docker Servers</span>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/docker')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Docker</span>
            <ArrowRight size={18} className="text-orange-400 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </div>
  );
}
