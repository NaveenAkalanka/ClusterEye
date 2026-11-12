// src/components/NodeModal.jsx
import { useState, useEffect, useMemo } from "react";
import {
  doc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ArrowSquareOut, Plus } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import NumberStepper from "./NumberStepper";
import { Field, FormAlert, RelatedLinks } from "./ui";
import { isIpInSubnet } from "../utils/network";
import { DEFAULT_CLUSTER_COLOR, toHref } from "../utils/format";
import { assertIpFree, claimIp, ipIndexRef, releaseIp } from "../utils/ipIndex";

export default function NodeModal({ node, onClose, clusters, disks, containers, uid }) {
  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState({ ...node });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Show the saved record again after Cancel or Save.
  useEffect(() => {
    if (!editMode) setLocal({ ...node });
  }, [node, editMode]);

  const clusterLocked = (local.allocations || []).length > 0;

  // Check for unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(local) !== JSON.stringify(node);
  }, [local, node]);

  // Filter disks based on cluster
  const clusterDisks = useMemo(() => {
    return Array.isArray(disks)
      ? disks.filter((d) => local.clusterId && d.clusterId ? d.clusterId === local.clusterId : d.cluster === local.cluster)
      : [];
  }, [disks, local.cluster, local.clusterId]);

  // IP validation
  function isValidIP(ip) {
    return (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)
    );
  }

  // Subnet warning when editing
  const selectedCluster = clusters.find((c) => c.id === local.clusterId) || clusters.find((c) => c.cluster === local.cluster);
  const subnetWarning = editMode && selectedCluster?.ipAddress && !isIpInSubnet(local.ipAddress, selectedCluster.ipAddress, selectedCluster.subnetMask || "255.255.255.0")
    ? `IP must be in the cluster subnet (${selectedCluster.ipAddress}, mask ${selectedCluster.subnetMask || "255.255.255.0"}).`
    : "";

  /* ----------------------- SAVE ----------------------- */
  async function handleSave() {
    setError("");
    setInfo("");

    // mandatory validations
    if (!local.nodeId?.trim()) return setError("Node ID is required.");
    if (!local.node?.trim()) return setError("Node name is required.");
    if (!local.cluster) return setError("Select a cluster.");
    if (!local.ipAddress || !isValidIP(local.ipAddress))
      return setError("Invalid IPv4 address format.");
    if (!local.allocations || local.allocations.length === 0)
      return setError("At least one disk allocation is required.");

    // DUPLICATE CHECKS (Targeted Queries)
    try {
      const nodesRef = collection(db, "nodes");

      // 1. Check/Validate Node ID
      if (local.nodeId.length > 50) return setError("Node ID too long (max 50 chars).");
      if (!/^[a-zA-Z0-9-_]+$/.test(local.nodeId)) return setError("Node ID can only contain letters, numbers, hyphens, and underscores.");

      const idQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("nodeId", "==", local.nodeId)
      );
      const idSnap = await getDocs(idQuery);
      // Filter out self if found
      if (idSnap.docs.some(d => d.id !== local.id)) {
        return setError("This Node ID is already taken.");
      }

      // 2. Check Node Name
      if (local.node.length > 50) return setError("Node Name too long (max 50 chars).");

      const nameQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("node", "==", local.node)
      );
      const nameSnap = await getDocs(nameQuery);
      if (nameSnap.docs.some(d => d.id !== local.id)) {
        return setError("Node Name is already taken.");
      }

      // 3. Check IP Address
      const ipQuery = query(
        nodesRef,
        where("userId", "==", uid),
        where("ipAddress", "==", local.ipAddress)
      );
      const ipSnap = await getDocs(ipQuery);
      if (ipSnap.docs.some(d => d.id !== local.id)) {
        return setError("IP Address is already assigned to another node.");
      }

    } catch (err) {
      console.error(err);
      return setError("Failed to validate node data. Check connection."); // Stop execution on error
    }

    // Check cluster overlap
    const clusterCollision = clusters.some(c => c.ipAddress === local.ipAddress.trim());
    if (clusterCollision) return setError("IP Address matches a Cluster IP.");

    const cl = clusters.find((c) => c.id === local.clusterId) || clusters.find((c) => c.cluster === local.cluster);
    if (!cl?.ipAddress)
      return setError("Selected cluster missing IP base address.");
    if (!isIpInSubnet(local.ipAddress, cl.ipAddress, cl.subnetMask || "255.255.255.0"))
      return setError(`IP must be in the cluster subnet (${cl.ipAddress}, mask ${cl.subnetMask || "255.255.255.0"}).`);

    // calculate total allocated
    const totalAllocatedBytes = (local.allocations || []).reduce((sum, a) => {
      const gb = Number(a.allocatedGB) || 0;
      return sum + gb * 1_000_000_000;
    }, 0);

    // validate allocations vs available
    for (const a of local.allocations || []) {
      const d = disks.find((x) => x.id === a.diskId) || disks.find((x) => x.disk === a.disk);
      if (!d) return setError(`Disk ${a.disk} no longer exists.`);
      if (Number(a.allocatedGB) <= 0 || !Number.isFinite(Number(a.allocatedGB))) return setError("Allocation must be greater than zero.");
      if ((local.allocations || []).filter((item) => (item.diskId || item.disk) === (a.diskId || a.disk)).length > 1) return setError("Choose each disk only once.");
      const oldAlloc = (node.allocations || []).find((x) => x.diskId ? x.diskId === d.id : x.disk === d.disk);
      const prevGB = oldAlloc ? Number(oldAlloc.allocatedGB) : 0;
      const availableGB = (d.total || 0) / 1_000_000_000 - (d.used || 0) / 1_000_000_000 + prevGB;
      if (Number(a.allocatedGB) > availableGB)
        return setError(
          `Disk ${a.disk} has only ${availableGB.toFixed(1)} GB available.`
        );
    }

    // update Firestore
    const nodeRef = doc(db, "nodes", local.id);
    setSaving(true);
    try {
      const nextAllocations = (local.allocations || []).map((a) => {
        const selectedDisk = disks.find((d) => d.id === a.diskId) || disks.find((d) => d.disk === a.disk);
        return { diskId: selectedDisk.id, disk: selectedDisk.disk, allocatedGB: Number(a.allocatedGB) };
      });
      const linked = local.nodeId.trim() !== node.nodeId
        ? (containers || []).filter((item) => item.nodeRefId ? item.nodeRefId === node.id : item.nodeId === node.nodeId)
        : [];
      if (linked.length + nextAllocations.length > 450) throw new Error("Too many linked records to rename in one operation.");

      await runTransaction(db, async (transaction) => {
        const currentSnap = await transaction.get(nodeRef);
        const current = currentSnap.data();
        if (!current || current.userId !== uid) throw new Error("Node no longer exists.");
        if (JSON.stringify(current.allocations || []) !== JSON.stringify(node.allocations || [])) {
          throw new Error("Node allocations changed elsewhere. Close and reopen this node.");
        }
        const nextIp = local.ipAddress.trim();
        const ipChanged = nextIp !== current.ipAddress;
        const [newIpSnap, oldIpSnap] = ipChanged
          ? await Promise.all([transaction.get(ipIndexRef(uid, nextIp)), current.ipAddress ? transaction.get(ipIndexRef(uid, current.ipAddress)) : null])
          : [null, null];
        if (ipChanged) assertIpFree(newIpSnap, nextIp, node.id);
        const deltas = new Map();
        const addDelta = (allocation, direction) => {
          const disk = disks.find((item) => item.id === allocation.diskId) || disks.find((item) => item.disk === allocation.disk);
          if (!disk) throw new Error(`Disk ${allocation.disk} no longer exists.`);
          const amount = Number(allocation.allocatedGB) * 1_000_000_000 * direction;
          deltas.set(disk.id, (deltas.get(disk.id) || 0) + amount);
        };
        (current.allocations || []).forEach((a) => addDelta(a, -1));
        nextAllocations.forEach((a) => addDelta(a, 1));
        const diskEntries = [...deltas.entries()].map(([id, delta]) => ({ ref: doc(db, "disks", id), delta }));
        const diskSnaps = await Promise.all(diskEntries.map(({ ref }) => transaction.get(ref)));

        diskEntries.forEach(({ ref, delta }, index) => {
          const data = diskSnaps[index].data();
          if (!data || data.userId !== uid) throw new Error("An allocated disk is no longer available.");
          const used = Number(data.used || 0) + delta;
          if (used < 0 || used > Number(data.total || 0)) throw new Error(`${data.disk} has insufficient capacity or invalid usage.`);
          transaction.update(ref, { used, free: Number(data.total) - used });
        });

        transaction.update(nodeRef, {
        nodeId: local.nodeId.trim(),
        node: local.node.trim(),
        type: local.type,
        cluster: local.cluster,
        clusterId: cl.id,
        ipAddress: local.ipAddress.trim(),
        username: local.username || "",
        link: local.link || "",
        allocations: nextAllocations,
        allocated: totalAllocatedBytes,
        updatedAt: serverTimestamp(),
        });
        linked.forEach((item) => transaction.update(doc(db, "containers", item.id), { nodeId: local.nodeId.trim(), nodeRefId: node.id }));
        if (ipChanged) {
          claimIp(transaction, newIpSnap, uid, nextIp, node.id);
          if (oldIpSnap) releaseIp(transaction, oldIpSnap, node.id);
        }
      });

      setEditMode(false);
      setInfo("Node updated.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save the node. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------- DELETE ----------------------- */
  function handleDelete() {
    // Check for linked containers
    const linkedContainers = (containers || []).filter(c => c.nodeRefId ? c.nodeRefId === node.id : c.nodeId === node.nodeId);
    if (linkedContainers.length > 0) {
      setError(`This node hosts ${linkedContainers.length} ${linkedContainers.length === 1 ? "container" : "containers"}. Move or delete ${linkedContainers.length === 1 ? "it" : "them"} first.`);
      return;
    }
    setConfirmDelete(true);
  }

  async function executeDelete() {
    setError("");
    setSaving(true);
    try {
      const nodeRef = doc(db, "nodes", local.id);
      await runTransaction(db, async (transaction) => {
        const currentSnap = await transaction.get(nodeRef);
        const current = currentSnap.data();
        if (!current || current.userId !== uid) throw new Error("Node no longer exists.");
        const ipSnap = current.ipAddress ? await transaction.get(ipIndexRef(uid, current.ipAddress)) : null;
        const deltas = new Map();
        for (const a of current.allocations || []) {
          const disk = disks.find((item) => item.id === a.diskId) || disks.find((item) => item.disk === a.disk);
          if (!disk) throw new Error(`Disk ${a.disk} no longer exists.`);
          deltas.set(disk.id, (deltas.get(disk.id) || 0) + Number(a.allocatedGB) * 1_000_000_000);
        }
        const entries = [...deltas.entries()].map(([id, bytes]) => ({ ref: doc(db, "disks", id), bytes }));
        const diskSnaps = await Promise.all(entries.map(({ ref }) => transaction.get(ref)));
        entries.forEach(({ ref, bytes }, index) => {
          const data = diskSnaps[index].data();
          if (!data || data.userId !== uid) throw new Error("An allocated disk is no longer available.");
          const used = Number(data.used || 0) - bytes;
          if (used < 0) throw new Error(`${data.disk} has invalid usage.`);
          transaction.update(ref, { used, free: Number(data.total) - used });
        });
        transaction.delete(nodeRef);
        if (ipSnap) releaseIp(transaction, ipSnap, node.id);
      });

      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not delete the node. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------- Allocation Helpers ----------------------- */
  function changeAlloc(i, field, value) {
    setLocal((prev) => {
      const arr = [...(prev.allocations || [])];
      arr[i] = { ...arr[i], [field]: value };
      return { ...prev, allocations: arr };
    });
  }

  function addAlloc() {
    setLocal((prev) => ({
      ...prev,
      allocations: [...(prev.allocations || []), { disk: "", allocatedGB: 0 }],
    }));
  }

  function removeAlloc(i) {
    setLocal((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, idx) => idx !== i),
    }));
  }

  /* ----------------------- RENDER ----------------------- */
  const footer = confirmDelete ? (
    <>
      <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-secondary">Cancel</button>
      <button type="button" onClick={executeDelete} disabled={saving} className="btn btn-danger-solid">
        {saving ? "Deleting..." : "Delete Node"}
      </button>
    </>
  ) : !editMode ? (
    <>
      <button type="button" onClick={handleDelete} className="btn btn-danger mr-auto">Delete</button>
      <button type="button" onClick={() => { setEditMode(true); setInfo(""); setError(""); }} className="btn btn-secondary">Edit</button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => { setEditMode(false); setError(""); }} className="btn btn-secondary">Cancel</button>
      <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </>
  );

  const nodeCluster = clusters.find((c) => node.clusterId ? c.id === node.clusterId : c.cluster === node.cluster);
  const nodeDisks = (node.allocations || [])
    .map((a) => disks.find((d) => a.diskId ? d.id === a.diskId : d.disk === a.disk))
    .filter((d, i, list) => d && list.indexOf(d) === i);
  const nodeContainers = (containers || []).filter((c) => c.nodeRefId ? c.nodeRefId === node.id : c.nodeId === node.nodeId);

  return (
    <Dialog
      title={confirmDelete ? "Delete Node?" : editMode ? "Edit Node" : node.node}
      onClose={onClose}
      dirty={editMode && isDirty}
      focusKey={`${editMode}-${confirmDelete}`}
      footer={footer}
    >
      <div className="space-y-4">
        {info && <FormAlert tone="success">{info}</FormAlert>}
        {subnetWarning && !error && <FormAlert tone="caution">{subnetWarning}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}

        {confirmDelete ? (
          <p className="text-sm text-white/80">
            Delete <span className="font-semibold text-white">{node.node}</span> from your inventory and return its disk allocations? This can't be undone.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Node ID">
                <input readOnly={!editMode} value={local.nodeId || ""} onChange={(e) => setLocal({ ...local, nodeId: e.target.value })} autoCapitalize="off" spellCheck={false} className="input" />
              </Field>
              <Field label="Node Name">
                <input readOnly={!editMode} value={local.node} onChange={(e) => setLocal({ ...local, node: e.target.value })} autoCapitalize="off" spellCheck={false} className="input" />
              </Field>
              <Field label="Type">
                <CustomSelect value={local.type} onChange={(val) => setLocal({ ...local, type: val })} options={["LXC", "VM"]} readOnly={!editMode} clearable={false} />
              </Field>
              <Field label="Cluster" hint={editMode && clusterLocked ? "Remove all disk allocations to change the cluster." : undefined}>
                <CustomSelect
                  value={local.cluster}
                  onChange={(val) => {
                    const upd = { ...local, cluster: val, clusterId: clusters.find((c) => c.cluster === val)?.id || "" };
                    // Autofill IP
                    const cObj = clusters.find((c) => c.cluster === val);
                    if (cObj && cObj.ipAddress) {
                      upd.ipAddress = cObj.ipAddress.split(".").slice(0, 3).join(".") + ".";
                    }
                    setLocal(upd);
                  }}
                  options={clusters.map((c) => c.cluster)}
                  placeholder="Select Cluster"
                  readOnly={!editMode}
                  disabled={clusterLocked}
                  clearable={false}
                />
              </Field>
              <Field label="IP Address">
                <input readOnly={!editMode} value={local.ipAddress} onChange={(e) => setLocal({ ...local, ipAddress: e.target.value })} inputMode="decimal" spellCheck={false} className="input font-mono" />
              </Field>
              <Field label="Username">
                <input readOnly={!editMode} value={local.username || ""} onChange={(e) => setLocal({ ...local, username: e.target.value })} placeholder={editMode ? "e.g. root" : "None"} autoCapitalize="off" spellCheck={false} className="input" />
              </Field>
            </div>

            <Field label="Link">
              {editMode ? (
                <input value={local.link || ""} onChange={(e) => setLocal({ ...local, link: e.target.value })} inputMode="url" placeholder="http://..." autoCapitalize="off" spellCheck={false} className="input" />
              ) : local.link ? (
                <a href={toHref(local.link)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 max-w-full items-center gap-2 text-sm text-accent underline-offset-4 hover:underline">
                  <span className="truncate">{local.link}</span>
                  <ArrowSquareOut size={16} className="shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <div className="flex h-10 items-center text-sm text-white/55">None</div>
              )}
            </Field>

            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-white/80">Disk Allocations</h3>
                {editMode && (
                  <button type="button" onClick={addAlloc} className="btn btn-secondary h-9 px-3 text-xs"><Plus size={14} weight="bold" /> Add Disk</button>
                )}
              </div>

              {(!local.allocations || local.allocations.length === 0) && (
                <p className="text-sm text-white/55">No disks allocated.</p>
              )}

              <div className="space-y-2">
                {local.allocations?.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[200px] flex-1">
                      <CustomSelect
                        label={`Disk ${i + 1}`}
                        value={a.diskId || clusterDisks.find((d) => d.disk === a.disk)?.id || ""}
                        onChange={(val) => {
                          const selected = clusterDisks.find((d) => d.id === val);
                          setLocal((prev) => ({
                            ...prev,
                            allocations: prev.allocations.map((item, index) => index === i ? { ...item, diskId: val, disk: selected?.disk || "" } : item),
                          }));
                        }}
                        options={clusterDisks.map((d) => {
                          const freeGB = ((d.total || 0) - (d.used || 0)) / 1_000_000_000;
                          return { value: d.id, label: d.disk, subLabel: editMode ? `${freeGB.toFixed(1)} GB free` : undefined };
                        })}
                        placeholder="Select Disk"
                        readOnly={!editMode}
                        clearable={false}
                      />
                    </div>
                    <div className={editMode ? "w-full sm:w-36" : "shrink-0"}>
                      <NumberStepper value={a.allocatedGB} onChange={(val) => changeAlloc(i, "allocatedGB", val)} label={`Disk ${i + 1} GB`} min={0} readOnly={!editMode} unit="GB" />
                    </div>
                    {editMode && (
                      <button type="button" onClick={() => removeAlloc(i)} className="btn btn-danger w-full sm:w-auto">Remove</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!editMode && (
              <RelatedLinks
                groups={[
                  { label: "Cluster", items: nodeCluster ? [{ key: nodeCluster.id, label: nodeCluster.cluster, to: `/clusters?open=${nodeCluster.id}`, color: nodeCluster.color || DEFAULT_CLUSTER_COLOR }] : [], empty: "Not found" },
                  { label: "Disks", items: nodeDisks.map((d) => ({ key: d.id, label: d.disk, to: `/disks?open=${d.id}` })), empty: "No disks allocated" },
                  { label: "Containers", items: nodeContainers.map((c) => ({ key: c.id, label: c.name, to: `/docker?open=${c.id}` })), empty: "No containers" },
                ]}
              />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
