import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, CloseButton } from "@/components/ui";
import { formatDate, formatTime } from "@/utils/format";
import { t, translated } from "@/i18n";
import {
  assignmentStatusLabel,
  formatDueLabel,
  pendingReviewCount,
  submissionStatusLabel,
  submissionStatusTone,
} from "./assignmentHelpers";

const DETAIL_TABS = [
  { id: "works", label: "t:tAsg.dTabWorks" },
  { id: "missing", label: "t:tAsg.dTabMissing" },
  { id: "graded", label: "t:tAsg.dTabGraded" },
  { id: "info", label: "t:tAsg.dTabInfo" },
].map(translated);

export default function AssignmentDetailPanel({
  assignment,
  submissions = [],
  groupName = "",
  courseName = "",
  onClose,
  onGrade,
  onRemind,
  onPublish,
  onEdit,
  onCloseAssignment,
  onDuplicate,
  onReviewFirst,
}) {
  const [tab, setTab] = useState("works");

  useEffect(() => {
    setTab("works");
  }, [assignment?.id]);

  const summary = useMemo(() => {
    const total = assignment?.total_students || submissions.length;
    const submitted = Number(assignment?.handed_count || 0);
    const missing = Number(assignment?.missing_count || 0);
    const graded = Number(assignment?.graded_count || 0);
    const pending = pendingReviewCount(assignment || {});
    return { total, submitted, missing, graded, pending };
  }, [assignment, submissions]);

  const filteredSubs = useMemo(() => {
    if (tab === "missing") {
      return submissions.filter((row) => row.status === "missing");
    }
    if (tab === "graded") {
      return submissions.filter((row) => row.status === "graded");
    }
    return submissions;
  }, [submissions, tab]);

  if (!assignment) return null;

  const status = assignmentStatusLabel(assignment);
  const pending = summary.pending;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="drawer teacher-drawer teacher-drawer-wide ta-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={assignment.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-detail-head">
          <div>
            <h2>{assignment.title}</h2>
            <p className="tg-muted">
              {groupName}
              {courseName ? ` · ${courseName}` : ""}
            </p>
            <p className="tg-muted">{t("tAsg.due", { date: formatDueLabel(assignment.due_at) })}</p>
            <span className={`tg-pill tg-pill-${statusTone(status.tone)}`}>{status.label}</span>
          </div>
          <div className="ta-detail-head-actions">
            {pending > 0 ? (
              <Button onClick={() => onReviewFirst?.(assignment, submissions)}>{t("tAsg.reviewCount", { count: pending })}</Button>
            ) : null}
            {summary.missing > 0 ? (
              <Button variant="ghost" onClick={onRemind}>
                {t("tAsg.remind")}
              </Button>
            ) : null}
            {assignment.status === "draft" ? <Button onClick={onPublish}>{t("common.publish")}</Button> : null}
            <div className="ta-menu-wrap">
              <button type="button" className="ta-menu-btn" aria-label={t("common.actions")}>
                ⋯
              </button>
              <div className="ta-menu">
                <button type="button" onClick={onEdit}>
                  {t("common.edit")}
                </button>
                <button type="button" onClick={onDuplicate}>
                  {t("common.duplicate")}
                </button>
                {assignment.status === "published" ? (
                  <button type="button" onClick={onCloseAssignment}>
                    {t("common.unpublish")}
                  </button>
                ) : null}
              </div>
            </div>
            <CloseButton onClick={onClose} />
          </div>
        </header>

        <div className="ta-detail-summary">
          <div>
            <span>{t("tAsg.dStudents")}</span>
            <strong>{summary.total}</strong>
          </div>
          <div>
            <span>{t("tAsg.dHanded")}</span>
            <strong>{summary.submitted}</strong>
          </div>
          <div>
            <span>{t("tAsg.dToReview")}</span>
            <strong>{summary.pending}</strong>
          </div>
          <div>
            <span>{t("tAsg.dMissing")}</span>
            <strong>{summary.missing}</strong>
          </div>
          <div>
            <span>{t("tAsg.dGraded")}</span>
            <strong>{summary.graded}</strong>
          </div>
        </div>

        <div className="tg-student-tabs" role="tablist" aria-label={t("tAsg.dTabsLabel")}>
          {DETAIL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === "missing" && summary.missing > 0 ? (
                <span className="tg-tab-badge">{summary.missing}</span>
              ) : null}
              {item.id === "works" && summary.pending > 0 ? (
                <span className="tg-tab-badge">{summary.pending}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="ta-detail-body">
          {tab === "info" ? (
            <dl className="tg-kv ta-info-list">
              <div>
                <dt>{t("tAsg.dName")}</dt>
                <dd>{assignment.title}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dDescription")}</dt>
                <dd className="ta-pre">{assignment.description || "—"}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dRules")}</dt>
                <dd>
                  {t(assignment.allow_late ? "tAsg.dLateYes" : "tAsg.dLateNo")}
                  {" · "}
                  {t(assignment.allow_resubmit ? "tAsg.dResubmitYes" : "tAsg.dResubmitNo")}
                </dd>
              </div>
              <div>
                <dt>{t("tAsg.dGroup")}</dt>
                <dd>{groupName || "—"}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dCourse")}</dt>
                <dd>{courseName || "—"}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dDue")}</dt>
                <dd>{formatDueLabel(assignment.due_at)}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dMaxScore")}</dt>
                <dd>{assignment.max_score ?? t("tAsg.dNoScore")}</dd>
              </div>
              <div>
                <dt>{t("tAsg.dMaterials")}</dt>
                <dd>
                  {assignment.attachments?.length ? (
                    <ul className="ta-materials is-plain">
                      {assignment.attachments.map((item) => (
                        <li key={item.id}>
                          <a href={item.url || item.download_url} target="_blank" rel="noreferrer">
                            {item.title || item.original_name || item.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="tg-table-wrap">
              <table className="tg-table ta-submissions-table">
                <thead>
                  <tr>
                    <th>{t("tAsg.dColStudent")}</th>
                    <th>{t("tAsg.dColStatus")}</th>
                    <th>{t("tAsg.dColDate")}</th>
                    <th>{t("tAsg.dColScore")}</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((row) => (
                    <tr
                      key={row.id || row.student}
                      className={row.status !== "missing" ? "tg-row-clickable" : undefined}
                      onClick={row.status !== "missing" ? () => onGrade(row) : undefined}
                    >
                      <td>{row.studentName || row.student_name || "—"}</td>
                      <td>
                        <span className={`tg-pill tg-pill-${submissionStatusTone(row.status)}`}>
                          {submissionStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        {row.submitted_at ? (
                          <>
                            {formatDate(row.submitted_at)}
                            <span className="ts-cell-sub">{formatTime(row.submitted_at)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {row.score != null
                          ? `${row.score}${assignment.max_score ? ` / ${assignment.max_score}` : ""}`
                          : row.status === "graded"
                            ? t("tAsg.dPass")
                          : "—"}
                      </td>
                      <td>
                        {row.status !== "missing" ? (
                          <Button variant="ghost" onClick={() => onGrade(row)}>
                            {t(["submitted", "late"].includes(row.status) ? "tAsg.dReview" : "common.open")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredSubs.length ? (
                <p className="tg-muted ta-empty-inline">
                  {tab === "missing"
                    ? t("tAsg.dAllHanded")
                    : tab === "graded"
                      ? t("tAsg.dNoGraded")
                      : t("tAsg.dNoneHanded")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function statusTone(tone) {
  if (tone === "active") return "green";
  if (tone === "today") return "warn";
  if (tone === "overdue") return "warn";
  return "muted";
}
