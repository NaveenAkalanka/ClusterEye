import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";

export default function AddContainerModal({ onClose, nodes, containers, clusters }) {
    const [selectedCluster, setSelectedCluster] = useState("");
    const [containerId, setContainerId] = useState("");
    const [name, setName] = useState("");
    const [nodeId, setNodeId] = useState("");
    const [port, setPort] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter nodes based on selected cluster
    const validNodes = nodes.filter(n => {
        if (!n.nodeId || !n.node) return false;
        if (selectedCluster && n.cluster !== selectedCluster) return false;
        return true;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!containerId || !name || !nodeId || !port) {
            setError("All fields are required");
            return;
        }

        const idExists = containers.some(c => c.containerId === containerId);
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

        const portUsed = containers.some(c => {
            if (c.port !== parseInt(port)) return false; // Port doesn't match, irrelevant

            const cNode = nodes.find(n => n.nodeId === c.nodeId);
            if (!cNode) return false; // Can't find node, skip check (safety)

            const cSubnet = getSubnet(cNode.ipAddress);
            return cSubnet === selectedSubnet; // Match if subnets are same
        });

        if (portUsed) {
            setError(`Port ${port} is already in use on this subnet (${selectedSubnet}.x)`);
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, "containers"), {
                userId: auth.currentUser.uid,
                containerId: containerId.trim(),
                name: name.trim(),
                nodeId,
                port: parseInt(port) || port,
                link: "",
                password: "",
                createdAt: new Date().toISOString()
            });
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to add container");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0D100D] border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
                <h2 className="text-2xl font-bold text-white mb-6">Add Container</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* Container ID */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Container ID</label>
                        <input
                            autoFocus
                            type="text"
                            value={containerId}
                            onChange={(e) => setContainerId(e.target.value)}
                            placeholder="e.g. c-101"
                            className="input"
                        />
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Container Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. nginx-proxy"
                            className="input"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Cluster Filter */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Cluster</label>
                            <CustomSelect
                                value={selectedCluster}
                                onChange={(v) => { setSelectedCluster(v); setNodeId(""); }}
                                options={clusters.map(c => ({ value: c.cluster, label: c.cluster }))}
                                placeholder="Select Cluster"
                                renderOption={(opt) => {
                                    const c = clusters.find(cl => cl.cluster === opt.value);
                                    return (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c?.color || "#69639E" }} />
                                            <span>{opt.label}</span>
                                        </div>
                                    );
                                }}
                            />
                        </div>

                        {/* Node */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Host Node</label>
                            <CustomSelect
                                value={nodeId}
                                onChange={setNodeId}
                                options={validNodes.map(n => ({ value: n.nodeId, label: n.node }))}
                                placeholder={selectedCluster ? "Select Node" : "Choose Cluster First"}
                                disabled={!selectedCluster}
                            />
                        </div>
                    </div>

                    {/* Port */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Port</label>
                        <NumberStepper
                            value={port}
                            onChange={setPort}
                            placeholder="e.g. 8080"
                            className="w-full font-mono"
                        />
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-[#161D22] text-white py-3 rounded-xl font-bold hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-[#69639E] to-[#A8C9AD] text-white py-3 rounded-xl font-bold hover:shadow-[0_0_15px_rgba(105,99,158,0.4)] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {loading ? "Adding..." : "Add Container"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
