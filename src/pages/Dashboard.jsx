import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { HardDrives, Graph, CirclesThree, CaretCircleRight, Monitor, Globe, Circuitry, ArrowRight, Cube } from "@phosphor-icons/react";
import CustomSelect from "../components/CustomSelect";
import LoadError from "../components/LoadError";
import { DashboardLoadingState } from "../components/LoadingState";

// --- HELPERS ---
// Decimal (SI) units to match Clusters/Disks/Nodes pages — same dataset must show the same numbers everywhere.
const fmtBytes = (bytes) => {
  const b = Number(bytes || 0);
  const GB = 1_000_000_000;
  const TB = 1_000_000_000_000;
  if (b === 0) return "0 GB";
  if (b < GB) return `${(b / 1_000_000).toFixed(0)} MB`;
  if (b < 1000 * GB) return `${(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`;
  return `${(b / TB).toFixed(1)} TB`;
};

const MATRIX_CLUSTER_STORAGE_PREFIX = "clustereye:dashboard:matrix-cluster:";

function readRememberedCluster(userId) {
  if (!userId) return "";
  try {
    return window.localStorage.getItem(`${MATRIX_CLUSTER_STORAGE_PREFIX}${userId}`) || "";
  } catch {
    return "";
  }
}

function rememberCluster(userId, clusterId) {
  if (!userId) return;
  try {
    const key = `${MATRIX_CLUSTER_STORAGE_PREFIX}${userId}`;
    if (clusterId) window.localStorage.setItem(key, clusterId);
    else window.localStorage.removeItem(key);
  } catch {
    // The selector still works when browser storage is unavailable.
  }
}

function layoutTreemap(items, width, height) {
  const rectangles = [];

  function place(group, x, y, groupWidth, groupHeight) {
    if (group.length === 0 || groupWidth <= 0 || groupHeight <= 0) return;
    if (group.length === 1) {
      rectangles.push({ ...group[0], x, y, width: groupWidth, height: groupHeight });
      return;
    }

    const totalWeight = group.reduce((sum, item) => sum + item.weight, 0);
    const target = totalWeight / 2;
    let runningWeight = 0;
    let splitIndex = 1;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 1; index < group.length; index += 1) {
      runningWeight += group[index - 1].weight;
      const distance = Math.abs(target - runningWeight);
      if (distance < closestDistance) {
        closestDistance = distance;
        splitIndex = index;
      }
    }

    const first = group.slice(0, splitIndex);
    const second = group.slice(splitIndex);
    const firstWeight = first.reduce((sum, item) => sum + item.weight, 0);
    const ratio = totalWeight > 0 ? firstWeight / totalWeight : 0.5;

    if (groupWidth >= groupHeight) {
      const firstWidth = groupWidth * ratio;
      place(first, x, y, firstWidth, groupHeight);
      place(second, x + firstWidth, y, groupWidth - firstWidth, groupHeight);
    } else {
      const firstHeight = groupHeight * ratio;
      place(first, x, y, groupWidth, firstHeight);
      place(second, x, y + firstHeight, groupWidth, groupHeight - firstHeight);
    }
  }

  place(items, 0, 0, width, height);
  return rectangles;
}

