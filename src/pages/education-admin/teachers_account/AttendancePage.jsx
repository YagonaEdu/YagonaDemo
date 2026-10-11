import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { lessonDisplayState } from "@/components/schedule/WeekSchedule";
import { useAsync } from "@/hooks/useAsync";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import AttendancePage from "@/pages/education-admin/AttendancePage";
import { api } from "@/services/api/client";
import { buildQuery, fetchAll } from "@/services/api/paginate";
import { formatDayLong, formatTime, sameDay, shiftDays } from "@/utils/format";
import { formatDateTime, t, translated } from "@/i18n";
import CreateAssignmentSheet from "./CreateAssignmentSheet";

const STATUSES = [
  { value: "present", label: "t:tAtt.presentShort", full: "t:tAtt.presentFull" },
  { value: "late", label: "t:tAtt.lateShort", full: "t:tAtt.lateFull" },
  { value: "absent", label: "t:tAtt.absentShort", full: "t:tAtt.absentFull" },
  { value: "excused", label: "t:tAtt.excusedShort", full: "t:tAtt.excusedFull" },
].map(translated);

const TAB_KEY = "yagona-teacher-attendance-tab";
const AV_TONES = ["blue", "teal", "navy", "violet", "amber"];

function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function groupCode(name) {
  const text = String(name || "").trim();
  return text.length <= 5 ? text.toUpperCase() : initials(text);
}

/** "+998901234567" → "+998 90 •• •• 67" (the Figma journal hides most of the number). */
function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) return phone || "";
  return `+998 ${digits.slice(-9, -7)} •• •• ${digits.slice(-2)}`;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function StatusIcon({ status }) {
  if (status === "present") return <CheckIcon />;
  if (status === "late") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2" />
      </svg>
    );
  }
  if (status === "absent") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    );
  }
  return <span className="tj-opt-text">{t("tAtt.excusedLetter")}</span>;
}

function lessonOptionLabel(lesson) {
  const day = sameDay(lesson.starts_at, Date.now())
    ? t("tAtt.today")
    : formatDateTime(lesson.starts_at, { weekday: "short", day: "numeric", month: "short" });
  return t("tAtt.lessonOption", { day, time: formatTime(lesson.starts_at), group: lesson.group_name || t("tAtt.group") });
}

function pickDefaultLesson(lessons, now = Date.now()) {
  const today = lessons.filter((lesson) => sameDay(lesson.starts_at, now) && lesson.status !== "cancelled");
  const live = today.find((lesson) => lessonDisplayState(lesson, now) === "ongoing");
  if (live) return live;
  const upcoming = today
    .filter((lesson) => new Date(lesson.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  if (upcoming) return upcoming;
  return lessons.find((lesson) => new Date(lesson.starts_at).getTime() <= now) || lessons[0] || null;
}

function sameMarks(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key]?.status || "") !== (b[key]?.status || "")) return false;
    if ((a[key]?.comment || "") !== (b[key]?.comment || "")) return false;
  }
  return true;
}

