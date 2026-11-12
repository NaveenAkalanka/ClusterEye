import { Plus } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import NumberStepper from "./NumberStepper";
import { Field, FormAlert } from "./ui";

export default function AddNodeModal({
    onClose,
    handleCreate,
    clusters,
    disks,
    nodeId,
    setNodeId,
    nodeName,
    setNodeName,
    type,
    setType,
    cluster,
    setCluster,
    ipAddress,
    setIpAddress,
    allocRows,
    setAllocRows,
    addAlloc,
    removeAlloc,
    changeAlloc,
    error,
    saving,
}) {
    const filteredDisks = disks.filter((d) => d.cluster === cluster);

    return (
        <Dialog
            title="Add Node"
            onClose={onClose}
            dirty={Boolean(nodeId || nodeName || cluster || allocRows.length)}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" form="add-node-form" disabled={saving} className="btn btn-primary">
                        {saving ? "Adding..." : "Add Node"}
                    </button>
                </>
            }
        >
            <form id="add-node-form" noValidate onSubmit={handleCreate} className="space-y-4">
                {error && <FormAlert>{error}</FormAlert>}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Node ID">
                        <input type="text" placeholder="e.g. 101" value={nodeId} onChange={(e) => setNodeId(e.target.value)} autoCapitalize="off" spellCheck={false} className="input" maxLength={50} />
                    </Field>
                    <Field label="Node Name">
                        <input type="text" placeholder="e.g. docker-host-01" value={nodeName} onChange={(e) => setNodeName(e.target.value)} autoCapitalize="off" spellCheck={false} className="input" maxLength={50} />
                    </Field>
                    <Field label="Type">
                        <CustomSelect value={type} onChange={setType} options={["LXC", "VM"]} placeholder="Select Type" clearable={false} />
                    </Field>
                    <Field label="Cluster">
                        <CustomSelect
                            value={cluster}
                            onChange={(val) => {
                                setCluster(val);
                                setAllocRows([]);

                                const cls = clusters.find((c) => c.cluster === val);
                                if (cls && cls.ipAddress) {
                                    setIpAddress(cls.ipAddress.split(".").slice(0, 3).join(".") + ".");
                                }
                            }}
                            options={clusters.map(c => c.cluster)}
                            placeholder="Select Cluster"
                            clearable={false}
                        />
                    </Field>
                </div>

                <Field label="IP Address">
                    <input type="text" inputMode="decimal" spellCheck={false} placeholder="e.g. 192.168.1.20" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="input font-mono" />
                </Field>

                <div className="border-t border-line pt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-white/80">Disk Allocations</h3>
                        <button type="button" onClick={addAlloc} disabled={!cluster} className="btn btn-secondary h-9 px-3 text-xs">
                            <Plus size={14} weight="bold" /> Add Disk
                        </button>
                    </div>

                    {allocRows.length === 0 ? (
                        <p className="text-sm text-white/55">{cluster ? "Add at least one disk for this node." : "Select a cluster, then add its disks."}</p>
                    ) : (
                        <div className="space-y-2">
                            {allocRows.map((r, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2">
                                    <div className="min-w-[200px] flex-1">
                                        <CustomSelect
                                            label={`Disk ${i + 1}`}
                                            value={r.diskId}
                                            onChange={(val) => changeAlloc(i, "diskId", val)}
                                            options={filteredDisks.map((d) => {
                                                const freeGB = ((d.total || 0) - (d.used || 0)) / 1_000_000_000;
                                                return { value: d.id, label: d.disk, subLabel: `${freeGB.toFixed(1)} GB free` };
                                            })}
                                            placeholder="Select Disk"
                                            clearable={false}
                                        />
                                    </div>
                                    <div className="w-full sm:w-36">
                                        <NumberStepper value={r.gb} onChange={(val) => changeAlloc(i, "gb", val)} label={`Disk ${i + 1} GB`} placeholder="GB" min={0} />
                                    </div>
                                    <button type="button" onClick={() => removeAlloc(i)} className="btn btn-danger w-full sm:w-auto">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
