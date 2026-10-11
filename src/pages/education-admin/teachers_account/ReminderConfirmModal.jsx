import { Button, CloseButton } from "@/components/ui";
import { t } from "@/i18n";

export default function ReminderConfirmModal({
  open,
  title = t("tDialogs.reminderTitle"),
  recipients = 0,
  assignmentTitle = "",
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="ta-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="ta-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-modal-head">
          <h3 id="reminder-modal-title">{title}</h3>
          <CloseButton onClick={onCancel} disabled={busy} />
        </header>
        <dl className="ta-modal-meta">
          <div>
            <dt>{t("tDialogs.recipients")}</dt>
            <dd>{t("plural.students", { count: recipients })}</dd>
          </div>
          <div>
            <dt>{t("tDialogs.assignment")}</dt>
            <dd>{assignmentTitle || "—"}</dd>
          </div>
        </dl>
        <div className="ta-modal-actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} busy={busy}>
            {t("tDialogs.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
