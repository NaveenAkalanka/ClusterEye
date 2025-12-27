import React from "react";
import CustomSelect from "./CustomSelect";

export default function FilterModal({
    onClose,
    clusters = [],
    disks = [],
    // Node Filters
    filterType,
    setFilterType,
    filterDisk,
    setFilterDisk,
    // Disk Filters
    filterModel,
    setFilterModel,
    filterRole,
    setFilterRole,
    // Shared Filters
    filterCluster,
    setFilterCluster,
}) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0D100D] rounded-2xl border border-white/10 p-4 md:p-6 w-full max-w-xs animate-scale-in">
                <h3 className="text-lg font-semibold mb-4 md:mb-6 text-white">Filter</h3>

                <div className="space-y-4 md:space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        {/* Type (Nodes) */}
                        {setFilterType && (
                            <Field label="Type">
                                <CustomSelect
                                    value={filterType}
                                    onChange={setFilterType}
                                    options={["VM", "LXC"]}
                                    placeholder="All Types"
                                />
                            </Field>
                        )}

                        {/* Model (Disks) */}
                        {setFilterModel && (
                            <Field label="Model">
                                <CustomSelect
                                    value={filterModel}
                                    onChange={setFilterModel}
                                    options={["SSD", "HDD", "NVME"]}
                                    placeholder="All Models"
                                />
                            </Field>
                        )}

                        {/* Cluster (Shared) */}
                        {setFilterCluster && (
                            <Field label="Cluster">
                                <CustomSelect
                                    value={filterCluster}
                                    onChange={setFilterCluster}
                                    options={clusters.map((c) => c.cluster)}
                                    placeholder="All Clusters"
                                />
                            </Field>
                        )}
                    </div>

                    {/* Disk (Nodes) */}
                    {setFilterDisk && (
                        <Field label="Disk">
                            <CustomSelect
                                value={filterDisk}
                                onChange={setFilterDisk}
                                options={disks.map((d) => d.disk)}
                                placeholder="All Disks"
                            />
                        </Field>
                    )}

                    {/* Role (Disks) */}
                    {setFilterRole && (
                        <Field label="Role">
                            <CustomSelect
                                value={filterRole}
                                onChange={setFilterRole}
                                options={["DATA", "OS", "BACKUP"]}
                                placeholder="All Roles"
                            />
                        </Field>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                    >
                        Close
                    </button>

                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                        Apply
                    </button>
                </div>
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
