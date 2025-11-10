export default function Dashboard() {
  const rows = [
    { node: "Proxmox 01", type: "VM", cluster: "HomeLab 01", disk: "SDA01", allocated: "250GB", ip: "192.168.1.9" },
    { node: "Proxmox 02", type: "Container", cluster: "HomeLab 01", disk: "SDB01", allocated: "500GB", ip: "192.168.1.10" },
    { node: "Proxmox 03", type: "VM", cluster: "Lab 02", disk: "SDC01", allocated: "120GB", ip: "192.168.1.11" },
  ];

  return (
    <div className="w-full h-full bg-neutral-950 p-10 overflow-y-auto">
      <div className="flex gap-10">
        <aside className="flex flex-col gap-4 w-80">
          {["Add Node", "Edit Node", "Delete Node"].map((txt, i) => (
            <button
              key={i}
              className={`w-full h-16 rounded-2xl text-white text-2xl font-bold 
               ${i % 2 === 0 ? 'bg-gradient-to-r from-slate-500 to-neutral-400' :
                'bg-gradient-to-r from-neutral-400 to-slate-500'}`}
            >
              {txt}
            </button>
          ))}
          {["Total Clusters", "Total Nodes", "Total Disks"].map((txt, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-5 text-white">
              <div className="text-2xl font-semibold">{txt}</div>
              <div className="text-6xl font-bold mt-3">10</div>
            </div>
          ))}
        </aside>

        <section className="flex-1 bg-stone-950 rounded-2xl p-6">
          <div className="grid grid-cols-6 text-white text-2xl font-medium mb-4 px-6">
            <span>Node</span><span>Type</span><span>Cluster</span>
            <span>Disk</span><span>Allocated</span><span>IP Address</span>
          </div>
          <div className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-6 bg-gray-900 rounded-2xl px-6 py-3 text-white text-xl font-medium"
              >
                <div>{r.node}</div><div>{r.type}</div><div>{r.cluster}</div>
                <div>{r.disk}</div><div>{r.allocated}</div><div>{r.ip}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
