import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui";
import { formatDate, formatUzPhone, money } from "@/utils/format";
import { t, translated } from "@/i18n";
import {
  getAttendanceTone,
  getStudentStatus,
  studentInitials,
  avatarColor,
  formatLastActivityLabel,
} from "./groupHelpers";
import { ASSIGNMENT_STATUS_LABELS } from "./utils";

const ATTENDANCE_LABELS = translated({
  present: "t:tSd.attPresent",
  late: "t:tSd.attLate",
  absent: "t:tSd.attAbsent",
  excused: "t:tSd.attExcused",
});

const ATTENDANCE_PILL = {
  present: "tg-pill-green",
  late: "tg-pill-warn",
  absent: "tg-pill-warn",
  excused: "tg-pill-blue",
};

const SUB_TABS = [
  { id: "overview", label: "t:tSd.tabOverview" },
  { id: "attendance", label: "t:tSd.tabAttendance" },
  { id: "assignments", label: "t:tSd.tabAssignments" },
  { id: "results", label: "t:tSd.tabResults" },
].map(translated);

export default function StudentDrawer({
  student,
  onClose,
  submissions = [],
  assignments = [],
  group,
  courseName = "",
  attendanceStats = null,
  lastActivity = null,
  debt = 0,
  currency = "UZS",
  inline = false,
}) {
  const [subTab, setSubTab] = useState("overview");

  useEffect(() => {
    setSubTab("overview");
  }, [student?.id]);

  if (!student) return null;

  const assignmentMap = new Map(assignments.map((row) => [String(row.id), row]));
  const graded = submissions.filter((row) => row.status === "graded");
  const submitted = submissions.filter((row) => row.status !== "not_submitted");
  const missingCount = submissions.filter((row) => row.status === "not_submitted").length;
  const pendingReview = submissions.filter((row) => ["submitted", "late"].includes(row.status)).length;
  const avg =
    graded.length > 0
      ? Math.round(graded.reduce((sum, row) => sum + Number(row.score || 0), 0) / graded.length)
      : null;

  const initial = studentInitials(student);
  const avatarBg = avatarColor(student.full_name || student.name || "");
  const status = getStudentStatus({
    attendancePct: attendanceStats?.pct,
    missingCount,
    totalAssignments: assignments.filter((row) => row.status === "published").length,
    studentStatus: student.studentStatus ?? student.status,
  });

  const activity = lastActivity ? formatLastActivityLabel(lastActivity, submissions) : null;
  const guardians =
    Array.isArray(student.guardians) && student.guardians.length
      ? student.guardians
      : student.guardian
        ? [student.guardian]
        : [];
  const phoneDisplay = formatUzPhone(student.phone) || student.phone || "—";
  const attentionItems = [];
  if (status.tone !== "green") {
    attentionItems.push({ tone: status.tone === "muted" ? "muted" : "warn", label: status.label });
  }
  if (debt > 0) {
    attentionItems.push({ tone: "debt", label: t("tch.student.debt", { amount: money(debt, currency) }) });
  }
  if (missingCount > 0) {
    attentionItems.push({
      tone: "warn",
      label: t("tch.student.missing", { count: missingCount }),
    });
  }
  if (pendingReview > 0) {
    attentionItems.push({ tone: "info", label: t("tch.student.toReview", { count: pendingReview }) });
  }

  const body = (
    <div className={`tg-student${inline ? " tg-student-inline" : ""}`}>
      <header className="tg-student-head">
        <div className="tg-student-title">
          {inline ? (
            <button type="button" className="tg-back-btn" onClick={onClose}>
              {t("tSd.toList")}
            </button>
          ) : null}
          <div className="tg-student-identity">
            <span className="tg-student-avatar" style={{ background: avatarBg }}>
              {initial}
            </span>
            <div>
              <div className="tg-student-name-row">
                <h3>{student.full_name || student.name}</h3>
                <span className={`tg-pill tg-pill-${status.tone}`}>{status.label}</span>
              </div>
              <p className="tg-muted">
                {group?.name}
                {courseName ? ` · ${courseName}` : ""}
              </p>
            </div>
          </div>
        </div>
        {!inline ? (
          <CloseButton onClick={onClose} />
        ) : null}
      </header>

      <div className="tg-student-stats">
        <div className="tg-student-stat">
          <span className="tg-muted">{t("tSd.attendance")}</span>
          <strong className={`tg-att-${getAttendanceTone(attendanceStats?.pct)}`}>
            {attendanceStats?.pct != null ? `${attendanceStats.pct}%` : "—"}
          </strong>
        </div>
        <div className="tg-student-stat">
          <span className="tg-muted">{t("tSd.assignments")}</span>
          <strong>
            {submitted.length} / {submissions.length || assignments.length || "—"}
          </strong>
        </div>
        <div className="tg-student-stat">
          <span className="tg-muted">{t("tSd.avgScore")}</span>
          <strong>{avg != null ? `${avg}%` : "—"}</strong>
        </div>
        <div className="tg-student-stat">
          <span className="tg-muted">{t("tSd.lastActivity")}</span>
          <strong className="tg-student-stat-sm">
            {activity ? `${activity.prefix} · ${activity.dateLabel}` : "—"}
          </strong>
        </div>
      </div>

      <div className="tg-student-tabs" role="tablist" aria-label={t("tSd.tabsLabel")}>
        {SUB_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={subTab === item.id}
            className={subTab === item.id ? "is-active" : ""}
            onClick={() => setSubTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="tg-student-body">
        {subTab === "overview" ? (
          <div className="tg-student-grid">
            {attentionItems.length ? (
              <section className="tg-student-card tg-student-card-wide tg-student-attention">
                <h4>{t("tSd.needsAttention")}</h4>
                <div className="tg-reason-chips">
                  {attentionItems.map((item) => (
                    <span key={item.label} className={`tg-reason-chip tg-reason-${item.tone}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={`tg-student-card tg-debt-card${debt > 0 ? " has-debt" : ""}`}>
              <h4>{t("tSd.debt")}</h4>
              <p className="tg-debt-label">{t("tSd.currentDebt")}</p>
              <p className={`tg-debt-value${debt > 0 ? " is-debt" : ""}`}>
                {debt > 0 ? money(debt, currency) : t("tSd.noDebt")}
              </p>
            </section>

            <section className="tg-student-card">
              <h4>{t("tSd.contacts")}</h4>
              <dl className="tg-kv">
                <div>
                  <dt>{t("tSd.phone")}</dt>
                  <dd>{phoneDisplay}</dd>
                </div>
                <div>
                  <dt>{t("tSd.birthDate")}</dt>
                  <dd>{formatDate(student.birth_date)}</dd>
                </div>
                {guardians.length ? (
                  guardians.map((item) => (
                    <div key={item.id || `${item.full_name}-${item.phone}`}>
                      <dt>{item.full_name || t("tSd.parent")}</dt>
                      <dd>{formatUzPhone(item.phone) || item.phone || "—"}</dd>
                    </div>
                  ))
                ) : (
                  <div>
                    <dt>{t("tSd.parents")}</dt>
                    <dd>—</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="tg-student-card">
              <h4>{t("tSd.study")}</h4>
              <dl className="tg-kv">
                <div>
                  <dt>{t("tSd.group")}</dt>
                  <dd>{group?.name || "—"}</dd>
                </div>
                <div>
                  <dt>{t("tSd.course")}</dt>
                  <dd>{courseName || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="tg-student-card">
              <h4>{t("tSd.attendance")}</h4>
              <dl className="tg-kv">
                <div>
                  <dt>{t("tSd.total")}</dt>
                  <dd className={`tg-att-${getAttendanceTone(attendanceStats?.pct)}`}>
                    {attendanceStats?.pct != null ? `${attendanceStats.pct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{t("tSd.presentRow")}</dt>
                  <dd>{attendanceStats?.present ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("tSd.lateRow")}</dt>
                  <dd>{attendanceStats?.late ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("tSd.absencesRow")}</dt>
                  <dd>{attendanceStats?.absent ?? "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="tg-student-card tg-student-card-wide">
              <h4>{t("tSd.recentAssignments")}</h4>
              {submissions.length ? (
                <ul className="tg-student-rows">
                  {submissions.slice(0, 4).map((row) => {
                    const assignment = assignmentMap.get(String(row.assignment));
                    return (
                      <li key={row.id}>
                        <span>{assignment?.title || t("tSd.assignment")}</span>
                        <div className="tg-student-row-meta">
                          <span className={`tg-pill ${statusPill(row.status)}`}>
                            {ASSIGNMENT_STATUS_LABELS[row.status] || row.status}
                          </span>
                          {row.score != null ? <strong>{row.score}</strong> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="tg-muted">{t("tSd.noAssignments")}</p>
              )}
            </section>
          </div>
        ) : null}

        {subTab === "attendance" ? (
          <section className="tg-student-card">
            <h4>{t("tSd.attendanceHistory")}</h4>
            {attendanceStats?.recent?.length ? (
              <ul className="tg-student-rows">
                {attendanceStats.recent.map((row) => (
                  <li key={row.date}>
                    <span>{formatDate(row.date)}</span>
                    <span className={`tg-pill ${ATTENDANCE_PILL[row.status] || ""}`}>
                      {ATTENDANCE_LABELS[row.status] || row.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tg-muted">{t("tSd.noAttendance")}</p>
            )}
          </section>
        ) : null}

        {subTab === "assignments" ? (
          <section className="tg-student-card">
            <div className="tg-student-card-head">
              <h4>{t("tSd.assignments")}</h4>
              <span className="tg-muted">
                {t("tSd.handedSummary", { done: submitted.length, missing: missingCount })}
              </span>
            </div>
            {submissions.length ? (
              <ul className="tg-student-rows tg-student-rows-tall">
                {submissions.map((row) => {
                  const assignment = assignmentMap.get(String(row.assignment));
                  return (
                    <li key={row.id}>
                      <div>
                        <strong>{assignment?.title || t("tSd.assignment")}</strong>
                        {assignment?.due_at ? (
                          <p className="tg-muted">{t("tSd.due", { date: formatDate(assignment.due_at) })}</p>
                        ) : null}
                      </div>
                      <div className="tg-student-row-meta">
                        <span className={`tg-pill ${statusPill(row.status)}`}>
                          {ASSIGNMENT_STATUS_LABELS[row.status] || row.status}
                        </span>
                        {row.score != null ? (
                          <strong>
                            {row.score}
                            {assignment?.max_score ? ` / ${assignment.max_score}` : ""}
                          </strong>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="tg-muted">{t("tSd.noAssignments")}</p>
            )}
          </section>
        ) : null}

        {subTab === "results" ? (
          <section className="tg-student-card">
            <h4>{t("tSd.results")}</h4>
            <p className="tg-student-avg">
              {t("tSd.averageLine")} <strong>{avg != null ? `${avg}%` : "—"}</strong>
            </p>
            {graded.length ? (
              <ul className="tg-student-rows">
                {graded.map((row) => {
                  const assignment = assignmentMap.get(String(row.assignment));
                  return (
                    <li key={row.id}>
                      <div>
                        <strong>{assignment?.title || t("tSd.assignment")}</strong>
                        <p className="tg-muted">
                          {row.graded_at ? formatDate(row.graded_at) : "—"}
                        </p>
                      </div>
                      <div className="tg-student-row-meta">
                        <strong>
                          {row.score}
                          {assignment?.max_score ? ` / ${assignment.max_score}` : ""}
                        </strong>
                        {row.feedback ? <span className="tg-muted">{row.feedback}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="tg-muted">{t("tSd.noGrades")}</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );

  if (inline) return body;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="drawer teacher-drawer tg-student-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={student.full_name || student.name || t("tSd.student")}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </aside>
    </div>,
    document.body,
  );
}

function statusPill(status) {
  if (status === "graded") return "tg-pill-green";
  if (status === "not_submitted") return "tg-pill-warn";
  return "tg-pill-blue";
}
