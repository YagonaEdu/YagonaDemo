import { useEffect, useRef } from "react";

/** Native <dialog>: focus trap, Esc and inert background come from the browser. */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  busy = false,
  tone = "primary",
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="st-dialog"
      aria-labelledby="st-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="st-dialog-title">{title}</h2>
      <div className="st-dialog-body">{children}</div>
      <div className="st-dialog-actions">
        <button type="button" className="y-btn y-btn-ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`y-btn y-btn-${tone}`}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? "Подождите…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
