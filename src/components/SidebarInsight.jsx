export default function SidebarInsight({ title, description, items, emptyMessage }) {
  const hasItems = items.length > 0;

  return (
    <section className="relative hidden min-h-48 flex-1 overflow-hidden rounded-xl border border-line lg:flex lg:flex-col">
      <header className="relative border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <p className="mt-1 text-xs text-white/70">{description}</p>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {hasItems ? (
          <div className="stagger-rows flex min-h-full flex-col gap-3">
            {items.map((item) => {
              const percentage = Math.max(0, Math.min(100, Number(item.percentage) || 0));
              return (
                <div key={item.key} className="group min-w-0">
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-1.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color || "#A8C9AD" }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-xs font-medium text-white/80" title={item.label}>
                        {item.label}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-white/70">
                      {item.meta}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="bar-fill h-full min-w-px rounded-full transition-[width] duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: item.color || "#A8C9AD" }}
                    />
                  </div>
                  {item.detail && <div className="mt-1 truncate text-right font-mono text-xs text-white/55">{item.detail}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full min-h-32 place-items-center text-center">
            <p className="max-w-48 text-xs leading-relaxed text-white/70">{emptyMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
}
