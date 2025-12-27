import React, { useMemo } from "react";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";

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
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-4 md:p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-white/5 pb-4 md:pb-6">
                    <h3 className="text-lg font-semibold text-white">Add New Node</h3>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4 md:space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Field label="Node ID">
                            <input
                                type="text"
                                placeholder="Unique ID"
                                value={nodeId}
                                onChange={(e) => setNodeId(e.target.value)}
                                className="input w-full"
                                maxLength={50}
                            />
                        </Field>

                        <Field label="Node Name">
                            <input
                                type="text"
                                placeholder="Node name"
                                value={nodeName}
                                onChange={(e) => setNodeName(e.target.value)}
                                className="input w-full"
                                maxLength={50}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Field label="Type">
                            <CustomSelect
                                value={type}
                                onChange={(val) => setType(val)}
                                options={["LXC", "VM"]}
                                placeholder="Select Type"
                            />
                        </Field>

                        <Field label="Cluster">
                            <CustomSelect
                                value={cluster}
                                onChange={(val) => {
                                    setCluster(val);
                                    setAllocRows([]);

                                    const cls = clusters.find((c) => c.cluster === val);
                                    if (cls && cls.ipAddress) {
                                        const prefix = cls.ipAddress.split(".").slice(0, 3).join(".") + ".";
                                        setIpAddress(prefix);
                                    }
                                }}
                                options={clusters.map(c => c.cluster)}
                                placeholder="Select Cluster"
                            />
                        </Field>
                    </div>

                    <Field label="IP Address">
                        <input
                            type="text"
                            placeholder="IPv4 address"
                            value={ipAddress}
                            onChange={(e) => setIpAddress(e.target.value)}
                            className="input w-full"
                        />
                    </Field>

                    {/* Allocations */}
                    <div className="mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-white/80 font-medium text-sm">Disk Allocations</div>
                            <button
                                type="button"
                                onClick={addAlloc}
                                className="px-3 py-1 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm cursor-pointer"
                            >
                                + Add Disk
                            </button>
                        </div>

                        {allocRows.length === 0 ? (
                            <div className="text-white/60 text-sm">No allocations yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {allocRows.map((r, i) => {
                                    const filteredDisks = disks.filter((d) => d.cluster === cluster);

                                    return (
                                        <div key={i} className="flex flex-wrap gap-2 items-center">

                                            <div className="flex-1 min-w-[200px]">
                                                <CustomSelect
                                                    value={r.diskId}
                                                    onChange={(val) => changeAlloc(i, "diskId", val)}
                                                    options={filteredDisks.map((d) => {
                                                        const freeGB = ((d.total || 0) - (d.used || 0)) / 1_000_000_000;
                                                        return {
                                                            value: d.id,
                                                            label: d.disk,
                                                            subLabel: `${freeGB.toFixed(1)} GB free`
                                                        };
                                                    })}
                                                    placeholder="Select Disk"
                                                />
                                            </div>

                                            <div className="w-32">
                                                <NumberStepper
                                                    value={r.gb}
                                                    onChange={(val) => changeAlloc(i, "gb", val)}
                                                    min={0}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeAlloc(i)}
                                                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs transition-all cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-600/20 text-red-200 border border-red-600/30 rounded-lg px-3 py-2 mt-3">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? "Saving…" : "Create Node"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-white/70 mb-2 text-xs font-medium">{label}</div>
            {children}
        </div>
    );
}
