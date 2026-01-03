import React, { useState } from "react";
import { XCircle } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";

export default function AddDiskModal({
    open,
    onClose,
    handleCreate,
    clusters,
    disk,
    setDisk,
    model,
    setModel,
    role,
    setRole,
    cluster,
    setCluster,
    totalGB,
    setTotalGB,
    saving,
    error,
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in text-sans">
            <div className="bg-[#0D100D] rounded-2xl border border-white/10 w-full max-w-lg p-4 md:p-6 overflow-y-auto max-h-[90vh] shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-white/5 pb-4 md:pb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight">Add New Disk</h3>
                    <button
                        onClick={onClose}
                        className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        <XCircle size={14} weight="fill" className="text-white/60" />
                        Close
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4 md:space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            {error}
                        </div>
                    )}

                    <Field label="Disk Name / ID">
                        <input
                            type="text"
                            placeholder="e.g. local-lvm"
                            value={disk}
                            onChange={(e) => setDisk(e.target.value)}
                            className="input w-full"
                            autoFocus
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <Field label="Model">
                            <CustomSelect
                                value={model}
                                onChange={setModel}
                                options={["SSD", "HDD", "NVME"]}
                                placeholder="Select Model"
                            />
                        </Field>

                        <Field label="Role">
                            <CustomSelect
                                value={role}
                                onChange={setRole}
                                options={["DATA", "OS", "BACKUP"]}
                                placeholder="Select Role"
                            />
                        </Field>
                    </div>

                    <Field label="Cluster">
                        <CustomSelect
                            value={cluster}
                            onChange={setCluster}
                            options={clusters.map((c) => c.cluster)}
                            placeholder="Assign to Cluster"
                            renderOption={(opt) => {
                                const targetCluster = clusters.find(c => c.cluster === opt);
                                return (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: targetCluster?.color || "#69639E" }}></div>
                                        <span>{opt}</span>
                                    </div>
                                );
                            }}
                        />
                    </Field>

                    <Field label="Total Size (GB)">
                        <NumberStepper
                            value={totalGB}
                            onChange={setTotalGB}
                            min={1}
                            placeholder="e.g. 1000"
                            className="w-full"
                        />
                    </Field>

                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                        {saving ? "Creating..." : "Create Disk"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-white/50 mb-2 text-xs font-bold tracking-wider">{label}</div>
            {children}
        </div>
    );
}
