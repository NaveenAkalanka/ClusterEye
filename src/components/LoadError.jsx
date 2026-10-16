import { useEffect } from "react";

export default function LoadError({ onRetry }) {
  useEffect(() => {
    window.addEventListener("online", onRetry);
    return () => window.removeEventListener("online", onRetry);
  }, [onRetry]);

  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <span>Could not load the latest data. Retry now; if this continues, verify the deployed Firestore rules and indexes.</span>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-lg border border-red-300/40 px-3 py-2 font-semibold hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
        Retry
      </button>
    </div>
  );
}
