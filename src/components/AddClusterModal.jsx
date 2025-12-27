import { XCircle } from "@phosphor-icons/react";

export default function AddClusterModal({
    onClose,
    handleCreate,
    name,
    setName,
    ipAddress,
    setIpAddress,
    selectedColor,
    setSelectedColor,
    saving,
    error,
}) {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-all backdrop-blur-sm">
            <div className="bg-[#0D100D] border border-white/10 rounded-2xl p-4 md:p-6 w-full max-w-lg shadow-2xl transform transition-all scale-100">
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
                        <label className="block text-white/70 mb-2 text-xs font-medium">Cluster Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Alpha Cluster"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all placeholder:text-white/20"
                            maxLength={50}
                        />
                    </div>

                    <div>
                        <label className="block text-white/70 mb-2 text-xs font-medium">IP Address</label>
                        <input
                            type="text"
                            placeholder="e.g. 192.168.1.1"
                            value={ipAddress}
                            onChange={(e) => setIpAddress(e.target.value)}
                            className="w-full h-10 bg-[#161D22] text-white text-sm px-4 rounded-xl outline-none border border-white/5 focus:border-white/20 transition-all placeholder:text-white/20"
                        />
                    </div>

                    <div>
                        <label className="block text-white/70 mb-2 text-xs font-medium">Cluster Color</label>
                        <div className="w-full h-12 flex rounded-xl overflow-hidden border border-white/10 shadow-inner">
                            {[
                                "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
                                "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
                                "#F43F5E", "#64748B", "#78716C", "#69639E"
                            ].map((color) => (
                                <div
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    className={`flex-1 h-full cursor-pointer transition-all hover:brightness-110 active:brightness-90 ${selectedColor === color ? "ring-2 ring-white z-10 relative shadow-lg scale-110" : ""}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                ></div>
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
