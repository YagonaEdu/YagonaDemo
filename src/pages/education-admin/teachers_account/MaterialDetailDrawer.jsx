import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banner, Button, CloseButton } from "@/components/ui";
import { formatWhen } from "@/utils/format";
import { t } from "@/i18n";
import { getVocabExamResults } from "./vocabApi";
import { formatCreated, materialKindLabel, statusLabel, statusTone } from "./materialHelpers";

export default function MaterialDetailDrawer({
  item,
  groupMap,
  courseMap,
  onClose,
  onEdit,
  onResults,
  onDuplicate,
  onArchive,
  onCreateExam,
}) {
  const [examResults, setExamResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item || item.kind !== "exam") {
      setExamResults(null);
      return;
    }
    let cancelled = false;
    setLoadingResults(true);
    getVocabExamResults(item.id)
      .then((data) => {
        if (!cancelled) setExamResults(data || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;

  const groupName = groupMap.get(String(item.group)) || "—";
  const courseName = courseMap.get(String(item.course)) || "—";

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer teacher-drawer tm-detail-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="ta-detail-head">
          <div>
            <p className="tm-detail-type">{materialKindLabel(item.kind)}</p>
            <h2>{item.title}</h2>
            <p className="tg-muted">{groupName} · {courseName}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="tm-detail-body">
          {error ? <Banner>{error}</Banner> : null}
          <div className="tm-detail-meta">
            <span className={`tg-pill tg-pill-${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
            <span className="tg-muted">{t("tMat.addedOn", { date: formatCreated(item.created_at) })}</span>
          </div>
          {item.description ? <p>{item.description}</p> : null}
          <p className="tg-muted">{item.meta}</p>
          {item.link ? (
            <a href={item.link} target="_blank" rel="noreferrer" className="text-link">{t("tMat.openLink")}</a>
          ) : null}
          {item.file ? (
            <a href={item.file} target="_blank" rel="noreferrer" className="text-link">{t("tMat.openFile")}</a>
          ) : null}
          {item.kind === "vocabulary" ? (
            <Button onClick={() => onCreateExam?.(item)}>{t("tMat.createExamFromList")}</Button>
          ) : null}
          {item.kind === "exam" ? (
            <section className="tm-results-section">
              <h3>{t("tMat.groupResults")}</h3>
              {loadingResults ? <p className="tg-muted">{t("common.loading")}</p> : null}
              {examResults ? <ExamResults rows={examResults} /> : null}
            </section>
          ) : null}
        </div>
        <footer className="ta-create-foot">
          <Button variant="ghost" onClick={() => onEdit?.(item)}>{t("common.edit")}</Button>
          {item.kind === "exam" || item.kind === "vocabulary" ? (
            <Button variant="ghost" onClick={() => onArchive?.(item)}>
              {t(item.status === "published" ? "common.unpublish" : "common.publish")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onDuplicate?.(item)}>{t("common.duplicate")}</Button>
              <Button variant="ghost" onClick={() => onArchive?.(item)}>{t("common.archive")}</Button>
            </>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function ExamResults({ rows }) {
  const done = rows.filter((row) => row.status === "done");
  const passed = done.filter((row) => row.passed).length;
  const average = done.length
    ? Math.round(done.reduce((sum, row) => sum + (row.best_score || 0), 0) / done.length)
    : null;
  return (
    <>
      <div className="tm-results-kpis">
        <div>
          <span className="tg-muted">{t("tMat.passedLabel")}</span>
          <strong>
            {done.length} / {rows.length}
          </strong>
        </div>
        <div>
          <span className="tg-muted">{t("tMat.avgBest")}</span>
          <strong>{average != null ? `${average}%` : "—"}</strong>
        </div>
        <div>
          <span className="tg-muted">{t("tMat.passed")}</span>
          <strong className="tr-score-good">{passed}</strong>
        </div>
        <div>
          <span className="tg-muted">{t("tMat.failed")}</span>
          <strong className="tr-score-low">{done.length - passed}</strong>
        </div>
        <div>
          <span className="tg-muted">{t("tMat.notStarted")}</span>
          <strong>{rows.filter((row) => row.status === "not_started").length}</strong>
        </div>
      </div>
      <div className="tm-attempts-table-wrap">
        <table className="tg-table tm-attempts-table">
          <thead>
            <tr>
              <th>{t("tMat.colStudent")}</th>
              <th>{t("tMat.colBest")}</th>
              <th>{t("tMat.colAttempts")}</th>
              <th>{t("tMat.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student}>
                <td>
                  {row.student_name}
                  {row.last_finished_at ? <span className="ts-cell-sub">{formatWhen(row.last_finished_at)}</span> : null}
                </td>
                <td>{row.best_score != null ? `${row.best_score}%` : "—"}</td>
                <td>{row.attempts_used}</td>
                <td>
                  {row.status === "not_started" ? (
                    <span className="tg-pill tg-pill-amber">{t("tMat.pillNotStarted")}</span>
                  ) : row.status === "in_progress" ? (
                    <span className="tg-pill tg-pill-blue">{t("tMat.pillInProgress")}</span>
                  ) : row.passed ? (
                    <span className="tg-pill tg-pill-green">{t("tMat.pillPassed")}</span>
                  ) : (
                    <span className="tg-pill tg-pill-red">{t("tMat.pillFailed")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
