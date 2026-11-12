// src/pages/Nodes.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  runTransaction,
} from "firebase/firestore";
import { CaretCircleRight, Funnel, Plus, XCircle } from "@phosphor-icons/react";
import { db } from "../firebaseConfig";
import { isIpInSubnet, calculateNetworkAddress } from "../utils/network";
import NodeModal from "../components/NodeModal";
import AddNodeModal from "../components/AddNodeModal";
import FilterModal from "../components/FilterModal";
import LoadError from "../components/LoadError";
import LoadingState from "../components/LoadingState";
import SidebarInsight from "../components/SidebarInsight";
import useOpenParam from "../components/useOpenParam";
import { assertIpFree, claimIp, ipIndexRef, syncIpIndex } from "../utils/ipIndex";
import { EmptyState, SearchField, SortHeader, StatCard, ToolButton } from "../components/ui";
import { DEFAULT_CLUSTER_COLOR, fmtBytes, openOnRowClick, sortRecords } from "../utils/format";
import { Link } from "react-router-dom";

export default function Nodes({ uid }) {
  const [clusters, setClusters] = useState([]);
  const [disks, setDisks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewNodeId, setViewNodeId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Add Node form fields
  const [nodeId, setNodeId] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [type, setType] = useState("LXC");
  const [cluster, setCluster] = useState("");
  const [ipAddress, setIpAddress] = useState("");

  const [allocRows, setAllocRows] = useState([]); // always lives here

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCluster, setFilterCluster] = useState("");
  const [filterDisk, setFilterDisk] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  /* ---------------- Load Data ---------------- */
  useEffect(() => {
    setLoadError(false);
    if (!uid) {
      setClusters([]);
      setDisks([]);
      setNodes([]);
      setContainers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubClusters = onSnapshot(
      query(collection(db, "clusters"), where("userId", "==", uid), orderBy("cluster")),
      (snap) => setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

    const unsubDisks = onSnapshot(
      query(collection(db, "disks"), where("userId", "==", uid), orderBy("disk")),
      (snap) => setDisks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

    let indexSynced = false;
    const unsubNodes = onSnapshot(
      query(collection(db, "nodes"), where("userId", "==", uid), orderBy("node")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNodes(rows);
        setLoading(false);
        // Once per visit, claim IPs for nodes saved before the duplicate guard existed.
        if (!indexSynced && !snap.metadata?.fromCache) {
          indexSynced = true;
          syncIpIndex(uid, rows).catch((err) => console.warn("IP index sync skipped:", err.code || err.message));
        }
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );

    const unsubContainers = onSnapshot(
      query(collection(db, "containers"), where("userId", "==", uid)),
      (snap) => setContainers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setLoadError(true)
    );

    return () => {
      unsubClusters();
      unsubDisks();
      unsubNodes();
      unsubContainers();
    };
  }, [uid, retryKey]);

  /* ---------------- Helpers ---------------- */
  function isValidIP(ip) {
    return (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)
    );
  }

  function addAlloc() {
    setAllocRows((prev) => [...prev, { diskId: "", gb: "" }]);
  }

  function removeAlloc(i) {
    setAllocRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function changeAlloc(i, field, value) {
    setAllocRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  /* ---------------- Create Node ---------------- */
  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    if (!uid) return setError("You must be signed in.");
    if (!nodeId.trim()) return setError("Node ID is required.");
    if (!nodeName.trim()) return setError("Node name is required.");
    if (!cluster) return setError("Cluster is required.");
    if (!ipAddress.trim()) return setError("Enter an IP address.");
    if (!isValidIP(ipAddress)) return setError("Enter a complete IPv4 address, such as 192.168.1.20.");

    if (nodeId.length > 50) return setError("Node ID max 50 chars.");
    if (!/^[a-zA-Z0-9-_]+$/.test(nodeId)) return setError("Node ID: letters, numbers, -, _ only.");
    if (nodeName.length > 50) return setError("Node Name max 50 chars.");

    const idExists = nodes.some(
      (n) => n.nodeId?.toLowerCase() === nodeId.trim().toLowerCase()
    );
    if (idExists) return setError("Node ID already exists.");

    const nameExists = nodes.some(
      (n) => n.node?.toLowerCase() === nodeName.trim().toLowerCase()
    );
    if (nameExists) return setError("Node name already exists.");

    if (allocRows.length === 0)
      return setError("Add at least one disk allocation.");

    const clObj = clusters.find((c) => c.cluster === cluster);
    if (!clObj?.ipAddress) return setError("Cluster missing base IP.");

    // Strict Subnet Validation
    const mask = clObj.subnetMask || "255.255.255.0"; // Default to /24 if missing
    if (!isIpInSubnet(ipAddress, clObj.ipAddress, mask)) {
      const requiredNet = calculateNetworkAddress(clObj.ipAddress, mask);
      return setError(`IP must be in the ${requiredNet} network (Mask: ${mask})`);
    }

    // check IP collisions
    const allIPs = [
      ...nodes.map((n) => n.ipAddress),
      ...clusters.map((c) => c.ipAddress),
    ];
    if (allIPs.includes(ipAddress))
      return setError("This IP is already used.");

    // Validate allocations
    const allocations = [];
    for (const r of allocRows) {
      const disk = disks.find((d) => d.id === r.diskId);
      if (!disk) return setError("Choose a disk for each allocation.");

      const gbNum = Number(r.gb);
      if (!gbNum || gbNum <= 0) return setError(`Enter how many GB to allocate on ${disk.disk}.`);

      const freeGB = ((disk.total || 0) - (disk.used || 0)) / 1_000_000_000;
      if (gbNum > freeGB)
        return setError(`${disk.disk} has only ${freeGB.toFixed(1)} GB free.`);

      if (disk.clusterId ? disk.clusterId !== clObj.id : disk.cluster !== cluster)
        return setError(`${disk.disk} is not in the selected cluster.`);
      if (allocations.some((item) => item.diskId === disk.id))
        return setError("Choose each disk only once.");
      allocations.push({ diskId: disk.id, disk: disk.disk, allocatedGB: gbNum });
    }

    // Calculate total allocated bytes
    const totalAllocatedBytes = allocations.reduce(
      (sum, a) => sum + (Number(a.allocatedGB) || 0) * 1_000_000_000,
      0
    );

    const nodePayload = {
      userId: uid,
      nodeId: nodeId.trim(),
      node: nodeName.trim(),
      type,
      cluster,
      clusterId: clObj.id,
      ipAddress: ipAddress.trim(),
      allocations,
      allocated: totalAllocatedBytes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };



    setSaving(true);
    try {
      const newNodeRef = doc(collection(db, "nodes"));
      await runTransaction(db, async (transaction) => {
        // Reads come before writes in a transaction: the IP claim, then the disks.
        const ipSnap = await transaction.get(ipIndexRef(uid, nodePayload.ipAddress));
        assertIpFree(ipSnap, nodePayload.ipAddress, newNodeRef.id);
        const diskRefs = allocations.map((a) => doc(db, "disks", a.diskId));
        const diskSnaps = await Promise.all(diskRefs.map((ref) => transaction.get(ref)));
        allocations.forEach((a, index) => {
          const diskData = diskSnaps[index].data();
          if (!diskData || diskData.userId !== uid) throw new Error(`${a.disk} is no longer available.`);
          if (diskData.clusterId ? diskData.clusterId !== clObj.id : diskData.cluster !== cluster) throw new Error(`${a.disk} is no longer in this cluster.`);
          const used = Number(diskData.used || 0);
          const nextUsed = used + Number(a.allocatedGB) * 1_000_000_000;
          if (nextUsed > Number(diskData.total || 0)) throw new Error(`${a.disk} does not have enough free space.`);
          transaction.update(diskRefs[index], { used: nextUsed, free: Number(diskData.total) - nextUsed });
        });
        transaction.set(newNodeRef, nodePayload);
        claimIp(transaction, ipSnap, uid, nodePayload.ipAddress, newNodeRef.id);
      });
      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not add the node. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setNodeId("");
    setNodeName("");
    setType("LXC");
    setCluster("");
    setIpAddress("");
    setAllocRows([]);
  }

  /* ---------------- Filters ---------------- */
  const filteredNodes = useMemo(() => {
    let result = [...nodes];

    if (search.trim()) {
      const queryText = search.toLowerCase();
      result = result.filter(
        (n) =>
          (n.node || "").toLowerCase().includes(queryText) ||
          (n.nodeId || "").toLowerCase().includes(queryText)
      );
    }

    if (filterType) result = result.filter((n) => n.type === filterType);
    if (filterCluster) result = result.filter((n) => n.cluster === filterCluster);
    if (filterDisk)
      result = result.filter((n) =>
        n.allocations?.some((a) => a.disk === filterDisk)
      );

    return sortRecords(result, sortConfig, (n, key) => (key === "disk" ? n.allocations?.map((x) => x.disk).join(", ") : n[key]));
  }, [nodes, search, filterType, filterCluster, filterDisk, sortConfig]);

  function clearFilters() {
    setSearch("");
    setFilterType("");
    setFilterCluster("");
    setFilterDisk("");
    setSortConfig({ key: null, direction: "asc" });
  }

  function resetAddForm() {
    setNodeId("");
    setNodeName("");
    setType("LXC");
    setCluster("");
    setIpAddress("");
    setAllocRows([]);
    setError("");
  }

  function handleSort(key) {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  const totalNodes = nodes.length;
  const totalVM = nodes.filter((n) => n.type === "VM").length;
  const totalLXC = nodes.filter((n) => n.type === "LXC").length;
  const nodeDistribution = useMemo(() => {
    const clusterItems = clusters.map((cluster) => {
      const count = nodes.filter((node) => node.clusterId
        ? node.clusterId === cluster.id
        : node.cluster === cluster.cluster).length;
      return {
        key: cluster.id,
        label: cluster.cluster || "Unnamed cluster",
        count,
        color: cluster.color || DEFAULT_CLUSTER_COLOR,
      };
    });
    const assignedNodeIds = new Set();
    clusters.forEach((cluster) => {
      nodes.forEach((node) => {
        if (node.clusterId ? node.clusterId === cluster.id : node.cluster === cluster.cluster) assignedNodeIds.add(node.id);
      });
    });
    const unassigned = nodes.filter((node) => !assignedNodeIds.has(node.id)).length;
    if (unassigned > 0) clusterItems.push({ key: "unassigned", label: "Unassigned", count: unassigned, color: "#626E65" });

    return clusterItems
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map((item) => ({
        ...item,
        meta: `${item.count} ${item.count === 1 ? "node" : "nodes"}`,
        percentage: totalNodes ? (item.count / totalNodes) * 100 : 0,
      }));
  }, [clusters, nodes, totalNodes]);

  useOpenParam(nodes, !loading, setViewNodeId);

  if (loadError) return <main className="flex-1 p-4"><LoadError onRetry={() => setRetryKey((key) => key + 1)} /></main>;

  const hasFilters = Boolean(filterType || filterCluster || filterDisk);
  const viewNode = nodes.find((n) => n.id === viewNodeId);
  const clusterColor = (n) => clusters.find((c) => c.cluster === n.cluster)?.color || DEFAULT_CLUSTER_COLOR;
  const rowColumns = "grid-cols-[0.6fr_1.3fr_0.6fr_1.3fr_1.2fr_0.8fr_minmax(8.5rem,1.1fr)_2rem]";

  return (
    <div className="telemetry-inventory flex min-h-0 w-full flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <aside className="telemetry-surface flex h-fit w-full shrink-0 flex-col gap-4 rounded-2xl border p-4 sm:p-5 lg:h-full lg:w-72 lg:overflow-y-auto">

        <div>
          <h1 className="text-lg font-semibold text-white">Nodes</h1>
        </div>

        <SearchField value={search} onChange={setSearch} label="Search nodes" placeholder="Search Nodes..." />

        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary min-w-0 flex-1">
            <Plus size={16} weight="bold" />
            Add Node
          </button>
          <ToolButton label="Filter Nodes" active={hasFilters} onClick={() => setShowFilter(true)}><Funnel size={18} /></ToolButton>
          <ToolButton label="Clear Search and Filters" disabled={!hasFilters && !search && !sortConfig.key} onClick={clearFilters}><XCircle size={18} /></ToolButton>
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-2">
          <StatCard label="Total Nodes" value={totalNodes} primary loading={loading} />
          <StatCard label="Virtual Machines" value={totalVM} loading={loading} />
          <StatCard label="LXC Containers" value={totalLXC} loading={loading} />
        </div>

        <SidebarInsight
          title="Nodes by Cluster"
          description="Share of nodes assigned to each cluster"
          items={nodeDistribution}
          emptyMessage="Cluster distribution will appear as nodes are assigned."
        />
      </aside>

      {/* ---------------- RIGHT CONTENT AREA ---------------- */}
      <section aria-label="Node list" className="telemetry-surface h-fit min-w-0 flex-1 rounded-2xl border p-4 lg:h-full lg:overflow-y-auto">

        {/* Table Headers (Hidden on mobile) */}
        {!loading && filteredNodes.length > 0 && (
          <div className={`mb-3 hidden gap-3 px-4 xl:grid ${rowColumns}`}>
            <SortHeader label="ID" sortKey="nodeId" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Node" sortKey="node" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Cluster" sortKey="cluster" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Disk" sortKey="disk" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Allocated" sortKey="allocated" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="IP Address" sortKey="ipAddress" sortConfig={sortConfig} onSort={handleSort} />
          </div>
        )}

        {/* Table Rows */}
        <div className="stagger-rows flex flex-col gap-2">
          {loading ? (
            <LoadingState label="Loading nodes" rows={6} />
          ) : filteredNodes.length === 0 ? (
            <EmptyState
              message={search || hasFilters ? "No nodes match your search and filters." : clusters.length === 0 ? "Create a cluster before adding nodes." : disks.length === 0 ? "Add a disk before creating a node." : "No nodes yet. Add one to record its address and disk allocations."}
              action={search || hasFilters
                ? <button type="button" onClick={clearFilters} className="btn btn-secondary">Clear Search and Filters</button>
                : clusters.length === 0 ? <Link to="/clusters" className="btn btn-secondary">Go to Clusters</Link>
                : disks.length === 0 ? <Link to="/disks" className="btn btn-secondary">Go to Disks</Link>
                : <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary">Add Node</button>}
            />
          ) : (
            filteredNodes.map((n) => (
              <div key={n.id}>
                {/* Desktop View */}
                <div
                  onClick={openOnRowClick(() => setViewNodeId(n.id))}
                  className={`hidden h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-white transition-colors hover:border-line-strong hover:bg-raised-hover xl:grid ${rowColumns}`}
                >
                  <div className="truncate font-mono text-white/70" title={n.nodeId}>{n.nodeId}</div>
                  <div className="truncate" title={n.node}>{n.node}</div>
                  <div className="w-fit rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">{n.type}</div>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: clusterColor(n) }}></div>
                    <span className="truncate font-normal text-white/80" title={n.cluster}>{n.cluster}</span>
                  </div>
                  <div className="truncate font-normal text-white/70" title={n.allocations?.map(a => a.disk).join(", ")}>{n.allocations?.map(a => a.disk).join(", ") || "—"}</div>
                  <div className="font-mono font-normal text-white/80">{fmtBytes(n.allocated || 0)}</div>
                  <div className="whitespace-nowrap font-mono font-normal text-white/90">{n.ipAddress}</div>
                  <button type="button" onClick={() => setViewNodeId(n.id)} className="row-open" aria-label={`View ${n.node}`}>
                    <CaretCircleRight size={20} weight="fill" />
                  </button>
                </div>

                {/* Mobile View (Card) */}
                <div
                  onClick={openOnRowClick(() => setViewNodeId(n.id))}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border border-line bg-raised p-3 text-white xl:hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-bold text-white">{n.node}</div>
                      <div className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">{n.type}</div>
                    </div>
                    <button type="button" onClick={() => setViewNodeId(n.id)} aria-label={`View ${n.node}`} className="row-open -mr-1 -mt-1">
                      <CaretCircleRight size={20} weight="fill" />
                    </button>
                  </div>

                  <div className="-mt-1 flex min-w-0 items-center gap-3 text-xs text-white/70">
                    <span className="shrink-0 font-mono">{n.nodeId}</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor(n) }}></div>
                      <span className="truncate">{n.cluster}</span>
                    </div>
                  </div>

                  <div className="mt-1 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-5 border-t border-line pt-2 text-xs">
                    <div>
                      <div className="font-semibold text-white/70">IP</div>
                      <div className="whitespace-nowrap font-mono text-white/90">{n.ipAddress}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white/70">Allocated</div>
                      <div className="whitespace-nowrap font-mono text-white/90">{fmtBytes(n.allocated || 0)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white/70">Disks</div>
                      <div className="truncate text-white/70">{n.allocations?.map(a => a.disk).join(", ") || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ---------------- MODALS ---------------- */}
      {showFilter && (
        <FilterModal
          title="Filter Nodes"
          onClose={() => setShowFilter(false)}
          clusters={clusters}
          disks={disks}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCluster={filterCluster}
          setFilterCluster={setFilterCluster}
          filterDisk={filterDisk}
          setFilterDisk={setFilterDisk}
        />
      )}

      {showCreate && (
        <AddNodeModal
          onClose={() => {
            resetAddForm();
            setShowCreate(false);
          }}
          handleCreate={handleCreate}
          clusters={clusters}
          disks={disks}
          nodeId={nodeId}
          setNodeId={setNodeId}
          nodeName={nodeName}
          setNodeName={setNodeName}
          type={type}
          setType={setType}
          cluster={cluster}
          setCluster={setCluster}
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
          allocRows={allocRows}
          setAllocRows={setAllocRows}
          addAlloc={addAlloc}
          removeAlloc={removeAlloc}
          changeAlloc={changeAlloc}
          error={error}
          saving={saving}
        />
      )}

      {viewNode && (
        <NodeModal
          node={viewNode}
          onClose={() => setViewNodeId(null)}
          clusters={clusters}
          disks={disks}
          containers={containers}
          uid={uid}
        />
      )}
    </div>
  );
}
