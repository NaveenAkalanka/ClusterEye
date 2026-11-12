import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import NumberStepper from "./NumberStepper";
import { Field, FormAlert } from "./ui";
import { DEFAULT_CLUSTER_COLOR } from "../utils/format";

export default function AddDiskModal({
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
    return (
        <Dialog
            title="Add Disk"
            onClose={onClose}
            dirty={Boolean(disk || cluster || totalGB)}
            footer={
                <>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" form="add-disk-form" disabled={saving} className="btn btn-primary">
                        {saving ? "Adding..." : "Add Disk"}
                    </button>
                </>
            }
        >
            <form id="add-disk-form" noValidate onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                {error && <FormAlert>{error}</FormAlert>}

                <Field label="Disk Name or ID">
                    <input type="text" placeholder="e.g. local-lvm" value={disk} onChange={(e) => setDisk(e.target.value)} autoCapitalize="off" spellCheck={false} className="input" />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Model">
                        <CustomSelect value={model} onChange={setModel} options={["SSD", "HDD", "NVME"]} placeholder="Select Model" clearable={false} />
                    </Field>
                    <Field label="Role">
                        <CustomSelect value={role} onChange={setRole} options={["DATA", "OS", "BACKUP"]} placeholder="Select Role" clearable={false} />
                    </Field>
                </div>

                <Field label="Cluster">
                    <CustomSelect
                        value={cluster}
                        onChange={setCluster}
                        options={clusters.map((c) => c.cluster)}
                        placeholder="Select Cluster"
                        clearable={false}
                        renderOption={(opt) => {
                            const targetCluster = clusters.find(c => c.cluster === opt);
                            return (
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: targetCluster?.color || DEFAULT_CLUSTER_COLOR }}></div>
                                    <span className="truncate">{opt}</span>
                                </div>
                            );
                        }}
                    />
                </Field>

                <Field label="Total Size (GB)">
                    <NumberStepper value={totalGB} onChange={setTotalGB} min={1} placeholder="e.g. 1000" className="w-full" />
                </Field>
            </form>
        </Dialog>
    );
}