function colorWithAlpha(color, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!match) return `rgba(255,255,255,${alpha})`;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function ClusterTreemap({ clusters, nodes }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      setSize({ width: bounds.width, height: bounds.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const items = useMemo(() => {
    const nodesById = new Map();
    const nodesByName = new Map();

    nodes.forEach((node) => {
      if (node.clusterId) {
        const clusterNodes = nodesById.get(node.clusterId) || [];
        clusterNodes.push(node);
        nodesById.set(node.clusterId, clusterNodes);
      } else if (node.cluster) {
        const clusterNodes = nodesByName.get(node.cluster) || [];
        clusterNodes.push(node);
        nodesByName.set(node.cluster, clusterNodes);
      }
    });

    return clusters
      .map((cluster) => {
        const clusterNodes = nodesById.get(cluster.id) || nodesByName.get(cluster.cluster) || [];
        const nodeCount = clusterNodes.length;
        return {
          id: cluster.id,
          name: cluster.cluster || "Unnamed cluster",
          color: cluster.color || "#69639E",
          nodeCount,
          nodes: clusterNodes.map((node, index) => ({
            id: node.id || `${cluster.id}-${index}`,
            name: node.node || node.nodeId || `Node ${index + 1}`,
            weight: 1,
          })),
          weight: nodeCount + 0.35,
        };
      })
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  }, [clusters, nodes]);

  const rectangles = useMemo(
    () => layoutTreemap(items, size.width, size.height),
    [items, size.height, size.width]
  );

  const totalNodes = items.reduce((sum, item) => sum + item.nodeCount, 0);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Cluster distribution: ${clusters.length} clusters containing ${totalNodes} nodes`}
      className="relative h-full min-h-40 w-full overflow-hidden rounded-xl bg-[#161D22]/35"
    >
      {rectangles.map((item) => {
        const showCount = item.width >= 82 && item.height >= 48;
        const showCaption = item.width >= 124 && item.height >= 74;
        const nodeRegions = layoutTreemap(item.nodes, Math.max(0, item.width - 2), Math.max(0, item.height - 2));
        const nodeNames = item.nodes.map((node) => node.name).join(", ");
        return (
          <div
            key={item.id}
            title={`${item.name}: ${item.nodeCount} ${item.nodeCount === 1 ? "node" : "nodes"}${nodeNames ? ` — ${nodeNames}` : ""}`}
            className="absolute overflow-hidden rounded-lg border border-[#0D100D] bg-[#161D22] p-2.5 transition-[left,top,width,height,filter] duration-300 hover:brightness-110"
            style={{
              left: item.x + 1,
              top: item.y + 1,
              width: Math.max(0, item.width - 2),
              height: Math.max(0, item.height - 2),
            }}
          >
            <span className="absolute inset-0 opacity-20" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {nodeRegions.length > 0 && (
              <span className="absolute inset-px overflow-hidden rounded-[7px]" aria-hidden="true">
                {nodeRegions.map((node, index) => (
                  <span
                    key={node.id}
                    className="absolute border border-white/[0.055]"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      backgroundColor: colorWithAlpha(item.color, index % 2 === 0 ? 0.1 : 0.17),
                    }}
                  />
                ))}
              </span>
            )}
            <span className="absolute left-0 top-0 z-10 h-full w-1" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span className="relative z-20 flex h-full min-w-0 flex-col justify-between">
              <span className="truncate text-xs font-semibold text-white" title={item.name}>{item.name}</span>
              {showCount && (
                <span className="flex items-baseline gap-1 tabular-nums">
                  <span className="text-xl font-bold leading-none text-white">{item.nodeCount}</span>
                  {showCaption && <span className="text-[11px] text-white/60">{item.nodeCount === 1 ? "node" : "nodes"}</span>}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ uid }) {
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loaded, setLoaded] = useState({ clusters: false, nodes: false, disks: false, containers: false });
  const [data, setData] = useState({
    clusters: [],
    nodes: [],
    disks: [],
    containers: []
  });

  // Network Matrix State
  const [matrixClusterId, setMatrixClusterId] = useState(() => readRememberedCluster(uid));
  const [matrixSubnet, setMatrixSubnet] = useState("");

  // Load All Data
  useEffect(() => {
    if (!uid) return;
    setLoadError(false);
    setLoaded({ clusters: false, nodes: false, disks: false, containers: false });

    // Correct Query: Root Collection + userId filter (same as Docker.jsx)
    const unsubClusters = onSnapshot(query(collection(db, "clusters"), where("userId", "==", uid)), (snap) => {
      const clusters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(prev => ({ ...prev, clusters }));
      setLoaded(prev => ({ ...prev, clusters: true }));
      if (clusters.length > 0) {
        setMatrixClusterId((current) => clusters.some((cluster) => cluster.id === current) ? current : clusters[0].id);
      }
    }, () => setLoadError(true));

    const unsubNodes = onSnapshot(query(collection(db, "nodes"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, nodes: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      setLoaded(prev => ({ ...prev, nodes: true }));
    }, () => setLoadError(true));

    const unsubDisks = onSnapshot(query(collection(db, "disks"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, disks: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      setLoaded(prev => ({ ...prev, disks: true }));
    }, () => setLoadError(true));

    const unsubContainers = onSnapshot(query(collection(db, "containers"), where("userId", "==", uid)), (snap) => {
      setData(prev => ({ ...prev, containers: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      setLoaded(prev => ({ ...prev, containers: true }));
    }, () => setLoadError(true));

    return () => {
      unsubClusters();
      unsubNodes();
      unsubDisks();
      unsubContainers();
    };
  }, [retryKey, uid]);

  // Keep a valid selection and remember it separately for each account.
  useEffect(() => {
    if (!loaded.clusters) return;
    if (data.clusters.length === 0) {
      setMatrixClusterId("");
    } else if (!data.clusters.some((cluster) => cluster.id === matrixClusterId)) {
      setMatrixClusterId(data.clusters[0].id);
    }
  }, [data.clusters, loaded.clusters, matrixClusterId]);

  useEffect(() => {
    if (!loaded.clusters) return;
    rememberCluster(uid, matrixClusterId);
  }, [loaded.clusters, matrixClusterId, uid]);

  // Extract Subnets for selected Cluster (Visual Grouping by /24)
  const availableSubnets = useMemo(() => {
    if (!matrixClusterId) return [];
    const selectedCluster = data.clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster) return [];
    const clusterNodes = data.nodes.filter((node) => node.clusterId
      ? node.clusterId === matrixClusterId
      : node.cluster === selectedCluster.cluster);
    const subnets = new Set();
    if (selectedCluster?.ipAddress) subnets.add(selectedCluster.ipAddress.split(".").slice(0, 3).join("."));
    clusterNodes.forEach(n => {
      if (n.ipAddress) {
        const parts = n.ipAddress.split('.');
        if (parts.length === 4) {
          subnets.add(parts.slice(0, 3).join('.'));
        }
      }
    });
    return Array.from(subnets).sort();
  }, [data.nodes, data.clusters, matrixClusterId]);

  // Auto-select first subnet
  useEffect(() => {
    if (availableSubnets.length > 0 && !availableSubnets.includes(matrixSubnet)) {
      setMatrixSubnet(availableSubnets[0]);
    } else if (availableSubnets.length === 0) {
      setMatrixSubnet("");
    }
  }, [availableSubnets, matrixSubnet]);


  // --- STATS CALCULATION ---
  const nodeStats = useMemo(() => {
    const total = data.nodes.length;
    const vms = data.nodes.filter(n => n.type === 'VM').length;
    const lxc = data.nodes.filter(n => n.type === 'LXC').length;
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

  const diskUsageRows = useMemo(() => data.disks
    .map((disk) => {
      const total = Math.max(0, Number(disk.total || 0));
      const used = Math.max(0, Number(disk.used || 0));
      const free = Math.max(0, total - used);
      const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
      const cluster = data.clusters.find((item) => disk.clusterId
        ? item.id === disk.clusterId
        : item.cluster === disk.cluster);

      return {
        ...disk,
        total,
        used,
        free,
        percent,
        clusterName: cluster?.cluster || disk.cluster || "Unassigned",
        clusterColor: cluster?.color || "#A8C9AD",
      };
    })
    .sort((a, b) => b.percent - a.percent || String(a.disk || "").localeCompare(String(b.disk || ""))),
  [data.clusters, data.disks]);

  const containerStats = useMemo(() => {
    const total = data.containers.length;
    const servers = new Set(data.containers.map(c => c.nodeId)).size;
    return { total, servers };
  }, [data.containers]);

  // Network Matrix Logic
  const matrixActiveIndices = useMemo(() => {
    // Use matrixSubnet to filter
    if (!matrixClusterId || !matrixSubnet) return [];
    const selectedCluster = data.clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster) return [];
    return [...new Set(data.nodes
      .filter((node) => (node.clusterId ? node.clusterId === matrixClusterId : node.cluster === selectedCluster.cluster) && node.ipAddress?.startsWith(matrixSubnet + "."))
      .map(n => {
        if (!n.ipAddress) return -1;
        const parts = n.ipAddress.split('.');
        return parts.length === 4 ? parseInt(parts[3]) : -1;
      }).filter((index) => index >= 1 && index <= 254))];
  }, [data.nodes, data.clusters, matrixClusterId, matrixSubnet]);


  // --- RENDER ---
  if (loadError) {
    return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;
  }

  if (!Object.values(loaded).every(Boolean)) {
    return <DashboardLoadingState />;
  }

  const isEmpty = Object.values(data).every((items) => items.length === 0);

  if (isEmpty) {
    return <EmptyDashboard onStart={() => navigate('/clusters')} />;
  }

  return (
    <main className="flex-1 w-full min-h-0 bg-[#060906] md:bg-transparent overflow-y-auto content-scrollbar md:pb-0 pb-20">

      {/* Bento Grid: 6 columns, 2 rows (fits one page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 min-h-full p-2 pb-6">

        {/* 1. NODE SECTION (2/6) */}
        <div className="lg:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] animate-fadeInUp opacity-0" style={{ animationDelay: '0ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <Graph size={24} className="text-[#A8C9AD]" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Nodes</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col justify-center gap-6 min-h-0 overflow-hidden">
            <div className="flex flex-col shrink-0">
              <span className="text-5xl font-bold text-white leading-none">{nodeStats.total}</span>
              <span className="text-white/40 text-sm tracking-wider">Total Nodes</span>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{nodeStats.vms}</span>
                <span className="text-white/70 text-xs">Total VMs</span>
              </div>
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{nodeStats.lxc}</span>
                <span className="text-white/70 text-xs">Total LXCs</span>
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
        <div className="lg:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] animate-fadeInUp opacity-0" style={{ animationDelay: '100ms' }}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div className="flex min-w-0 items-center gap-3">
              <CirclesThree size={24} className="text-[#69639E]" weight="duotone" />
              <h2 className="text-xl font-bold text-white tracking-wide">Clusters</h2>
            </div>
            <div className="shrink-0 text-right text-[11px] leading-tight text-white/50">
              <span className="block font-mono text-white/80">{data.clusters.length} clusters</span>
              <span>{data.nodes.length} nodes</span>
            </div>
          </div>

          {/* Node-weighted cluster distribution */}
          <div className="flex-1 min-h-0 py-1">
            <ClusterTreemap clusters={data.clusters} nodes={data.nodes} />
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
        <div className="lg:col-span-2 md:col-span-2 bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] animate-fadeInUp opacity-0" style={{ animationDelay: '200ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <HardDrives size={24} className="text-[#A8C9AD]" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Disks</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col justify-center gap-4 min-h-0 overflow-hidden">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-white leading-none">{diskStats.storage}</span>
                <span className="text-white/70 text-xs">Storage</span>
              </div>
              <div className="bg-[#161D22]/50 p-3 rounded-xl border border-white/5">
                <span className="block text-2xl font-bold text-[#A8C9AD] leading-none">{diskStats.free}</span>
                <span className="text-white/70 text-xs">Free</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="bg-[#161D22] w-full h-3 rounded-full overflow-hidden border border-white/5 shrink-0">
              <div
                className="h-full bg-[#A8C9AD] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${diskStats.percent}%` }}
              ></div>
            </div>

            <div className="px-2 shrink-0 flex justify-between items-center">
              <div>
                <span className="text-4xl font-bold text-white">{diskStats.total}</span>
                <span className="text-white/40 text-xs ml-2 tracking-wider">Physical Disks</span>
              </div>
              <span className="text-white/40 text-xs">{diskStats.percent}% used</span>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/disks')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Disks</span>
            <ArrowRight size={18} className="text-[#A8C9AD] group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>


        {/* 4. DISK USAGE SECTION (2/6) */}
        <section className="md:col-span-2 lg:col-span-2 lg:h-[450px] bg-[#0D100D] border border-white/5 rounded-3xl p-5 md:p-6 flex flex-col relative overflow-hidden min-h-[320px] animate-fadeInUp opacity-0" style={{ animationDelay: '250ms' }}>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <HardDrives size={24} className="text-[#A8C9AD]" weight="duotone" />
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white tracking-wide">Disk usage</h2>
                <p className="text-xs text-white/50 mt-0.5">Capacity across every physical disk</p>
              </div>
            </div>
            <div className="font-mono text-xs text-white/60 tabular-nums">
              {fmtBytes(diskUsageRows.reduce((sum, disk) => sum + disk.used, 0))} used of {fmtBytes(diskUsageRows.reduce((sum, disk) => sum + disk.total, 0))}
            </div>
          </div>

          {diskUsageRows.length > 0 ? (
            <div role="list" aria-label="Disk usage" className="flex-1 min-h-0 overflow-y-auto content-scrollbar pr-1">
              <div className="grid grid-cols-1 gap-3">
                {diskUsageRows.map((disk) => (
                  <article key={disk.id} role="listitem" className="min-w-0 rounded-xl bg-[#161D22]/55 px-3 py-2.5 border border-white/5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white" title={disk.disk || "Unnamed disk"}>{disk.disk || "Unnamed disk"}</h3>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-white/50">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: disk.clusterColor }} aria-hidden="true" />
                        <span className="truncate" title={disk.clusterName}>{disk.clusterName}</span>
                        {disk.model && <span className="shrink-0 text-white/35">· {disk.model}</span>}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-white">{disk.percent}%</span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={`${disk.disk || "Disk"} storage used`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={disk.percent}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25"
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${disk.percent}%`, backgroundColor: disk.clusterColor }}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] leading-4 tabular-nums">
                    <div className="min-w-0 truncate">
                      <span className="text-white/40">Used </span>
                      <span className="font-mono text-white/80" title={fmtBytes(disk.used)}>{fmtBytes(disk.used)}</span>
                    </div>
                    <div className="min-w-0 truncate text-center">
                      <span className="text-white/40">Free </span>
                      <span className="font-mono text-white/80" title={fmtBytes(disk.free)}>{fmtBytes(disk.free)}</span>
                    </div>
                    <div className="min-w-0 truncate text-right">
                      <span className="text-white/40">Total </span>
                      <span className="font-mono text-white/80" title={fmtBytes(disk.total)}>{fmtBytes(disk.total)}</span>
                    </div>
                  </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#161D22]/30 px-5 py-10 text-center text-sm text-white/50">
              No disks have been added yet.
            </div>
          )}
        </section>


        {/* 5. NETWORK SECTION (2/6) */}
        <div className="md:col-span-2 lg:col-span-2 lg:h-[450px] bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative group min-h-[450px] animate-fadeInUp opacity-0" style={{ animationDelay: '350ms' }}>
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 shrink-0 relative z-30 gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Globe size={24} className="text-[#A8C9AD]" weight="duotone" />
              <h2 className="text-xl font-bold text-white tracking-wide">Network</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto md:justify-end">
              <div className="flex items-center gap-2 px-3 py-1 bg-[#161D22] border border-white/5 rounded-lg shrink-0">
                <Circuitry size={16} className="text-[#A8C9AD]" />
                <span className="text-white text-xs font-bold">{data.clusters.filter(c => c.ipAddress).length}</span>
                <span className="text-white/70 text-xs">Cluster IPs</span>
              </div>

              {data.clusters.length > 0 && (
                <div className="w-full sm:w-56 md:w-52 xl:w-60 relative z-20 shrink-0">
                  <CustomSelect
                    value={matrixClusterId}
                    onChange={setMatrixClusterId}
                    options={data.clusters.map((cluster) => ({ value: cluster.id, label: cluster.cluster, color: cluster.color }))}
                    placeholder="Select cluster"
                    size="compact"
                    renderOption={(option) => (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color || "#69639E" }} />
                        <span className="truncate">{option.label}</span>
                      </div>
                    )}
                  />
                </div>
              )}

              {availableSubnets.length > 1 && (
                <div className="w-full sm:w-40 relative z-20 shrink-0">
                  <CustomSelect
                    value={matrixSubnet}
                    onChange={setMatrixSubnet}
                    options={availableSubnets.map(s => ({ value: s, label: s + ".0/24" }))}
                    placeholder="Select subnet"
                    size="compact"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Subnet Map Visual */}
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
            <div className="bg-[#161D22]/40 rounded-xl p-3 border border-white/5 shadow-inner h-full flex flex-col">
              <div role="img" aria-label={`${matrixActiveIndices.length} recorded node IPs in ${matrixSubnet || "the selected"} /24 view`} className="grid grid-cols-[repeat(16,minmax(0,1fr))] grid-rows-[repeat(16,minmax(0,1fr))] gap-1 w-full h-full">
                {Array.from({ length: 254 }).map((_, i) => {
                  const index = i + 1;
                  const isActive = matrixActiveIndices.includes(index);
                  return (
                    <div
                      key={index}
                      aria-hidden="true"
                      title={`Host .${index}`}
                      className={`w-full h-full rounded-[1px] transition-all duration-300 ${isActive ? "bg-[#A8C9AD] shadow-[0_0_4px_rgba(168,201,173,0.7)] z-10" : "bg-[#161D22] border border-white/5"}`}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between items-center mt-1 px-1 text-xs text-white/60 font-mono shrink-0">
                <span>1</span><span>254</span>
              </div>
              <div className="text-xs text-white/70 mt-1">Highlighted addresses are recorded, not checked for availability.</div>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/network')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Network</span>
            <ArrowRight size={18} className="text-[#A8C9AD] group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 6. DOCKER SECTION (2/6) */}
        <div className="md:col-span-2 lg:col-span-2 lg:h-[450px] bg-[#0D100D] border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group min-h-[300px] animate-fadeInUp opacity-0" style={{ animationDelay: '450ms' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <Cube size={24} className="text-[#A8C9AD]" weight="duotone" />
            <h2 className="text-xl font-bold text-white tracking-wide">Docker</h2>
          </div>

          {/* Stats */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-10 min-h-0">
            <div className="flex flex-col items-center">
              <span className="text-6xl font-bold text-white">{containerStats.total}</span>
              <span className="text-white/40 text-sm tracking-wider mt-2">Total Containers</span>
            </div>
            <div className="hidden md:block w-[1px] h-20 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <div className="flex items-end gap-2">
                <Monitor size={32} className="text-[#A8C9AD] mb-2" weight="duotone" />
                <span className="text-6xl font-bold text-white">{containerStats.servers}</span>
              </div>
              <span className="text-white/40 text-sm tracking-wider mt-2">Docker Servers</span>
            </div>
          </div>

          {/* Footer / Action */}
          <button
            onClick={() => navigate('/docker')}
            className="mt-4 w-full py-3 bg-[#161D22] hover:bg-[#1c252b] rounded-xl flex items-center justify-between px-6 group/btn transition-all border border-white/5 hover:border-white/10 shrink-0"
          >
            <span className="text-white font-bold text-sm">Go to Docker</span>
            <ArrowRight size={18} className="text-[#A8C9AD] group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </main>
  );
}

function EmptyDashboard({ onStart }) {
  const steps = [
    ["Create a cluster", "Define the network boundary you want to catalog."],
    ["Add storage", "Record the disks available to that cluster."],
    ["Add a node", "Assign an address and storage allocation."],
    ["Add containers", "Catalog the services running on the node."],
  ];

  return (
    <main className="flex-1 min-h-0 overflow-y-auto content-scrollbar p-2 pb-20 md:pb-2">
      <section className="min-h-full rounded-3xl border border-white/10 bg-[#0D100D] px-5 py-10 md:px-10 md:py-14 flex items-center">
        <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
          <div>
            <div className="text-[#A8C9AD] text-xs font-semibold tracking-[0.18em] uppercase mb-4">Inventory setup</div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white text-balance">Build your infrastructure map</h1>
            <p className="mt-4 max-w-lg text-white/70 leading-relaxed">ClusterEye starts with your cluster and builds outward. Add each layer once and the dashboard will summarize the full inventory.</p>
            <button type="button" onClick={onStart} className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#A8C9AD] px-5 py-3 font-semibold text-[#0D100D] transition-colors hover:bg-[#bdd9c1] active:translate-y-px">
              Create your first cluster
              <ArrowRight size={18} weight="bold" />
            </button>
          </div>

          <ol className="grid sm:grid-cols-2 gap-3">
            {steps.map(([title, description], index) => (
              <li key={title} className="rounded-2xl bg-[#161D22]/70 p-5 border border-white/5">
                <div className="font-mono text-xs text-[#A8C9AD] mb-5">0{index + 1}</div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