function MarkLesson({ onDirtyChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, showToast] = useToast();
  const lessonsState = useAsync(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const to = shiftDays(end, 2);
    const from = shiftDays(end, -21);
    return fetchAll(
      `/lessons${buildQuery({
        page_size: 100,
        ordering: "-starts_at",
        starts_at_from: from.toISOString(),
        starts_at_to: to.toISOString(),
      })}`,
    );
  });
  const studentsState = useAsync(() => fetchAll(`/students${buildQuery({ page_size: 100 })}`));

  const lessons = useMemo(() => lessonsState.data || [], [lessonsState.data]);
  const requestedId = searchParams.get("lesson") || "";
  const [extraLesson, setExtraLesson] = useState(null);

  // A lesson linked from elsewhere may be outside the picker window: fetch it directly.
  useEffect(() => {
    if (!requestedId || lessonsState.loading) return;
    if (lessons.some((lesson) => String(lesson.id) === requestedId)) return;
    let alive = true;
    api
      .get(`/lessons/${requestedId}`)
      .then((lesson) => alive && setExtraLesson(lesson))
      .catch(() => alive && setExtraLesson(null));
    return () => {
      alive = false;
    };
  }, [requestedId, lessons, lessonsState.loading]);

  const options = useMemo(() => {
    const list = extraLesson && !lessons.some((item) => item.id === extraLesson.id) ? [extraLesson, ...lessons] : lessons;
    return list;
  }, [lessons, extraLesson]);

  const lesson = useMemo(() => {
    if (requestedId) return options.find((item) => String(item.id) === requestedId) || null;
    return pickDefaultLesson(lessons);
  }, [options, lessons, requestedId]);

  const [roster, setRoster] = useState({ loading: false, error: null, enrollments: [] });
  const [saved, setSaved] = useState({});
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [openComment, setOpenComment] = useState("");
  const [homeworkOpen, setHomeworkOpen] = useState(false);

  const dirty = !sameMarks(marks, saved);
  const confirmLeave = useUnsavedChanges(dirty);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const loadLesson = useCallback(async (target) => {
    if (!target) return;
    setRoster({ loading: true, error: null, enrollments: [] });
    setSaveError("");
    try {
      const [enrollments, attendance] = await Promise.all([
        fetchAll(`/enrollments${buildQuery({ group: target.group, status: "active", page_size: 100 })}`),
        api.get(`/lessons/${target.id}/attendance`),
      ]);
      const current = {};
      for (const row of attendance || []) {
        current[String(row.student)] = { status: row.status, comment: row.comment || "" };
      }
      setSaved(current);
      setMarks(current);
      setRoster({ loading: false, error: null, enrollments });
    } catch (error) {
      setRoster({ loading: false, error, enrollments: [] });
    }
  }, []);

  useEffect(() => {
    loadLesson(lesson);
  }, [lesson, loadLesson]);

  const studentMap = useMemo(
    () => new Map((studentsState.data || []).map((row) => [String(row.id), row])),
    [studentsState.data],
  );

  const rows = useMemo(() => {
    const ids = new Set(roster.enrollments.map((row) => String(row.student)));
    // Keep students who already have a mark even if they left the group since.
    Object.keys(saved).forEach((id) => ids.add(id));
    return [...ids]
      .map((id) => ({ id, name: studentMap.get(id)?.full_name || t("tAtt.student") }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [roster.enrollments, saved, studentMap]);

  const counts = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
    rows.forEach((row) => {
      const status = marks[row.id]?.status;
      if (status && result[status] != null) result[status] += 1;
      else result.none += 1;
    });
    return result;
  }, [rows, marks]);

  function chooseLesson(id) {
    if (String(lesson?.id) === id) return;
    if (!confirmLeave()) return;
    setSearchParams(id ? { lesson: id } : {}, { replace: true });
  }

  function setStatus(studentId, status) {
    setMarks((prev) => ({ ...prev, [studentId]: { comment: "", ...prev[studentId], status } }));
  }

  function setComment(studentId, comment) {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], comment } }));
  }

  function markAllPresent() {
    setMarks((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        next[row.id] = { comment: "", ...prev[row.id], status: "present" };
      });
      return next;
    });
  }

  async function save() {
    const entries = rows
      .filter((row) => marks[row.id]?.status)
      .map((row) => ({
        student: row.id,
        status: marks[row.id].status,
        comment: (marks[row.id].comment || "").trim(),
      }));
    if (!entries.length) {
      setSaveError(t("tAtt.markAtLeastOne"));
      return;
    }
    setBusy(true);
    setSaveError("");
    try {
      const result = await api.put(`/lessons/${lesson.id}/attendance`, { entries });
      const next = {};
      for (const row of result || []) next[String(row.student)] = { status: row.status, comment: row.comment || "" };
      setSaved(next);
      setMarks(next);
      showToast(t("tAtt.saved", { count: entries.length }));
    } catch (error) {
      setSaveError(error.message || t("tAtt.saveFailed"));
      showToast(t("tAtt.saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  if (lessonsState.loading) {
    return (
      <div className="ta-layout" aria-busy="true">
        <Skeleton height={96} radius={20} />
        <Skeleton lines={6} height={52} />
      </div>
    );
  }
  if (lessonsState.error) {
    return <ErrorState message={lessonsState.error.message} onRetry={lessonsState.reload} />;
  }
  if (!options.length) {
    return (
      <div className="sx-card">
        <EmptyState
          title={t("tAtt.noLessonsTitle")}
          body={t("tAtt.noLessonsBody")}
        />
      </div>
    );
  }

  const state = lesson ? lessonDisplayState(lesson) : null;
  const cancelled = lesson?.status === "cancelled";
  const isToday = lesson ? sameDay(lesson.starts_at, Date.now()) : false;
  const topic = (lesson?.topic || "").split("·")[0].trim();

  return (
    <div className="ta-layout tj-layout">
      {lesson ? (
        <CreateAssignmentSheet
          open={homeworkOpen}
          onClose={() => setHomeworkOpen(false)}
          groups={[{ id: lesson.group, name: lesson.group_name }]}
          initialGroup={String(lesson.group)}
          initialLesson={String(lesson.id)}
          lockGroup
          onSaved={() => {
            setHomeworkOpen(false);
            showToast(t("tAtt.homeworkSaved"));
          }}
        />
      ) : null}

      {/* Journal header (Figma 45:2): group tile, lesson, actions. */}
      <section className="sx-card tj-head">
        {lesson ? (
          <>
            <span className="tj-code">{groupCode(lesson.group_name)}</span>
            <div className="tj-title">
              <h2>
                {lesson.course_name || t("tAtt.lesson")}
                {lesson.group_name ? ` · ${lesson.group_name}` : ""}
                <span className={`tj-state is-${state}`}>
                  {t(
                    {
                      ongoing: "tAtt.stateOngoing",
                      scheduled: "tAtt.stateScheduled",
                      completed: "tAtt.stateCompleted",
                      cancelled: "tAtt.stateCancelled",
                    }[state] || "tAtt.stateScheduled",
                  )}
                </span>
              </h2>
              <p>
                {isToday ? t("tAtt.today") : formatDayLong(lesson.starts_at)} {formatTime(lesson.starts_at)} – {formatTime(lesson.ends_at)}
                {lesson.room_name ? t("tAtt.room", { room: lesson.room_name }) : ""}
                {topic ? t("tAtt.topic", { topic }) : ""}
              </p>
            </div>
          </>
        ) : (
          <div className="tj-title">
            <h2>{t("tAtt.notFoundTitle")}</h2>
            <p>{t("tAtt.notFoundBody")}</p>
          </div>
        )}
        <div className="tj-actions">
          <label className="tj-select">
            <select value={lesson ? String(lesson.id) : ""} onChange={(event) => chooseLesson(event.target.value)} aria-label={t("tAtt.pickLesson")}>
              {!lesson ? <option value="">{t("tAtt.pickLessonOption")}</option> : null}
              {options.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {lessonOptionLabel(item)}
                  {item.status === "cancelled" ? t("tAtt.cancelledSuffix") : ""}
                </option>
              ))}
            </select>
          </label>
          {lesson && !cancelled ? (
            <>
              <button type="button" className="sx-btn sx-btn-outline sx-btn-sm" onClick={() => setHomeworkOpen(true)}>
                {t("tAtt.addHomework")}
              </button>
              <button
                type="button"
                className="sx-btn sx-btn-teal sx-btn-sm"
                onClick={markAllPresent}
                disabled={!rows.length || roster.loading}
              >
                <CheckIcon />
                {t("tAtt.allPresent")}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {cancelled ? (
        <p className="ta-note">{t("tAtt.cancelledNote")}</p>
      ) : roster.loading ? (
        <Skeleton lines={6} height={52} />
      ) : roster.error ? (
        <ErrorState message={roster.error.message} onRetry={() => loadLesson(lesson)} />
      ) : lesson ? (
        <section className="sx-card sx-table-card tj-card">
          {rows.length ? (
            <div className="sx-table-wrap">
              <table className="sx-table tj-table">
                <thead>
                  <tr>
                    <th className="tj-num">#</th>
                    <th>{t("tAtt.student")}</th>
                    <th className="tj-today">
                      {isToday
                        ? t("tAtt.today")
                        : formatDateTime(lesson.starts_at, { day: "2-digit", month: "2-digit" })}
                    </th>
                    <th aria-label={t("tAtt.comment")} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const mark = marks[row.id] || {};
                    const changed =
                      (mark.status || "") !== (saved[row.id]?.status || "") || (mark.comment || "") !== (saved[row.id]?.comment || "");
                    const phone = studentMap.get(row.id)?.phone;
                    return (
                      <Fragment key={row.id}>
                        <tr className={`tj-row${changed ? " is-changed" : ""}`}>
                          <td className="tj-num">{index + 1}</td>
                          <td>
                            <div className="tj-student">
                              <span className={`tx-av is-${AV_TONES[index % AV_TONES.length]}`}>{initials(row.name)}</span>
                              <span className="sx-cell-title">
                                <strong>{row.name}</strong>
                                <span>{mark.comment && openComment !== row.id ? `«${mark.comment}»` : maskPhone(phone)}</span>
                              </span>
                            </div>
                          </td>
                          <td className="tj-today">
                            <div className="tj-toggle" role="radiogroup" aria-label={t("tAtt.statusFor", { name: row.name })}>
                              {STATUSES.map((item) => (
                                <button
                                  key={item.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={mark.status === item.value}
                                  title={item.full}
                                  aria-label={item.full}
                                  className={`tj-opt is-${item.value}${mark.status === item.value ? " is-on" : ""}`}
                                  onClick={() => setStatus(row.id, item.value)}
                                >
                                  <StatusIcon status={item.value} />
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="tj-comment-cell">
                            <button
                              type="button"
                              className={`ta-comment-btn${mark.comment ? " has-comment" : ""}`}
                              aria-label={t("tAtt.comment")}
                              aria-expanded={openComment === row.id}
                              onClick={() => setOpenComment((value) => (value === row.id ? "" : row.id))}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {openComment === row.id ? (
                          <tr className="tj-comment-row">
                            <td />
                            <td colSpan={3}>
                              <input
                                className="ta-comment-input"
                                value={mark.comment || ""}
                                maxLength={500}
                                placeholder={t("tAtt.commentPlaceholder")}
                                onChange={(event) => setComment(row.id, event.target.value)}
                                autoFocus
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={t("tAtt.emptyGroupTitle")} body={t("tAtt.emptyGroupBody")} />
          )}
        </section>
      ) : null}

      {lesson && !cancelled && !roster.loading && rows.length ? (
        <div className="tj-foot">
          <ul className="tj-legend">
            <li className="is-present">{t("tAtt.legendPresent", { count: counts.present })}</li>
            <li className="is-late">{t("tAtt.legendLate", { count: counts.late })}</li>
            <li className="is-absent">{t("tAtt.legendAbsent", { count: counts.absent })}</li>
            {counts.excused ? <li className="is-excused">{t("tAtt.legendExcused", { count: counts.excused })}</li> : null}
            {counts.none ? <li className="is-none">{t("tAtt.legendNone", { count: counts.none })}</li> : null}
          </ul>
          <div className="tj-save">
            {saveError ? (
              <span className="tj-error" role="alert">
                {saveError}
              </span>
            ) : dirty ? (
              <span className="tj-dirty">{t("tAtt.unsaved")}</span>
            ) : null}
            {dirty ? (
              <button type="button" className="sx-btn sx-btn-outline sx-btn-sm" onClick={() => setMarks(saved)}>
                {t("tAtt.revert")}
              </button>
            ) : null}
            <button type="button" className="sx-btn sx-btn-primary" onClick={save} disabled={busy || !dirty}>
              <CheckIcon />
              {t(busy ? "tAtt.saving" : "tAtt.save")}
            </button>
          </div>
        </div>
      ) : null}
      {toast}
    </div>
  );
}

export default function TeacherAttendancePage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    if (searchParams.get("lesson")) return "mark";
    try {
      return localStorage.getItem(TAB_KEY) === "reports" ? "reports" : "mark";
    } catch {
      return "mark";
    }
  });
  const [markDirty, setMarkDirty] = useState(false);
  const activeTab = tab;
  const lessonParam = searchParams.get("lesson");

  useEffect(() => {
    if (lessonParam) setTab("mark");
  }, [lessonParam]);

  function choose(next) {
    if (next === tab) return;
    if (markDirty && !window.confirm(t("ui.unsavedLeave"))) return;
    setMarkDirty(false);
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div className="teacher-page ta-page">
      <header className="ta-head">
        <div>
          <h1>{t("tAtt.title")}</h1>
          <p>{t("tAtt.sub")}</p>
        </div>
        <div className="sx-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "mark"}
            className={`sx-tab${activeTab === "mark" ? " is-active" : ""}`}
            onClick={() => choose("mark")}
          >
            {t("tAtt.tabMark")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reports"}
            className={`sx-tab${activeTab === "reports" ? " is-active" : ""}`}
            onClick={() => choose("reports")}
          >
            {t("tAtt.tabOverview")}
          </button>
        </div>
      </header>
      {activeTab === "mark" ? (
        <MarkLesson onDirtyChange={setMarkDirty} />
      ) : (
        <div className="teacher-attendance-wrap">
          <AttendancePage />
        </div>
      )}
    </div>
  );
}
