import { useState, useEffect } from "react";
import { updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import CustomSelect from "./CustomSelect";
import NumberStepper from "./NumberStepper";
import { ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react";
import Dialog from "./Dialog";
import { Field, FormAlert, RelatedLinks } from "./ui";
import { toHref } from "../utils/format";

export default function ContainerModal({ onClose, container, nodes, containers }) {
    // Mode: "view", "edit", "delete"
    const [mode, setMode] = useState("view");

    // Local State for Editing
    const [containerId, setContainerId] = useState(container.containerId || "");
    const [name, setName] = useState(container.name);
    const [nodeId, setNodeId] = useState(container.nodeId);
    const [port, setPort] = useState(container.port);
    const [link, setLink] = useState(container.link || "");

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
        }
    }, [mode, container]);


    const handleSave = async (e) => {
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

        // Check ID uniqueness (excluding self)
        const idExists = containers.some(c => c.id !== container.id && c.containerId === containerId);
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
        if (!selectedNode) return setError("Selected node no longer exists");
        const selectedSubnet = selectedNode ? getSubnet(selectedNode.ipAddress) : "";

        // Check Port uniqueness (excluding self) across the SUBNET
        const portUsed = containers.some(c => {
            if (c.id === container.id) return false; // Skip self
            if (c.port !== portNumber) return false; // Port mismatch, irrelevant

            const cNode = nodes.find(n => c.nodeRefId ? n.id === c.nodeRefId : n.nodeId === c.nodeId);
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
                nodeRefId: selectedNode.id,
                port: portNumber,
                link: link.trim()
            });
            setMode("view");
        } catch (err) {
            console.error(err);
            setError("Could not save the container. Check your connection and try again.");
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
            setError("Could not delete the container. Check your connection and try again.");
            setLoading(false);
        }
    };

    const isEdit = mode === "edit";
    const dirty = isEdit && (containerId !== (container.containerId || "") || name !== container.name || nodeId !== container.nodeId || port !== container.port || link !== (container.link || ""));

    const footer = mode === "delete" ? (
        <>
            <button type="button" onClick={() => setMode("view")} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={loading} className="btn btn-danger-solid">
                {loading ? "Deleting..." : "Delete Container"}
            </button>
        </>
    ) : isEdit ? (
        <>
            <button type="button" onClick={() => { setMode("view"); setError(""); }} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="container-form" disabled={loading} className="btn btn-primary">
                {loading ? "Saving..." : "Save Changes"}
            </button>
        </>
    ) : (
        <>
            <button type="button" onClick={() => setMode("delete")} className="btn btn-danger mr-auto"><Trash size={16} /> Delete</button>
            <button type="button" onClick={() => setMode("edit")} className="btn btn-secondary"><PencilSimple size={16} /> Edit</button>
        </>
    );

    const hostNode = nodes.find((n) => container.nodeRefId ? n.id === container.nodeRefId : n.nodeId === container.nodeId);

    return (
        <Dialog
            title={mode === "delete" ? "Delete Container?" : isEdit ? "Edit Container" : container.name}
            onClose={onClose}
            dirty={dirty}
            focusKey={mode}
            footer={footer}
        >
            {error && <FormAlert className="mb-4">{error}</FormAlert>}

            {mode === "delete" ? (
                <p className="text-sm text-white/80">
                    Delete <span className="font-semibold text-white">{container.name}</span> from your inventory? This can't be undone.
                </p>
            ) : (
                <form id="container-form" noValidate onSubmit={handleSave} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Container ID">
                            <input type="text" readOnly={!isEdit} value={containerId} onChange={(e) => setContainerId(e.target.value)} autoCapitalize="off" spellCheck={false} className="input" />
                        </Field>
                        <Field label="Container Name">
                            <input type="text" readOnly={!isEdit} value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="off" spellCheck={false} className="input" />
                        </Field>
                        <Field label="Host Node">
                            <CustomSelect
                                value={nodeId}
                                onChange={setNodeId}
                                options={validNodes.map(n => ({ value: n.nodeId, label: n.node }))}
                                placeholder={isEdit ? "Select Node" : "Unknown Node"}
                                readOnly={!isEdit}
                                clearable={false}
                            />
                        </Field>
                        <Field label="Port">
                            <NumberStepper value={port} onChange={setPort} min={1} max={65535} readOnly={!isEdit} className="w-full font-mono" />
                        </Field>
                    </div>

                    <Field label="Link">
                        {isEdit ? (
                            <input type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="http://..." autoCapitalize="off" spellCheck={false} className="input" />
                        ) : link ? (
                            <a href={toHref(link)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 max-w-full items-center gap-2 text-sm text-accent underline-offset-4 hover:underline">
                                <span className="truncate">{link}</span>
                                <ArrowSquareOut size={16} className="shrink-0" aria-hidden="true" />
                            </a>
                        ) : (
                            <div className="flex h-10 items-center text-sm text-white/55">None</div>
                        )}
                    </Field>

                    {!isEdit && (
                        <RelatedLinks
                            groups={[{ label: "Host Node", items: hostNode ? [{ key: hostNode.id, label: hostNode.node, to: `/nodes?open=${hostNode.id}` }] : [], empty: "Not found" }]}
                        />
                    )}
                </form>
            )}
        </Dialog>
    );
}
