export default function LoadingState({ label = "Loading records", rows = 5, className = "" }) {
    return (
        <div role="status" aria-label={label} className={`w-full animate-pulse space-y-3 py-4 ${className}`}>
            <span className="sr-only">{label}</span>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="h-12 rounded-xl border border-white/5 bg-[#161D22]/70" />
            ))}
        </div>
    );
}

export function DashboardLoadingState({ label = "Loading inventory" }) {
    return (
        <main role="status" aria-label={label} className="flex-1 min-h-0 overflow-hidden p-2">
            <span className="sr-only">{label}</span>
            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6 animate-pulse">
                {["lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-3", "lg:col-span-3"].map((spanClass, index) => (
                    <div key={index} className={`min-h-56 rounded-3xl border border-white/5 bg-[#0D100D] p-6 flex flex-col ${spanClass}`}>
                        <div className="h-5 w-28 rounded bg-white/10" />
                        <div className="mt-10 h-12 w-24 rounded-lg bg-white/10" />
                        <div className="mt-auto h-11 w-full rounded-xl bg-white/[0.06]" />
                    </div>
                ))}
            </div>
        </main>
    );
}
