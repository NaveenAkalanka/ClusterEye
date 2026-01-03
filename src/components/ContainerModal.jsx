import { useState, useEffect } from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";
import { Eye, EyeSlash, XCircle, ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react";

export default function ContainerModal({ onClose, container, nodes, containers }) {
    // Mode: "view", "edit", "delete"
    const [mode, setMode] = useState("view");

    // Local State for Editing
    const [containerId, setContainerId] = useState(container.containerId || "");
    const [name, setName] = useState(container.name);
    const [nodeId, setNodeId] = useState(container.nodeId);
    const [port, setPort] = useState(container.port);
    const [link, setLink] = useState(container.link || "");
    const [password, setPassword] = useState(container.password || "");
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const validNodes = nodes.filter(n => n.nodeId && n.node);

    // Reset local state when switching to edit mode or when container changes (safe guard)
    useEffect(() => {
        if (mode === "view") {
            setContainerId(container.containerId || "");
            setName(container.name);
            setNodeId(container.nodeId);
            setPort(container.port);
            setLink(container.link || "");
            setPassword(container.password || "");
        }
    }, [mode, container]);


    const handleSave = async (e) => {
        e.preventDefault();
        setError("");

        if (!containerId || !name || !nodeId || !port) {
            setError("Container ID, Name, Node, and Port are required");
            return;
        }

        // Check ID uniqueness (excluding self)
        const idExists = containers.some(c => c.id !== container.id && c.containerId === containerId);
        if (idExists) {
            setError("Container ID must be unique");
            return;
        }

        // Helper to get subnet (first 3 octets)
        const getSubnet = (ip) => {
            if (!ip) return "";
            return ip.split(".").slice(0, 3).join(".");
        };

        const selectedNode = nodes.find(n => n.nodeId === nodeId);
        const selectedSubnet = selectedNode ? getSubnet(selectedNode.ipAddress) : "";

        // Check Port uniqueness (excluding self) across the SUBNET
        const portUsed = containers.some(c => {
            if (c.id === container.id) return false; // Skip self
            if (c.port !== parseInt(port)) return false; // Port mismatch, irrelevant

            const cNode = nodes.find(n => n.nodeId === c.nodeId);
            if (!cNode) return false;

            const cSubnet = getSubnet(cNode.ipAddress);
            return cSubnet === selectedSubnet;
        });

        if (portUsed) {
            setError(`Port ${port} is already in use on this subnet (${selectedSubnet}.x)`);
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, "containers", container.id), {
                containerId: containerId.trim(),
                name: name.trim(),
                nodeId,
                port: parseInt(port) || port,
                link: link.trim(),
                password: password.trim()
            });
            setMode("view");
        } catch (err) {
            console.error(err);
            setError("Failed to update container");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, "containers", container.id));
            onClose(); // Close modal after delete
        } catch (e) {
            console.error(e);
            setError("Failed to delete container");
            setLoading(false);
        }
    };

    const isEdit = mode === "edit";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0D100D] border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-xl font-bold text-white">
                        {mode === "delete" ? "Delete Container?" :
                            mode === "edit" ? "Edit Container" :
                                `Container: ${name}`}
                    </h3>
                    <button
                        onClick={onClose}
                        className="px-2 py-1 bg-[#161D22] rounded-lg hover:bg-[#1c252b] text-white text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        <XCircle size={14} weight="fill" className="text-white/60" />
                        Close
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {mode === "delete" ? (
                    <div className="flex flex-col gap-6">
                        <div className="text-white/80">
                            Are you sure you want to delete <span className="font-bold text-white">{name}</span>?<br />
                            This action cannot be undone.
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setMode("view")}
                                className="px-4 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                {loading ? "Deleting..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="flex flex-col gap-4">

                        {/* Container ID */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Container ID</label>
                            <input
                                type="text"
                                disabled={!isEdit}
                                value={containerId}
                                onChange={(e) => setContainerId(e.target.value)}
                                className={`input ${!isEdit && "border-transparent bg-transparent pl-0"}`}
                            />
                        </div>

                        {/* Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Container Name</label>
                            <input
                                type="text"
                                disabled={!isEdit}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`input ${!isEdit && "border-transparent bg-transparent pl-0 text-lg font-bold"}`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Node */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Host Node</label>
                                <CustomSelect
                                    value={nodeId}
                                    onChange={setNodeId}
                                    options={validNodes.map(n => ({ value: n.nodeId, label: n.node }))}
                                    disabled={!isEdit && "true"} // Custom disabled handled by passing a string or boolean depending on implement, assuming boolean is fine but string "true" in prop types check
                                    className={`${!isEdit && "pointer-events-none opacity-100"}`} // visual tweak
                                />
                            </div>

                            {/* Port */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Port</label>
                                <NumberStepper
                                    value={port}
                                    onChange={setPort}
                                    className={`font-mono ${!isEdit ? "pointer-events-none opacity-100 border-none bg-transparent" : "w-full"}`}
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-white/10 my-1"></div>

                        {/* Link */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Container Link</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    disabled={!isEdit}
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    placeholder={isEdit ? "http://..." : "—"}
                                    className={`input text-[#69639E] ${!isEdit && "border-transparent bg-transparent pl-0 pr-10"}`}
                                />
                                {!isEdit && link && (
                                    <button
                                        type="button"
                                        onClick={() => window.open(link.startsWith('http') ? link : `http://${link}`, '_blank')}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <ArrowSquareOut size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    disabled={!isEdit}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={isEdit ? "••••••" : "—"}
                                    className={`input pr-10 ${!isEdit && "border-transparent bg-transparent pl-0"}`}
                                />
                                {isEdit && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                                    >
                                        {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                                    </button>
                                )}
                            </div>
                        </div>


                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                            {isEdit ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setMode("view")}
                                        className="px-4 py-2 rounded-lg bg-[#161D22] text-white text-xs hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white rounded-lg text-xs font-bold hover:shadow-[0_0_15px_rgba(105,99,158,0.4)] transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {loading ? "Saving..." : "Save Changes"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setMode("edit")}
                                        className="px-4 py-2 rounded-lg bg-[#161D22] hover:bg-[#1c252b] text-white text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
                                    >
                                        <PencilSimple size={16} /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode("delete")}
                                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <Trash size={16} /> Delete
                                    </button>
                                </>
                            )}
                        </div>

                    </form>
                )}
            </div>
        </div>
    );
}
