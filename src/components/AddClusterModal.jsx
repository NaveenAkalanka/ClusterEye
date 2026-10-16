import { XCircle } from "@phosphor-icons/react";
import CustomSelect from "./CustomSelect";
import useDialogFocus from "./useDialogFocus";

export default function AddClusterModal({
    onClose,
    handleCreate,
    name,
    setName,
    ipAddress,
    setIpAddress,
    selectedColor,
    setSelectedColor,
    subnetMask,
    setSubnetMask,
    saving,
    error,
}) {
    const { dialogRef, onDialogKeyDown } = useDialogFocus(onClose);
    return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Add cluster" tabIndex={-1} onKeyDown={onDialogKeyDown} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-all backdrop-blur-sm">
            <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-lg font-semibold text-white tracking-tight">Add New Cluster</h3>
                    <button
                        onClick={onClose}
                        className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        <XCircle size={14} weight="fill" className="text-white/60" />
                        Close
                    </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-5">
                    <div>
                        <label htmlFor="new-cluster-name" className="block text-white/70 mb-2 text-xs font-bold tracking-wider">Cluster Name</label>
                        <input
                            id="new-cluster-name"
                            type="text"
                            placeholder="e.g. Alpha Cluster"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all placeholder:text-white/50"
                            maxLength={50}
                        />
                    </div>

                    <div>
                        <label htmlFor="new-cluster-ip" className="block text-white/70 mb-2 text-xs font-bold tracking-wider">IP Address</label>
                        <input
                            id="new-cluster-ip"
                            type="text"
                            placeholder="e.g. 192.168.1.1"
                            value={ipAddress}
                            onChange={(e) => setIpAddress(e.target.value)}
                            className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all placeholder:text-white/50"
                        />
                    </div>

                    <div>
                        <label htmlFor="new-cluster-mask" className="block text-white/70 mb-2 text-xs font-bold tracking-wider">Subnet Mask</label>
                        <input
                            id="new-cluster-mask"
                            type="text"
                            placeholder="e.g. 255.255.255.0"
                            value={subnetMask}
                            onChange={(e) => setSubnetMask(e.target.value)}
                            className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all placeholder:text-white/50"
                        />
                    </div>

                    <div>
                        <div className="block text-white/70 mb-2 text-xs font-bold tracking-wider">Cluster Color</div>
                        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Cluster color">
                            {[
                                "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
                                "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
                                "#F43F5E", "#64748B", "#78716C", "#69639E"
                            ].map((color) => (
                                <button type="button"
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    aria-label={`Select color ${color}`}
                                    aria-pressed={selectedColor === color}
                                    className={`h-9 rounded-md cursor-pointer transition-all hover:brightness-110 active:brightness-90 ${selectedColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#0D100D]" : ""}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 text-red-200 border border-red-500/20 rounded-lg px-3 py-2 text-xs">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#69639E] to-[#A8C9AD] opacity-90 hover:opacity-100 text-white text-xs font-bold transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? "Creating..." : "Create Cluster"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
