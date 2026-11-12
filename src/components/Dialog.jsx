import { useId, useState } from "react";
import { X } from "@phosphor-icons/react";
import useDialogFocus from "./useDialogFocus";

const WIDTHS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export default function Dialog({ title, onClose, dirty = false, size = "lg", dismissOnBackdrop = false, focusKey = 0, footer, children }) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const titleId = useId();

  const requestClose = () => {
    if (confirmingDiscard) setConfirmingDiscard(false);
    else if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  const { dialogRef, onDialogKeyDown } = useDialogFocus(requestClose, true, `${focusKey}-${confirmingDiscard}`);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onDialogKeyDown}
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) requestClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fadeIn"
    >
      <div className={`dialog-panel flex max-h-[90dvh] w-full flex-col rounded-2xl animate-scaleIn ${WIDTHS[size]}`}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-3 pl-5 pr-3">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-white">
            {confirmingDiscard ? "Discard Changes?" : title}
          </h2>
          <button type="button" onClick={requestClose} aria-label="Close" title="Close" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X size={18} weight="bold" />
          </button>
        </header>

        {confirmingDiscard ? (
          <>
            <p className="p-5 text-sm text-white/70">Your edits haven't been saved and will be lost.</p>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-line p-4">
              <button type="button" data-autofocus onClick={() => setConfirmingDiscard(false)} className="btn btn-secondary">Keep Editing</button>
              <button type="button" onClick={onClose} className="btn btn-danger">Discard</button>
            </footer>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line p-4">{footer}</footer>}
          </>
        )}
      </div>
    </div>
  );
}
