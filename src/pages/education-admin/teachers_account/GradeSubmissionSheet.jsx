import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banner, Button, CloseButton, Field } from "@/components/ui";
import { formatBytes, formatDate, formatTime } from "@/utils/format";
import { t } from "@/i18n";
import { submissionStatusLabel } from "./assignmentHelpers";

const IMAGE = /\.(jpe?g|png)$/i;
const AUDIO = /\.(mp3|m4a|webm)$/i;

function FilePreview({ file }) {
  const name = file.original_name || "";
  return (
    <li className="ta-file">
      {IMAGE.test(name) ? (
        <a href={file.download_url} target="_blank" rel="noreferrer" className="ta-file-image">
          <img src={file.download_url} alt={name} loading="lazy" />
        </a>
      ) : null}
      <div className="ta-file-row">
        <span className="ta-file-ext">{(name.split(".").pop() || "").toUpperCase()}</span>
        <a href={file.download_url} target="_blank" rel="noreferrer">
          {name}
        </a>
        <span className="tg-muted">{formatBytes(file.size)}</span>
      </div>
      {AUDIO.test(name) ? <audio controls preload="metadata" src={file.download_url} /> : null}
    </li>
  );
}

export default function GradeSubmissionSheet({
  submission,
  assignment,
  studentName = "",
  onClose,
  onSave,
}) {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const graded = assignment?.max_score != null;
  const reviewable = ["submitted", "late", "graded"].includes(submission?.status);

  useEffect(() => {
    if (!submission) return;
    setScore(submission.score != null ? String(submission.score) : "");
    setFeedback(submission.feedback || "");
    setError("");
  }, [submission]);

  async function save({ goNext = false, returnWork = false } = {}) {
    setError("");
    if (returnWork && !feedback.trim()) {
      setError(t("tAsg.gReturnNeedsComment"));
      return;
    }
    if (!returnWork && graded) {
      const value = Number(score);
      if (score === "" || !Number.isInteger(value) || value < 0 || value > assignment.max_score) {
        setError(t("tAsg.gScoreRange", { max: assignment.max_score }));
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(
        { score: graded && !returnWork ? Number(score) : null, feedback },
        { goNext, returnWork },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!submission) return undefined;
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && reviewable) {
        event.preventDefault();
        save({ goNext: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!submission) return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="drawer teacher-drawer teacher-drawer-wide ta-grade-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("tAsg.gDialog", { name: studentName })}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-grade-head">
          <div>
            <h2>{studentName || t("tAsg.gStudent")}</h2>
            <p className="tg-muted">{assignment?.title}</p>
            {submission.submitted_at ? (
              <p className="tg-muted">
                {t("tAsg.gHandedAt", {
                  date: formatDate(submission.submitted_at),
                  time: formatTime(submission.submitted_at),
                })}
                {" · "}
                {submissionStatusLabel(submission.status)}
                {submission.attempt > 1 ? t("tAsg.gAttempt", { count: submission.attempt }) : ""}
              </p>
            ) : null}
          </div>
          <CloseButton onClick={onClose} />
        </header>

        <div className="ta-grade-layout">
          <section className="ta-grade-work">
            <h3>{t("tAsg.gWork")}</h3>
            {submission.text ? (
              <div className="ta-grade-answer">{submission.text}</div>
            ) : (
              <p className="tg-muted">{t("tAsg.gNoText")}</p>
            )}
            {submission.link ? (
              <p>
                <a href={submission.link} target="_blank" rel="noreferrer">
                  {submission.link}
                </a>
              </p>
            ) : null}
            {submission.files?.length ? (
              <ul className="ta-files">
                {submission.files.map((file) => (
                  <FilePreview key={file.id} file={file} />
                ))}
              </ul>
            ) : null}
          </section>

          <section className="ta-grade-panel">
            {error ? <Banner>{error}</Banner> : null}
            {submission.status === "returned" ? (
              <Banner tone="warn">{t("tAsg.gReturned")}</Banner>
            ) : null}
            {graded ? (
              <Field label={t("tAsg.gScore", { max: assignment.max_score })}>
                <input
                  type="number"
                  min="0"
                  max={assignment.max_score}
                  step="1"
                  value={score}
                  disabled={!reviewable}
                  onChange={(e) => setScore(e.target.value)}
                />
              </Field>
            ) : (
              <p className="tg-muted">{t("tAsg.gNoScoreHint")}</p>
            )}
            <Field label={t("tAsg.gComment")}>
              <textarea
                rows={5}
                value={feedback}
                disabled={!reviewable}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t("tAsg.gCommentPlaceholder")}
              />
            </Field>
            {reviewable ? (
              <div className="ta-grade-actions">
                <Button onClick={() => save({ goNext: true })} disabled={saving}>
                  {t(graded ? "tAsg.gGradeNext" : "tAsg.gAcceptNext")}
                </Button>
                <Button variant="ghost" onClick={() => save()} disabled={saving}>
                  {t(graded ? "tAsg.gGrade" : "tAsg.gAccept")}
                </Button>
                <Button variant="ghost" onClick={() => save({ returnWork: true, goNext: true })} disabled={saving}>
                  {t("tAsg.gReturn")}
                </Button>
              </div>
            ) : null}
            <p className="tg-muted ta-grade-hint">{t("tAsg.gHint")}</p>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
