import Dialog from "./Dialog";
import { ClusterColorPicker, Field, FormAlert } from "./ui";

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
    return (
        <Dialog
            title="Add Cluster"
            onClose={onClose}
            dirty={Boolean(name || ipAddress)}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" form="add-cluster-form" disabled={saving} className="btn btn-primary">
                        {saving ? "Adding..." : "Add Cluster"}
                    </button>
                </>
            }
        >
            <form id="add-cluster-form" onSubmit={handleCreate} className="space-y-4">
                {error && <FormAlert>{error}</FormAlert>}

                <Field label="Cluster Name">
                    <input type="text" placeholder="e.g. Alpha Cluster" value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={50} />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="IP Address">
                        <input type="text" inputMode="decimal" spellCheck={false} placeholder="e.g. 192.168.1.1" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="input font-mono" />
                    </Field>
                    <Field label="Subnet Mask">
                        <input type="text" inputMode="decimal" spellCheck={false} placeholder="e.g. 255.255.255.0" value={subnetMask} onChange={(e) => setSubnetMask(e.target.value)} className="input font-mono" />
                    </Field>
                </div>

                <div>
                    <div className="field-label">Cluster Color</div>
                    <ClusterColorPicker value={selectedColor} onChange={setSelectedColor} />
                </div>
            </form>
        </Dialog>
    );
}
