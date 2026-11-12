import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import NumberStepper from "./NumberStepper";
import { Field, FormAlert } from "./ui";
import { DEFAULT_CLUSTER_COLOR } from "../utils/format";

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
            setError("Enter a container ID and name, choose a host node, and enter a port.");
            return;
        }

        const portNumber = Number(port);
        if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
            setError("Port must be a whole number from 1 to 65535.");
            return;
        }

        const idExists = containers.some(c => c.containerId === containerId);
        if (idExists) {
            setError(`Container ID "${containerId}" is already in use.`);
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
            if (c.port !== portNumber) return false; // Port doesn't match, irrelevant

            const cNode = nodes.find(n => n.nodeId === c.nodeId);
            if (!cNode) return false; // Can't find node, skip check (safety)

            const cSubnet = getSubnet(cNode.ipAddress);
            return cSubnet === selectedSubnet; // Match if subnets are same
        });

        if (portUsed) {
            setError(`Port ${port} is already in use on this subnet (${selectedSubnet}.x)`);
            return;
        }

        if (!selectedNode) return setError("Selected node no longer exists");

        setLoading(true);
        try {
            await addDoc(collection(db, "containers"), {
                userId: auth.currentUser.uid,
                containerId: containerId.trim(),
                name: name.trim(),
                nodeId,
                nodeRefId: selectedNode.id,
                port: portNumber,
                link: "",
                createdAt: new Date().toISOString()
            });
            onClose();
        } catch (err) {
            console.error(err);
            setError("Could not add the container. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const dirty = Boolean(containerId || name || selectedCluster || nodeId || port);

    return (
        <Dialog
            title="Add Container"
            onClose={onClose}
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" form="add-container-form" disabled={loading} className="btn btn-primary">
                        {loading ? "Adding..." : "Add Container"}
                    </button>
                </>
            }
        >
            <form id="add-container-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <FormAlert>{error}</FormAlert>}

                <Field label="Container ID">
                    <input type="text" value={containerId} onChange={(e) => setContainerId(e.target.value)} placeholder="e.g. c-101" autoCapitalize="off" spellCheck={false} className="input" />
                </Field>

                <Field label="Container Name">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. nginx-proxy" autoCapitalize="off" spellCheck={false} className="input" />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Cluster">
                        <CustomSelect
                            value={selectedCluster}
                            onChange={(v) => { setSelectedCluster(v); setNodeId(""); }}
                            options={clusters.map(c => ({ value: c.cluster, label: c.cluster }))}
                            placeholder="Select Cluster"
                            clearable={false}
                            renderOption={(opt) => {
                                const c = clusters.find(cl => cl.cluster === opt.value);
                                return (
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c?.color || DEFAULT_CLUSTER_COLOR }} />
                                        <span>{opt.label}</span>
                                    </div>
                                );
                            }}
                        />
                    </Field>

                    <Field label="Host Node">
                        <CustomSelect
                            value={nodeId}
                            onChange={setNodeId}
                            options={validNodes.map(n => ({ value: n.nodeId, label: n.node }))}
                            placeholder={selectedCluster ? "Select Node" : "Choose Cluster First"}
                            disabled={!selectedCluster}
                            clearable={false}
                        />
                    </Field>
                </div>

                <Field label="Port">
                    <NumberStepper value={port} onChange={setPort} min={1} max={65535} placeholder="e.g. 8080" className="w-full font-mono" />
                </Field>
            </form>
        </Dialog>
    );
}
