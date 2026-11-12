export default function LoadingState({ label = "Loading records", rows = 5, className = "" }) {
    return (
        <div role="status" aria-label={label} className={`loading-in w-full space-y-3 py-4 ${className}`}>
            <span className="sr-only">{label}</span>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="shimmer h-12 rounded-xl border border-line bg-raised/70" />
            ))}
        </div>
    );
}

export function DashboardLoadingState({ label = "Loading inventory" }) {
    return (
        <main role="status" aria-label={label} className="flex-1 min-h-0 overflow-hidden">
            <span className="sr-only">{label}</span>
            <div className="grid h-full w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_minmax(14rem,0.7fr)_minmax(20rem,1fr)] loading-in">
                {["col-span-full h-32 overflow-hidden", "md:col-span-2 lg:col-span-4 xl:col-span-3 min-h-40 lg:min-h-0", "lg:col-span-4 min-h-40 lg:min-h-0", "lg:col-span-4 xl:col-span-5 min-h-40 lg:min-h-0", "md:col-span-2 lg:col-span-4 min-h-80 lg:min-h-0", "md:col-span-2 lg:col-span-4 min-h-80 lg:min-h-0", "md:col-span-2 lg:col-span-4 min-h-80 lg:min-h-0"].map((spanClass, index) => (
                    <div key={index} className={`telemetry-surface rounded-2xl border p-5 flex flex-col ${spanClass}`}>
                        <div className="shimmer h-5 w-28 rounded bg-white/10" />
                        <div className="shimmer mt-10 h-12 w-24 rounded-lg bg-white/10" />
                        <div className="shimmer mt-auto h-11 w-full rounded-xl bg-white/[0.06]" />
                    </div>
                ))}
            </div>
        </main>
    );
}
