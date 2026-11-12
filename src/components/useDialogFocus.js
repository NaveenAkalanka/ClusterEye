import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDialogFocus(onClose, enabled = true, focusKey = 0) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    // Land on the task, not the Close button, so Enter can't dismiss a form by accident.
    const first = dialog?.querySelector("[data-autofocus]")
      || dialog?.querySelector('input:not([disabled]):not([readonly]), [role="combobox"]:not([disabled])')
      || dialog?.querySelector("footer button:not([disabled])")
      || dialog?.querySelector(FOCUSABLE);
    (first || dialog)?.focus();

    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [enabled, focusKey]);

  function onDialogKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeRef.current?.();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
      .filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialogRef.current?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { dialogRef, onDialogKeyDown };
}
