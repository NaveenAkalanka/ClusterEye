import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { HardDrives, Graph, CirclesThree, Globe, ArrowRight, Cube, Warning, CheckCircle } from "@phosphor-icons/react";
import CustomSelect from "../components/CustomSelect";
import LoadError from "../components/LoadError";
import { DashboardLoadingState } from "../components/LoadingState";
import { fmtBytes } from "../utils/format";

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
          color: cluster.color || "#A8C9AD",
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
      aria-label={`${totalNodes} nodes across ${clusters.length} clusters: ${items.map((item) => `${item.name}, ${item.nodeCount}`).join("; ")}`}
      className="relative h-full min-h-40 w-full overflow-hidden rounded-xl lg:min-h-0 bg-raised/35"
    >
      {rectangles.map((item, tileIndex) => {
        const showCount = item.width >= 82 && item.height >= 48;
        const showCaption = item.width >= 124 && item.height >= 74;
        const nodeRegions = layoutTreemap(item.nodes, Math.max(0, item.width - 2), Math.max(0, item.height - 2));
        const nodeNames = item.nodes.map((node) => node.name).join(", ");
        return (
          <div
            key={item.id}
            title={`${item.name}: ${item.nodeCount} ${item.nodeCount === 1 ? "node" : "nodes"}${nodeNames ? ` — ${nodeNames}` : ""}`}
            className="tile-reveal absolute overflow-hidden rounded-lg border border-surface bg-raised p-2.5 transition-[left,top,width,height,filter] duration-300 hover:brightness-110"
            style={{
              "--tile": tileIndex,
              left: item.x + 1,
              top: item.y + 1,
              width: Math.max(0, item.width - 2),
              height: Math.max(0, item.height - 2),
            }}
          >
            <span className="absolute inset-0 opacity-[0.08]" style={{ backgroundColor: item.color }} aria-hidden="true" />
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
                      backgroundColor: colorWithAlpha(item.color, index % 2 === 0 ? 0.05 : 0.09),
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
                  {showCaption && <span className="text-xs text-white/60">{item.nodeCount === 1 ? "node" : "nodes"}</span>}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NodeMixChart({ stats }) {
  const other = Math.max(0, stats.total - stats.vms - stats.lxc);
  const vmPercent = stats.total > 0 ? (stats.vms / stats.total) * 100 : 0;
  const lxcPercent = stats.total > 0 ? (stats.lxc / stats.total) * 100 : 0;
  const gradient = stats.total > 0
    ? `conic-gradient(#A8C9AD 0 ${vmPercent}%, #E29189 ${vmPercent}% ${vmPercent + lxcPercent}%, #626E65 ${vmPercent + lxcPercent}% 100%)`
    : "conic-gradient(#1F2A22 0 100%)";
  const segments = [
    { label: "VM", value: stats.vms, color: "#A8C9AD" },
    { label: "LXC", value: stats.lxc, color: "#E29189" },
    ...(other > 0 ? [{ label: "Other", value: other, color: "#626E65" }] : []),
  ];

  return (
    <div className="flex flex-1 items-center gap-5">
      <div
        role="img"
        aria-label={`${stats.total} nodes: ${stats.vms} virtual machines and ${stats.lxc} LXC containers`}
        className="relative grid size-32 shrink-0 place-items-center rounded-full"
      >
        <span className="donut-ring absolute inset-0 rounded-full" style={{ background: gradient }} aria-hidden="true" />
        <div className="absolute inset-[12px] rounded-full bg-surface" />
        <div className="relative text-center">
          <div className="font-mono text-3xl font-semibold leading-none text-white tabular-nums">{stats.total}</div>
          <div className="mt-1 text-xs font-medium text-white/70">{stats.total === 1 ? "Node" : "Nodes"}</div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 rounded-lg bg-raised/55 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="truncate text-xs text-white/70">{segment.label}</span>
            </div>
            <span className="font-mono text-sm font-semibold text-white tabular-nums">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardHead({ icon, iconClassName = "text-accent", title, subtitle, to, linkLabel }) {
  const CardIcon = icon;
  return (
    <div className="telemetry-card-head mb-3 flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <CardIcon size={20} className={`shrink-0 ${iconClassName}`} weight="duotone" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-white">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-white/70">{subtitle}</p>
        </div>
      </div>
      {to && (
        <Link to={to} aria-label={linkLabel} title={linkLabel} className="row-open">
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
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
    const percent = storageBytes > 0 ? Math.round((usedBytes / storageBytes) * 100) : 0;
    return {
      total,
      storageBytes,
      usedBytes,
      freeBytes,
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
    const servers = new Set(data.containers.map(c => c.nodeId).filter(Boolean)).size;
    return { total, servers };
  }, [data.containers]);

  const dockerDistribution = useMemo(() => {
    const clusterById = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));
    const clusterByName = new Map(data.clusters.map((cluster) => [cluster.cluster, cluster]));
    const nodeByReference = new Map();

    data.nodes.forEach((node) => {
      if (node.id) nodeByReference.set(node.id, node);
      if (node.nodeId) nodeByReference.set(node.nodeId, node);
    });

    const groups = new Map();
    data.containers.forEach((container) => {
      const reference = container.nodeId || "unassigned";
      groups.set(reference, (groups.get(reference) || 0) + 1);
    });

    return Array.from(groups, ([reference, count]) => {
      const node = nodeByReference.get(reference);
      const cluster = node?.clusterId ? clusterById.get(node.clusterId) : clusterByName.get(node?.cluster);
      return {
        id: reference,
        label: node?.node || node?.nodeId || "Unknown Node",
        known: Boolean(node),
        count,
        color: node ? cluster?.color || "#A8C9AD" : "#D6B77A",
      };
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [data.clusters, data.containers, data.nodes]);

  const recordedIpCount = useMemo(() => new Set([
    ...data.clusters.map((cluster) => cluster.ipAddress),
    ...data.nodes.map((node) => node.ipAddress),
  ].filter(Boolean)).size, [data.clusters, data.nodes]);

  const inventorySignals = useMemo(() => {
    const signals = [];
    const highUsageDisks = diskUsageRows.filter((disk) => disk.percent >= 85);
    const unassignedDisks = diskUsageRows.filter((disk) => disk.clusterName === "Unassigned");
    const nodesWithoutAddress = data.nodes.filter((node) => !node.ipAddress);
    const knownNodeReferences = new Set(data.nodes.flatMap((node) => [node.id, node.nodeId]).filter(Boolean));
    const orphanedContainers = data.containers.filter((container) => !container.nodeId || !knownNodeReferences.has(container.nodeId));

    if (highUsageDisks.length > 0) {
      signals.push({
        id: "disk-capacity",
        title: `${highUsageDisks.length} ${highUsageDisks.length === 1 ? "disk is" : "disks are"} above 85%`,
        detail: "Review disk allocations",
        route: "/disks",
      });
    }
    if (nodesWithoutAddress.length > 0) {
      signals.push({
        id: "node-address",
        title: `${nodesWithoutAddress.length} ${nodesWithoutAddress.length === 1 ? "node has" : "nodes have"} no IP address`,
        detail: "Add the missing addresses",
        route: "/nodes",
      });
    }
    if (unassignedDisks.length > 0) {
      signals.push({
        id: "disk-cluster",
        title: `${unassignedDisks.length} ${unassignedDisks.length === 1 ? "disk is" : "disks are"} unassigned`,
        detail: "Assign them to a cluster",
        route: "/disks",
      });
    }
    if (orphanedContainers.length > 0) {
      signals.push({
        id: "container-node",
        title: `${orphanedContainers.length} ${orphanedContainers.length === 1 ? "container needs" : "containers need"} a valid node`,
        detail: "Choose a host on the Docker page",
        route: "/docker",
      });
    }

    return signals;
  }, [data.containers, data.nodes, diskUsageRows]);

  // Which node holds each host address, so hovering a map cell names it.
  const matrixHosts = useMemo(() => {
    const hosts = new Map();
    const selectedCluster = data.clusters.find((cluster) => cluster.id === matrixClusterId);
    if (!selectedCluster || !matrixSubnet) return hosts;
    data.nodes.forEach((node) => {
      const inCluster = node.clusterId ? node.clusterId === matrixClusterId : node.cluster === selectedCluster.cluster;
      if (!inCluster || !node.ipAddress?.startsWith(matrixSubnet + ".")) return;
      const host = parseInt(node.ipAddress.split(".")[3]);
      if (host >= 1 && host <= 254) hosts.set(host, [...(hosts.get(host) || []), node.node]);
    });
    return hosts;
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

  const summary = [
    { label: "Clusters", value: data.clusters.length, detail: `${data.clusters.length === 1 ? "group" : "groups"}`, to: "/clusters" },
    { label: "Nodes", value: nodeStats.total, detail: `${nodeStats.vms} VM · ${nodeStats.lxc} LXC`, to: "/nodes" },
    { label: "Storage", value: diskStats.storage, detail: `${diskStats.total} ${diskStats.total === 1 ? "disk" : "disks"}`, to: "/disks" },
    { label: "Allocated", value: `${diskStats.percent}%`, detail: fmtBytes(diskStats.usedBytes), to: "/disks" },
    { label: "Containers", value: containerStats.total, detail: `on ${containerStats.servers} ${containerStats.servers === 1 ? "host" : "hosts"}`, to: "/docker" },
    { label: "IPs", value: recordedIpCount, detail: "recorded", to: "/network" },
  ];

  return (
    <main className="telemetry-dashboard min-h-0 min-w-0 flex-1 overflow-y-auto lg:-mr-2 lg:[scrollbar-gutter:stable]">

      <div className="stagger-cards grid w-full grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:h-full lg:grid-cols-12 lg:grid-rows-[auto_minmax(14rem,0.7fr)_minmax(20rem,1fr)] lg:pb-0">

        {/* Inventory overview */}
        <section className="telemetry-surface col-span-full rounded-2xl border p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-md">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Infrastructure Overview</h1>
              <p className="mt-1 text-sm text-white/70">A summary of the clusters, nodes, storage, containers, and addresses you've recorded.</p>
            </div>

            <dl className="stagger-rows grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-[52rem] xl:grid-cols-6">
              {summary.map(({ label, value, detail, to }) => (
                <div key={label} className="relative min-w-0 rounded-xl bg-raised/55 px-3 py-3 ring-1 ring-inset ring-line transition-colors hover:bg-raised-hover">
                  <dt className="text-xs font-medium text-white/70">
                    <Link to={to} className="rounded-sm after:absolute after:inset-0 after:content-['']">{label}</Link>
                  </dt>
                  <dd className="mt-2 truncate font-mono text-xl font-semibold leading-none text-white" title={String(value)}>{value}</dd>
                  <dd className="mt-1.5 truncate text-xs text-white/55" title={detail}>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Inventory checks */}
        <section className="telemetry-surface flex min-h-0 flex-col overflow-hidden rounded-2xl border md:col-span-2 lg:col-span-4 xl:col-span-3">
          <CardHead
            icon={inventorySignals.length > 0 ? Warning : CheckCircle}
            iconClassName={inventorySignals.length > 0 ? "text-caution" : "text-accent"}
            title="Inventory Checks"
            subtitle="Capacity and data quality"
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {inventorySignals.length > 0 ? (
              <ul className="stagger-rows grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {inventorySignals.map((signal) => (
                  <li key={signal.id}>
                    <Link
                      to={signal.route}
                      className="group flex min-w-0 items-center justify-between gap-3 rounded-xl bg-raised/60 px-3 py-2 text-left ring-1 ring-inset ring-caution/20 transition-colors hover:bg-raised-hover"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white" title={signal.title}>{signal.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-white/70" title={signal.detail}>{signal.detail}</span>
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-caution transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-white/70">No high-capacity disks or incomplete records found.</p>
            )}
          </div>
        </section>

        {/* Node distribution */}
        <section className="telemetry-surface flex min-h-[260px] flex-col overflow-hidden rounded-2xl border md:col-span-1 lg:col-span-4 lg:min-h-0">
          <CardHead icon={Graph} title="Nodes by Type" subtitle="Virtual machines and LXC containers" to="/nodes" linkLabel="Open Nodes" />
          <div className="flex flex-1 px-5 pb-3">
            <NodeMixChart stats={nodeStats} />
          </div>
        </section>

        {/* Cluster distribution */}
        <section className="telemetry-surface flex min-h-[260px] flex-col overflow-hidden rounded-2xl border md:col-span-1 lg:col-span-4 lg:min-h-0 xl:col-span-5">
          <CardHead icon={CirclesThree} title="Nodes by Cluster" subtitle="Area reflects node count" to="/clusters" linkLabel="Open Clusters" />
          <div className="min-h-0 flex-1 px-5 pb-5">
            <ClusterTreemap clusters={data.clusters} nodes={data.nodes} />
          </div>
        </section>

        {/* Disk capacity */}
        <section className="telemetry-surface flex min-h-[360px] flex-col overflow-hidden rounded-2xl border md:col-span-2 lg:col-span-4 lg:min-h-0">
          <CardHead icon={HardDrives} title="Disk Capacity" subtitle={`${fmtBytes(diskStats.usedBytes)} allocated of ${diskStats.storage}`} to="/disks" linkLabel="Open Disks" />

          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
            <div className="mb-3 shrink-0">
              <div
                role="progressbar"
                aria-label="Combined storage allocated"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={diskStats.percent}
                className="h-2 overflow-hidden rounded-full bg-white/10"
              >
                <div className="bar-fill h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${diskStats.percent}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-xs text-white/70">
                <span>{diskStats.percent}% allocated</span>
                <span>{fmtBytes(diskStats.freeBytes)} free</span>
              </div>
            </div>

            {diskUsageRows.length > 0 ? (
              <ul aria-label="Disk usage" className="stagger-rows min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {diskUsageRows.map((disk) => (
                  <li key={disk.id} className="min-w-0 rounded-xl border border-line bg-raised/55 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white" title={disk.disk || "Unnamed disk"}>{disk.disk || "Unnamed disk"}</h3>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-white/70">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: disk.clusterColor }} aria-hidden="true" />
                          <span className="truncate" title={disk.clusterName}>{disk.clusterName}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 font-mono text-xs font-semibold ${disk.percent >= 85 ? "text-caution" : "text-white"}`}>{disk.percent}%</span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`${disk.disk || "Disk"} storage allocated`}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={disk.percent}
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25"
                    >
                      <div className={`bar-fill h-full rounded-full transition-[width] duration-500 ${disk.percent >= 85 ? "bg-caution" : "bg-accent"}`} style={{ width: `${disk.percent}%` }} />
                    </div>

                    <div className="mt-1.5 text-xs text-white/70">
                      <span className="font-mono text-white/90">{fmtBytes(disk.used)}</span> of <span className="font-mono text-white/90">{fmtBytes(disk.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-raised/30 px-5 py-10 text-center text-sm text-white/70">
                No disks have been added yet.
              </div>
            )}
          </div>
        </section>

        {/* Network map */}
        <section className="telemetry-surface flex min-h-[400px] flex-col overflow-hidden rounded-2xl border md:col-span-2 lg:col-span-4 lg:min-h-0">
          <CardHead icon={Globe} title="Network Map" subtitle={`${matrixHosts.size} of 254 addresses recorded`} to="/network" linkLabel="Open Network" />

          <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 pb-5">
            {data.clusters.length > 0 && (
              <div className="flex shrink-0 gap-2">
                <CustomSelect
                  label="Cluster for Network Map"
                  value={matrixClusterId}
                  onChange={setMatrixClusterId}
                  options={data.clusters.map((cluster) => ({ value: cluster.id, label: cluster.cluster, color: cluster.color }))}
                  placeholder="Select Cluster"
                  size="compact"
                  clearable={false}
                  renderOption={(option) => (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color || "#A8C9AD" }} />
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
                    size="compact"
                    clearable={false}
                  />
                )}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-raised/40 p-3">
              <div key={`${matrixClusterId}-${matrixSubnet}`} role="img" aria-label={`${matrixHosts.size} recorded node IPs in the ${matrixSubnet || "selected"} /24 view`} className="grid h-full min-h-0 w-full flex-1 grid-cols-[repeat(16,minmax(0,1fr))] grid-rows-[repeat(16,minmax(0,1fr))] gap-[3px]">
                {Array.from({ length: 254 }).map((_, i) => {
                  const index = i + 1;
                  const names = matrixHosts.get(index);
                  return (
                    <div
                      key={index}
                      title={`.${index}: ${names ? names.join(", ") : "no record"}`}
                      className={`rounded-[1px] ${names ? "cell-lit bg-accent" : "border border-line bg-raised"}`}
                      style={names ? { "--cell": index } : undefined}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex shrink-0 items-center justify-between font-mono text-xs text-white/70">
                <span>{matrixSubnet ? `${matrixSubnet}.1` : "1"}</span><span>.254</span>
              </div>
            </div>
            <p className="shrink-0 text-xs text-white/70">Other addresses haven't been checked and may be in use.</p>
          </div>
        </section>

        {/* Containers by host */}
        <section className="telemetry-surface flex min-h-[360px] flex-col overflow-hidden rounded-2xl border md:col-span-2 lg:col-span-4 lg:min-h-0">
          <CardHead icon={Cube} title="Containers by Host" subtitle={`${containerStats.total} on ${containerStats.servers} ${containerStats.servers === 1 ? "host" : "hosts"}`} to="/docker" linkLabel="Open Docker" />

          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
            {dockerDistribution.length > 0 ? (
              <ul aria-label="Containers by host" className="stagger-rows min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {dockerDistribution.map((server) => {
                  const maxCount = dockerDistribution[0]?.count || 1;
                  return (
                    <li key={server.id} className="rounded-xl bg-raised/45 px-3 py-2.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`truncate text-sm font-medium ${server.known ? "text-white/80" : "text-caution"}`} title={server.label}>{server.label}</span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-white">{server.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                        <div
                          className="bar-fill h-full min-w-1 rounded-full transition-[width] duration-500"
                          style={{ width: `${(server.count / maxCount) * 100}%`, backgroundColor: server.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-raised/25 px-5 text-center text-sm text-white/70">
                No Docker containers have been added yet.
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

function EmptyDashboard({ onStart }) {
  const steps = [
    ["Create a Cluster", "Set the network boundary you want to record."],
    ["Add Storage", "Record the disks available to that cluster."],
    ["Add a Node", "Assign it an address and disk allocations."],
    ["Add Containers", "Record the services running on each node."],
  ];

  return (
    <main className="telemetry-dashboard flex-1 min-h-0 overflow-y-auto">
      <section className="telemetry-surface flex min-h-full items-center rounded-2xl border px-5 py-10 md:px-10 md:py-14">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white text-balance md:text-4xl">Build Your Infrastructure Map</h1>
            <p className="mt-4 max-w-lg leading-relaxed text-white/70">ClusterEye starts with a cluster and builds outward. Add each layer once and the dashboard summarizes the full inventory.</p>
            <button type="button" onClick={onStart} className="btn btn-primary mt-7 h-11 px-5">
              Create Your First Cluster
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <ol className="stagger-rows grid gap-3 sm:grid-cols-2">
            {steps.map(([title, description], index) => (
              <li key={title} className="rounded-xl border border-line bg-raised/70 p-5">
                <div className="mb-4 font-mono text-xs text-accent">{index + 1}</div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
