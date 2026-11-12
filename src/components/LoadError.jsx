import { useEffect } from "react";

export default function LoadError({ onRetry }) {
  useEffect(() => {
    window.addEventListener("online", onRetry);
    return () => window.removeEventListener("online", onRetry);
  }, [onRetry]);

  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-[#f0b8b2]">
      <span>Could not load the latest data. Retry now; if this continues, verify the deployed Firestore rules and indexes.</span>
      <button type="button" onClick={onRetry} className="shrink-0 btn btn-danger shrink-0">
        Retry
      </button>
    </div>
  );
}
