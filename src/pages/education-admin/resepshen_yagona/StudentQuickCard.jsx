import { useEffect, useState } from "react";
import { CloseButton } from "@/components/ui";
import { initialsOf } from "@/components/layout/FigmaChrome";
import { STATUS_LABELS } from "@/constants";
import { api } from "@/services/api/client";
import { formatDate, formatTime, formatUzPhone, money, results } from "@/utils/format";
import { t } from "@/i18n";
import { invoiceBalance } from "./utils";
import { IconCard, IconCheck, IconPhone } from "./rxIcons";

const MARKS = ["present", "late", "absent", "excused"];

function ageOf(birthDate) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function invoicePill(invoice) {
  if (invoice.status === "overdue") return <span className="rx-pill is-red">{t("rxSheet.invOverdue")}</span>;
  if (invoice.status === "partially_paid") return <span className="rx-pill is-amber">{t("rxSheet.invPartial")}</span>;
  return <span className="rx-pill is-red">{t("rxSheet.invUnpaid")}</span>;
}

/* Figma 02 «Карточка ученика (из поиска)»: everything the front desk needs about one student. */
export default function StudentQuickCard({
  open,
  student,
  groupName,
  courseName,
  teacherName,
  parent,
  debt,
  invoices = [],
  currency,
  todayLesson,
  onClose,
  onPay,
  onNotify,
  onFullProfile,
  onSaved,
}) {
  const [history, setHistory] = useState([]);
  const [todayMark, setTodayMark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const studentId = student?.id;
  const lessonId = todayLesson?.lesson?.id;

  useEffect(() => {
    if (!open || !studentId) return undefined;
    let alive = true;
    setError("");
    setHistory([]);
    api
      .get(`/attendance?student=${encodeURIComponent(studentId)}&page_size=10&ordering=-lesson__starts_at`)
      .then((data) => alive && setHistory(results(data)))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [open, studentId]);

  useEffect(() => {
    if (!open || !studentId || !lessonId) {
      setTodayMark("");
      return undefined;
    }
    let alive = true;
    api
      .get(`/lessons/${lessonId}/attendance`)
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : results(data);
        setTodayMark(list.find((row) => String(row.student) === String(studentId))?.status || "");
      })
      .catch(() => alive && setTodayMark(""));
    return () => {
      alive = false;
    };
  }, [open, studentId, lessonId]);

  if (!open || !student) return null;

  async function mark(status) {
    if (!lessonId) return;
    setSaving(true);
    setError("");
    try {
      const existing = await api.get(`/lessons/${lessonId}/attendance`);
      const list = Array.isArray(existing) ? existing : results(existing);
      const others = list
        .filter((row) => String(row.student) !== String(student.id))
        .map((row) => ({ student: row.student, status: row.status, comment: row.comment || "" }));
      await api.put(`/lessons/${lessonId}/attendance`, {
        entries: [...others, { student: student.id, status, comment: status === "present" ? "Ресепшн" : "" }],
      });
      setTodayMark(status);
      onSaved?.(t("aMark.arrivalMarked"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const age = ageOf(student.birth_date);
  const openInvoices = invoices
    .filter((inv) => !["paid", "void", "canceled", "cancelled"].includes(inv.status))
    .sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0));
  const nextDue = openInvoices[0]?.due_at;
  const counts = MARKS.reduce((acc, key) => ({ ...acc, [key]: history.filter((row) => row.status === key).length }), {});
  const squares = [...history].reverse();

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aSqc.studentCard")}>
      <button type="button" className="overlay-backdrop" aria-label={t("aSqc.close")} onClick={onClose} tabIndex={-1} />
      <div className="sheet rx-student-card">
        <div className="sheet-head">
          <div className="rx-sheet-person">
            <span className="rx-av is-soft">{initialsOf(student.full_name)}</span>
            <div style={{ minWidth: 0 }}>
              <h2>{student.full_name}</h2>
              <p className="muted">
                {student.phone ? formatUzPhone(student.phone) : t("aSqc.noPhone")}
                {age !== null ? ` · ${t("rxSheet.age", { count: age })}` : ""}
              </p>
              <div className="rx-sheet-tags">
                <span className={`rx-pill ${student.status === "active" ? "is-teal" : ""}`}>
                  {student.status === "active" ? t("rxSheet.studying") : STATUS_LABELS[student.status] || student.status}
                </span>
                {debt > 0 ? <span className="rx-pill is-red">{t("aSqc.debt")}</span> : null}
              </div>
            </div>
          </div>
          <CloseButton onClick={onClose} className="sheet-close" label={t("aSqc.close")} />
        </div>

        <div className="rx-sheet-actions">
          <button
            type="button"
            className="rx-btn is-teal"
            disabled={!lessonId || saving || todayMark === "present"}
            onClick={() => mark("present")}
            title={!lessonId ? t("aMark.thereAreNoLessons") : undefined}
          >
            <IconCheck size={18} />
            {todayMark === "present" ? t("rxSheet.arrived") : t("aSqc.markArrival")}
          </button>
          <button type="button" className="rx-btn is-primary" onClick={onPay}>
            <IconCard size={18} />
            {t("aSqc.takePayment")}
          </button>
          {student.phone ? (
            <a className="rx-icon-btn is-teal" href={`tel:${student.phone}`} aria-label={t("aSqc.call")} title={t("aSqc.call")}>
              <IconPhone size={18} />
            </a>
          ) : (
            <span />
          )}
        </div>

        <div className="sheet-body">
          {error ? <p className="field-message error">{error}</p> : null}

          <section className="rx-sheet-section">
            <h3 className="rx-sheet-label">{t("rxSheet.today")}</h3>
            {todayLesson ? (
              <div className="rx-today-lesson">
                <div className="rx-today-lesson-head">
                  <span className="rx-hit-copy">
                    <strong>
                      {formatTime(todayLesson.lesson.starts_at)} · {todayLesson.groupName || groupName || "—"}
                    </strong>
                    <small>{[todayLesson.roomName, todayLesson.teacherName].filter(Boolean).join(" · ")}</small>
                  </span>
                  {todayMark ? (
                    <span className="rx-pill is-teal">{STATUS_LABELS[todayMark] || todayMark}</span>
                  ) : (
                    <span className="rx-pill is-amber">{t("rxSheet.notMarked")}</span>
                  )}
                </div>
                <div className="rx-att-buttons">
                  {[
                    ["present", t("aMark.present")],
                    ["late", t("aMark.late")],
                    ["absent", t("aMark.absent")],
                    ["excused", t("rxSheet.excusedShort")],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      className={`${todayMark === value ? "is-active" : ""} is-${value}`}
                      aria-pressed={todayMark === value}
                      onClick={() => mark(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rx-empty">{t("aMark.thereAreNoLessons")}</p>
            )}
          </section>

          <section className="rx-sheet-section">
            <h3 className="rx-sheet-label">{t("aSqc.finance")}</h3>
            <div className="rx-tiles">
              <div className={`rx-tile${debt > 0 ? " is-red" : ""}`}>
                <span>{t("aSqc.debt")}</span>
                <strong>{money(debt || 0, currency)}</strong>
              </div>
              <div className="rx-tile">
                <span>{t("aQps.openInvoices")}</span>
                <strong>{openInvoices.length}</strong>
              </div>
              <div className="rx-tile">
                <span>{t("rxSheet.payBy")}</span>
                <strong>{nextDue ? formatDate(nextDue) : "—"}</strong>
              </div>
            </div>
            {openInvoices.length ? (
              <ul className="rx-invoices">
                {openInvoices.slice(0, 4).map((inv) => (
                  <li key={inv.id}>
                    <span className="rx-hit-copy">
                      <strong>
                        {t("rxSheet.invoiceNo", { number: inv.number || String(inv.id).slice(0, 6) })}
                        {inv.description ? ` · ${inv.description}` : ""}
                      </strong>
                      <small>{inv.due_at ? t("rxSheet.dueOn", { date: formatDate(inv.due_at) }) : ""}</small>
                    </span>
                    <strong>{money(invoiceBalance(inv), inv.currency || currency)}</strong>
                    {invoicePill(inv)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rx-sheet-section">
            <h3 className="rx-sheet-label">{t("aSqc.learning")}</h3>
            <dl className="rx-dl">
              <div>
                <dt>{t("aSqc.group")}</dt>
                <dd>{groupName || "—"}</dd>
              </div>
              <div>
                <dt>{t("aSqc.course")}</dt>
                <dd>{courseName || "—"}</dd>
              </div>
              <div>
                <dt>{t("aSqc.teacher")}</dt>
                <dd>{teacherName || "—"}</dd>
              </div>
              <div>
                <dt>{t("aSqc.parent")}</dt>
                <dd>
                  {parent?.full_name || "—"}
                  {parent?.phone ? (
                    <>
                      {" · "}
                      <a href={`tel:${parent.phone}`}>{formatUzPhone(parent.phone)}</a>
                    </>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rx-sheet-section">
            <h3 className="rx-sheet-label">{t("rxSheet.lastLessons")}</h3>
            {history.length ? (
              <>
                <div className="rx-att-squares" aria-hidden="true">
                  {squares.map((row) => (
                    <i key={row.id} className={`is-${row.status}`} title={STATUS_LABELS[row.status] || row.status} />
                  ))}
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  {t("rxSheet.attSummary", { present: counts.present, late: counts.late, absent: counts.absent + counts.excused })}
                </p>
              </>
            ) : (
              <p className="rx-empty">{t("aSqc.noRecentMarks")}</p>
            )}
          </section>

          <div className="rx-sheet-section rx-card-links">
            <button type="button" className="rx-link" onClick={onFullProfile}>
              {t("rxSheet.openFullCard")} →
            </button>
            <button type="button" className="rx-link" onClick={onNotify}>
              {t("aSqc.notification")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
