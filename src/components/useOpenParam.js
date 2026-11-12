import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Opens the record named by `?open=<id>` once the page's records have loaded, then drops the
 * parameter so closing the dialog doesn't reopen it. Linked-record links use this.
 */
export default function useOpenParam(records, ready, open) {
  const [params, setParams] = useSearchParams();
  const id = params.get("open");

  useEffect(() => {
    if (!id || !ready) return;
    if (records.some((record) => record.id === id)) open(id);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("open");
      return next;
    }, { replace: true });
  }, [id, ready, records, open, setParams]);
}
