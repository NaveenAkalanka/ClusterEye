import CustomSelect from "./CustomSelect";
import Dialog from "./Dialog";
import { Field } from "./ui";

export default function FilterModal({
    onClose,
    title = "Filter",
    clusters = [],
    disks = [],
    nodes = [],
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
    // Container Filters
    filterNode,
    setFilterNode,
    // Shared Filters
    filterCluster,
    setFilterCluster,
}) {
    return (
        <Dialog
            title={title}
            size="md"
            onClose={onClose}
            dismissOnBackdrop
            footer={<button type="button" onClick={onClose} className="btn btn-primary">Done</button>}
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {setFilterType && (
                    <Field label="Type">
                        <CustomSelect value={filterType} onChange={setFilterType} options={["VM", "LXC"]} placeholder="All Types" />
                    </Field>
                )}
                {setFilterModel && (
                    <Field label="Model">
                        <CustomSelect value={filterModel} onChange={setFilterModel} options={["SSD", "HDD", "NVME"]} placeholder="All Models" />
                    </Field>
                )}
                {setFilterRole && (
                    <Field label="Role">
                        <CustomSelect value={filterRole} onChange={setFilterRole} options={["DATA", "OS", "BACKUP"]} placeholder="All Roles" />
                    </Field>
                )}
                {setFilterCluster && (
                    <Field label="Cluster">
                        <CustomSelect value={filterCluster} onChange={setFilterCluster} options={clusters.map((c) => c.cluster)} placeholder="All Clusters" />
                    </Field>
                )}
                {setFilterDisk && (
                    <Field label="Disk">
                        <CustomSelect value={filterDisk} onChange={setFilterDisk} options={disks.map((d) => d.disk)} placeholder="All Disks" />
                    </Field>
                )}
                {setFilterNode && (
                    <div className="sm:col-span-2">
                        <Field label="Host Node">
                            <CustomSelect value={filterNode} onChange={setFilterNode} options={nodes.map((n) => ({ value: n.nodeId, label: n.node }))} placeholder="All Nodes" />
                        </Field>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
