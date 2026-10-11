import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banner, Button, CloseButton, EmptyState, Field } from "@/components/ui";
import { api, invalidateApiCache } from "@/services/api/client";
import { educationSegmentPath } from "@/utils/routes";
import { formatDate, formatTime } from "@/utils/format";
import { formatDateTime, t, translated } from "@/i18n";
import GroupContextMenu from "./GroupContextMenu";
import StudentDrawer from "./StudentDrawer";
import {
  avatarColor,
  buildLessonAttendanceSummary,
  buildScheduleSummary,
  computeGroupAttendancePct,
  buildStudentAttendanceStats,
  computeStudentAttendancePct,
  formatRuleTime,
  getAttendanceTone,
  getStudentStatus,
  needsAttendanceAction,
  reviewPendingCount,
  studentInitials,
  WEEKDAY_FULL,
} from "./groupHelpers";
import { IconGroups } from "./tgIcons";

const TABS = [
  { id: "students", label: "t:tGd.tabStudents" },
  { id: "attendance", label: "t:tGd.tabAttendance" },
  { id: "assignments", label: "t:tGd.tabAssignments" },
  { id: "results", label: "t:tGd.tabResults" },
  { id: "materials", label: "t:tGd.tabMaterials" },
  { id: "schedule", label: "t:tGd.tabSchedule" },
].map(translated);

const ASSIGNMENT_FILTERS = [
  { id: "active", label: "t:tGd.filterActive" },
  { id: "review", label: "t:tGd.filterReview" },
  { id: "draft", label: "t:tGd.filterDraft" },
].map(translated);

const MATERIAL_TYPES = translated({
  link: "t:tGd.link",
  video: "t:tGd.video",
  file: "t:tGd.file",
  pdf: "t:tGd.pdf",
});

export default function GroupDetailPanel({
  inline = false,
  group,
  teacherName = "",
  initialTab = "students",
  onTabChange,
  onClose,
  enrollments = [],
  students = [],
  assignments = [],
  submissions = [],
  materials = [],
  rules = [],
  lessons = [],
  attendanceByLesson = {},
  courseName = "",
  roomMap = new Map(),
  onOpenAttendance,
  onCreateAssignment,
  onOpenSchedule,
  onOpenAssignments,
  onNotify,
  onRefresh,
}) {
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const path = (segment) => educationSegmentPath(tenantSlug, segment);

  const [tab, setTab] = useState(initialTab);
  const [assignmentFilter, setAssignmentFilter] = useState("active");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    title: "",
    description: "",
    material_type: "link",
    link: "",
    is_published: true,
  });
  const [materialError, setMaterialError] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, group?.id]);

  useEffect(() => {
    setTab("students");
    setSelectedStudent(null);
    setMaterialFormOpen(false);
    setAssignmentFilter("active");
  }, [group?.id]);

  useEffect(() => {
    if (initialTab === "materials") setMaterialFormOpen(true);
  }, [initialTab, group?.id]);

  function switchTab(next) {
    setTab(next);
    onTabChange?.(next);
  }

  const studentMap = useMemo(
    () => new Map(students.map((row) => [String(row.id), row])),
    [students],
  );

  const groupStudents = useMemo(
    () =>
      enrollments
        .filter((row) => String(row.group) === String(group?.id) && row.status === "active")
        .map((row) => studentMap.get(String(row.student)))
        .filter(Boolean),
    [enrollments, group?.id, studentMap],
  );

  const schedule = useMemo(() => buildScheduleSummary(rules), [rules]);
  const roomName = useMemo(() => {
    const roomId = rules.find((row) => row.is_active !== false)?.room;
    return roomMap.get(String(roomId)) || group?.roomName || "—";
  }, [rules, roomMap, group?.roomName]);

  const attendancePct = useMemo(
    () => (group ? computeGroupAttendancePct(lessons, attendanceByLesson, group.id) : null),
    [group, lessons, attendanceByLesson],
  );

  const pastLessons = useMemo(
    () =>
      lessons
        .filter((row) => new Date(row.starts_at) < new Date())
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
        .slice(0, 12),
    [lessons],
  );

  const upcomingLessons = useMemo(
    () =>
      lessons
        .filter((row) => new Date(row.ends_at) >= Date.now())
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
        .slice(0, 6),
    [lessons],
  );

  const attendanceSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    pastLessons.forEach((lesson) => {
      const marks = attendanceByLesson[lesson.id] || [];
      present += marks.filter((row) => row.status === "present").length;
      late += marks.filter((row) => row.status === "late").length;
      absent += marks.filter((row) => row.status === "absent").length;
    });
    return { present, late, absent };
  }, [pastLessons, attendanceByLesson]);

  const publishedAssignments = useMemo(
    () => assignments.filter((row) => row.status === "published"),
    [assignments],
  );

  /** Average of graded work as a percentage of each assignment's max score (raw points can't be shown as %). */
  const averagePct = useMemo(() => {
    const maxById = new Map(assignments.map((row) => [String(row.id), Number(row.max_score) || 0]));
    return (graded) => {
      const pcts = graded
        .map((row) => {
          const max = maxById.get(String(row.assignment));
          return max > 0 && row.score != null ? (Number(row.score) / max) * 100 : null;
        })
        .filter((value) => value != null);
      return pcts.length ? Math.round(pcts.reduce((sum, value) => sum + value, 0) / pcts.length) : null;
    };
  }, [assignments]);

  const pendingReviewsTotal = useMemo(
    () => publishedAssignments.reduce((sum, row) => sum + reviewPendingCount(row), 0),
    [publishedAssignments],
  );

  const studentRows = useMemo(() => {
    return groupStudents.map((student) => {
      const studentSubs = submissions.filter((row) => String(row.student) === String(student.id));
      const graded = studentSubs.filter((row) => row.status === "graded");
      const avg = averagePct(graded);
      const done = studentSubs.filter((row) => row.status !== "not_submitted").length;
      const missing = studentSubs.filter((row) => row.status === "not_submitted").length;
      const total = publishedAssignments.length;
      const attendancePctValue = computeStudentAttendancePct(
        student.id,
        lessons,
        attendanceByLesson,
        group?.id,
      );
      const status = getStudentStatus({
        attendancePct: attendancePctValue,
        missingCount: missing,
        totalAssignments: total,
        studentStatus: student.status,
      });

      return {
        ...student,
        attendancePct: attendancePctValue,
        assignmentsDone: total ? `${done} / ${total}` : "—",
        avgScore: avg != null ? `${avg}%` : "—",
        avgRaw: avg,
        studentSubs,
        status,
      };
    });
  }, [groupStudents, submissions, publishedAssignments, lessons, attendanceByLesson, group?.id, averagePct]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((row) => {
      if (assignmentFilter === "active") return row.status === "published";
      if (assignmentFilter === "review") {
        return row.status === "published" && reviewPendingCount(row) > 0;
      }
      if (assignmentFilter === "draft") return row.status === "draft";
      return true;
    });
  }, [assignments, assignmentFilter]);

  const gradebook = useMemo(() => {
    const cols = publishedAssignments.slice(0, 6);
    const rows = groupStudents.map((student) => {
      const cells = cols.map((assignment) => {
        const sub = submissions.find(
          (row) =>
            String(row.student) === String(student.id) &&
            String(row.assignment) === String(assignment.id),
        );
        return sub?.score != null ? sub.score : "—";
      });
      const graded = submissions.filter(
        (row) => String(row.student) === String(student.id) && row.status === "graded",
      );
      const avg = averagePct(graded) ?? "—";
      const last = graded.sort((a, b) => new Date(b.graded_at) - new Date(a.graded_at))[0];
      return {
        id: student.id,
        name: student.full_name || student.name,
        cells,
        avg,
        lastScore: last?.score ?? "—",
        attendancePct: computeStudentAttendancePct(student.id, lessons, attendanceByLesson, group?.id),
      };
    });
    return { cols, rows };
  }, [groupStudents, publishedAssignments, submissions, lessons, attendanceByLesson, group?.id, averagePct]);

  const resultsSummary = useMemo(() => {
    const scores = gradebook.rows.map((row) => Number(row.avg)).filter((value) => !Number.isNaN(value));
    const avgGroup = scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : null;
    const best = scores.length ? Math.max(...scores) : null;
    const gradedCount = submissions.filter((row) => row.status === "graded").length;
    return { avgGroup, best, gradedCount };
  }, [gradebook, submissions]);

  if (!group) return null;

  const attendancePrimary = needsAttendanceAction(group);
  const reviewPrimary = !attendancePrimary && pendingReviewsTotal > 0;

  async function saveMaterial(event) {
    event.preventDefault();
    setMaterialError("");
    try {
      await api.post("/materials", {
        ...materialForm,
        group: group.id,
        course: group.course || null,
      });
      invalidateApiCache("/materials");
      setMaterialFormOpen(false);
      setMaterialForm({
        title: "",
        description: "",
        material_type: "link",
        link: "",
        is_published: true,
      });
      onRefresh?.();
    } catch (err) {
      setMaterialError(err.message);
    }
  }

  function openLessonAttendance(lesson) {
    navigate(`${path("attendance")}?lesson=${lesson.id}`);
  }

  const viewingStudent = Boolean(selectedStudent);

  const content = (
    <div className={`tg-detail${inline ? " tg-detail-inline" : ""}`}>
      {!viewingStudent ? (
        <>
          <header className="tg-detail-head">
            <div className="tg-detail-title">
              <span className="tg-group-icon tg-group-icon-lg">
                <IconGroups size={18} />
              </span>
              <div>
                <h2>{group.name}</h2>
                <p className="tg-muted">{courseName}</p>
                <p className="tg-detail-meta">
                  {[
                    t("plural.students", { count: groupStudents.length }),
                    schedule.days !== "—" ? `${schedule.days} · ${schedule.time}` : "",
                    roomName && roomName !== "—" ? t("tGd.room", { room: roomName }) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="tg-detail-head-actions">
              {attendancePrimary ? (
                <>
                  <Button onClick={() => onOpenAttendance?.(group)}>{t("tGd.markAttendance")}</Button>
                  <Button variant="ghost" onClick={() => onCreateAssignment?.(group)}>
                    {t("tGd.createAssignment")}
                  </Button>
                </>
              ) : reviewPrimary ? (
                <>
                  <Button
                    onClick={() => {
                      switchTab("assignments");
                      setAssignmentFilter("review");
                    }}
                  >
                    {t("tGd.reviewWork")}
                  </Button>
                  <Button variant="ghost" onClick={() => onCreateAssignment?.(group)}>
                    {t("tGd.createAssignment")}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => onCreateAssignment?.(group)}>{t("tGd.createAssignment")}</Button>
                  <Button variant="ghost" onClick={() => onOpenAttendance?.(group)}>
                    {t("tGd.attendance")}
                  </Button>
                </>
              )}
              <GroupContextMenu
                ariaLabel={t("tGroups.menuLabel")}
                onAttendance={() => onOpenAttendance?.(group)}
                onCreateAssignment={() => onCreateAssignment?.(group)}
                onAddMaterial={() => {
                  switchTab("materials");
                  setMaterialFormOpen(true);
                }}
                onNotify={() => onNotify?.()}
                onOpenSchedule={() => onOpenSchedule?.(group.id)}
              />
              {!inline && onClose ? (
                <CloseButton onClick={onClose} />
              ) : null}
            </div>
          </header>

          <div className="tg-tabs" role="tablist" aria-label={t("tGd.tabsLabel")}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => switchTab(item.id)}
              >
                {item.label}
                {item.id === "assignments" && pendingReviewsTotal > 0 ? (
                  <span className="tg-tab-badge">{pendingReviewsTotal}</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="tg-detail-body">
        {viewingStudent ? (
          <StudentDrawer
            inline
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
            submissions={selectedStudent?.studentSubs || []}
            assignments={assignments}
            group={group}
            courseName={courseName}
            attendanceStats={buildStudentAttendanceStats(
              selectedStudent.id,
              lessons,
              attendanceByLesson,
              group.id,
            )}
          />
        ) : null}

        {!viewingStudent && tab === "students" ? (
          <div className="tg-tab-panel">
            {studentRows.length ? (
              <div className="tg-table-wrap">
                <table className="tg-table">
                  <thead>
                    <tr>
                      <th>{t("tGd.colStudent")}</th>
                      <th>{t("tGd.colAttendance")}</th>
                      <th>{t("tGd.colAssignments")}</th>
                      <th>{t("tGd.colAverage")}</th>
                      <th>{t("tGd.colStatus")}</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {studentRows.map((row) => {
                      const name = row.full_name || row.name || "—";
                      const attTone = getAttendanceTone(row.attendancePct);
                      return (
                        <tr
                          key={row.id}
                          className="tg-row-clickable"
                          tabIndex={0}
                          role="button"
                          onClick={() => setSelectedStudent(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedStudent(row);
                            }
                          }}
                        >
                          <td>
                            <span className="tg-student-cell">
                              <span
                                className="tg-student-avatar-sm"
                                style={{ background: avatarColor(name) }}
                              >
                                {studentInitials(row)}
                              </span>
                              <span className="tg-student-name">{name}</span>
                            </span>
                          </td>
                          <td>
                            <span className={`tg-att-${attTone}`}>
                              {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
                            </span>
                          </td>
                          <td>{row.assignmentsDone}</td>
                          <td>{row.avgScore}</td>
                          <td>
                            <span className={`tg-pill tg-pill-${row.status.tone}`}>{row.status.label}</span>
                          </td>
                          <td className="tg-row-chevron" aria-hidden="true">
                            ›
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={t("tGd.noStudents")} />
            )}
          </div>
        ) : null}

        {!viewingStudent && tab === "attendance" ? (
          <div className="tg-tab-panel tga">
            <div className="tga-kpis">
              <div className="tga-kpi is-blue">
                <span>{t("tGd.avgAttendance")}</span>
                <strong>{attendancePct != null ? `${attendancePct}%` : "—"}</strong>
                <i className="tga-meter">
                  <b style={{ width: `${attendancePct ?? 0}%` }} />
                </i>
              </div>
              <div className="tga-kpi is-teal">
                <span>{t("tGd.present")}</span>
                <strong>{attendanceSummary.present}</strong>
              </div>
              <div className="tga-kpi is-amber">
                <span>{t("tGd.late")}</span>
                <strong>{attendanceSummary.late}</strong>
              </div>
              <div className="tga-kpi is-red">
                <span>{t("tGd.absences")}</span>
                <strong>{attendanceSummary.absent}</strong>
              </div>
            </div>

            <div className="tga-head">
              <div>
                <h3>{t("tGd.recentLessons")}</h3>
                <p className="tg-muted">
                  {pastLessons.length
                    ? t("tGd.sessions", { count: pastLessons.length })
                    : t("tGd.noSessions")}
                </p>
              </div>
              <button type="button" className="sx-btn sx-btn-primary" onClick={() => onOpenAttendance?.(group)}>
                {t("tGd.markAttendance")}
              </button>
            </div>

            {pastLessons.length ? (
              <ul className="tga-list">
                {pastLessons.map((lesson) => {
                  const marks = attendanceByLesson[lesson.id] || [];
                  const summary = buildLessonAttendanceSummary(lesson, marks, groupStudents.length);
                  const cancelled = lesson.status === "cancelled";
                  const unmarked = !cancelled && summary.status === "unmarked" && !marks.length;
                  const partial = !cancelled && summary.status === "unmarked" && marks.length > 0;
                  const total = Math.max(summary.expected, marks.length, 1);
                  const date = new Date(lesson.starts_at);
                  const part = (value) => `${(value / total) * 100}%`;
                  return (
                    <li key={lesson.id} className={`tga-row${unmarked ? " is-unmarked" : ""}${cancelled ? " is-cancelled" : ""}`}>
                      <span className="tga-date">
                        <b>{date.getDate()}</b>
                        {formatDateTime(date, { month: "short" }).replace(".", "")}
                      </span>
                      <div className="tga-info">
                        <strong>
                          {formatDateTime(date, { weekday: "long" })} · {formatTime(lesson.starts_at)}–
                          {formatTime(lesson.ends_at)}
                        </strong>
                        {cancelled ? (
                          <span className="tga-badge is-muted">{t("tGd.cancelled")}</span>
                        ) : unmarked ? (
                          <span className="tga-badge is-warn">{t("tGd.unmarked")}</span>
                        ) : (
                          <span className="tga-legend">
                            {partial ? (
                              <span className="tga-badge is-warn">
                                {t("tGd.markedOf", { done: marks.length, total: summary.expected })}
                              </span>
                            ) : null}
                            <em className="is-teal">{t("tGd.came", { count: summary.present + summary.excused })}</em>
                            <em className="is-amber">{t("tGd.wasLate", { count: summary.late })}</em>
                            <em className="is-red">{t("tGd.missed", { count: summary.absent })}</em>
                          </span>
                        )}
                      </div>
                      {!cancelled && !unmarked ? (
                        <span className="tga-bar" aria-hidden="true">
                          <i className="is-teal" style={{ width: part(summary.present + summary.excused) }} />
                          <i className="is-amber" style={{ width: part(summary.late) }} />
                          <i className="is-red" style={{ width: part(summary.absent) }} />
                        </span>
                      ) : (
                        <span className="tga-bar is-empty" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className={`sx-btn ${unmarked || partial ? "sx-btn-primary" : "sx-btn-outline"} tga-open`}
                        onClick={() => openLessonAttendance(lesson)}
                      >
                        {t(unmarked ? "tGd.mark" : partial ? "tGd.complete" : "common.open")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title={t("tGd.noLessons")} />
            )}
          </div>
        ) : null}

        {!viewingStudent && tab === "assignments" ? (
          <div className="tg-tab-panel">
            <div className="tg-tab-toolbar">
              <div className="tg-subtabs">
                {ASSIGNMENT_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={assignmentFilter === item.id ? "is-active" : ""}
                    onClick={() => setAssignmentFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button onClick={() => onCreateAssignment?.(group)}>{t("tGd.createAssignmentPlus")}</Button>
            </div>
            {filteredAssignments.length ? (
              <ul className="tg-assignment-list">
                {filteredAssignments.map((row) => {
                  const pending = reviewPendingCount(row);
                  return (
                    <li key={row.id}>
                      <div>
                        <strong>{row.title}</strong>
                        <p className="tg-muted">
                          {t("tGd.due", { date: row.due_at ? formatDate(row.due_at) : "—" })}
                        </p>
                        <dl className="tg-assignment-stats">
                          <div>
                            <dt>{t("tGd.handed")}</dt>
                            <dd>
                              {row.submitted_count ?? 0} / {groupStudents.length}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("tGd.toReview")}</dt>
                            <dd>
                              {pending > 0 ? (
                                <button
                                  type="button"
                                  className="tg-link-btn"
                                  onClick={() => onOpenAssignments?.(row.id)}
                                >
                                  {pending}
                                </button>
                              ) : (
                                0
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("tGd.missing")}</dt>
                            <dd>{row.missing_count ?? 0}</dd>
                          </div>
                        </dl>
                      </div>
                      <Button variant="ghost" onClick={() => onOpenAssignments?.(row.id)}>
                        {t("common.open")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title={t("tGd.noAssignments")}
                action={
                  <Button onClick={() => onCreateAssignment?.(group)}>{t("tGd.createFirst")}</Button>
                }
              />
            )}
          </div>
        ) : null}

        {!viewingStudent && tab === "results" ? (
          <div className="tg-tab-panel">
            <div className="tg-mini-summary">
              <div>
                <span className="tg-muted">{t("tGd.groupAverage")}</span>
                <strong>{resultsSummary.avgGroup != null ? `${resultsSummary.avgGroup}%` : "—"}</strong>
              </div>
              <div>
                <span className="tg-muted">{t("tGd.best")}</span>
                <strong>{resultsSummary.best != null ? `${resultsSummary.best}%` : "—"}</strong>
              </div>
              <div>
                <span className="tg-muted">{t("tGd.gradedCount")}</span>
                <strong>{resultsSummary.gradedCount}</strong>
              </div>
            </div>
            {gradebook.rows.length && gradebook.cols.length ? (
              <div className="tg-gradebook-wrap">
                <table className="tg-gradebook">
                  <thead>
                    <tr>
                      <th>{t("tGd.colStudent")}</th>
                      {gradebook.cols.map((col) => (
                        <th key={col.id}>{col.title}</th>
                      ))}
                      <th>{t("tGd.colMean")}</th>
                      <th>{t("tGd.colLast")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        {row.cells.map((cell, index) => (
                          <td key={`${row.id}-${index}`}>{cell}</td>
                        ))}
                        <td>{row.avg === "—" ? "—" : `${row.avg}%`}</td>
                        <td>{row.lastScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={t("tGd.resultsEmpty")} />
            )}
          </div>
        ) : null}

        {!viewingStudent && tab === "materials" ? (
          <div className="tg-tab-panel">
            <div className="tg-tab-toolbar">
              <Button onClick={() => setMaterialFormOpen((prev) => !prev)}>{t("tGd.addMaterial")}</Button>
            </div>
            {materialFormOpen ? (
              <form className="tg-material-form" onSubmit={saveMaterial}>
                {materialError ? <Banner>{materialError}</Banner> : null}
                <Field label={t("tGd.materialTitle")}>
                  <input
                    required
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                  />
                </Field>
                <Field label={t("tGd.materialDescription")}>
                  <textarea
                    rows={2}
                    value={materialForm.description}
                    onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                  />
                </Field>
                <Field label={t("tGd.materialType")}>
                  <select
                    value={materialForm.material_type}
                    onChange={(e) => setMaterialForm({ ...materialForm, material_type: e.target.value })}
                  >
                    <option value="link">{t("tGd.link")}</option>
                    <option value="video">{t("tGd.video")}</option>
                    <option value="file">{t("tGd.file")}</option>
                  </select>
                </Field>
                <Field label={t("tGd.link")}>
                  <input
                    value={materialForm.link}
                    onChange={(e) => setMaterialForm({ ...materialForm, link: e.target.value })}
                    placeholder="https://..."
                  />
                </Field>
                <div className="tg-inline-actions">
                  <Button type="button" variant="ghost" onClick={() => setMaterialFormOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit">{t("common.publish")}</Button>
                </div>
              </form>
            ) : null}
            {materials.length ? (
              <ul className="tg-material-list">
                {materials.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{row.title}</strong>
                      <p className="tg-muted">
                        {MATERIAL_TYPES[row.material_type] || row.material_type} ·{" "}
                        {row.published_at || row.created_at
                          ? formatDate(row.published_at || row.created_at)
                          : "—"}
                      </p>
                    </div>
                    {row.link ? (
                      <a href={row.link} target="_blank" rel="noreferrer">
                        {t("common.open")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("tGd.noMaterials")} />
            )}
          </div>
        ) : null}

        {!viewingStudent && tab === "schedule" ? (
          <div className="tg-tab-panel">
            {rules.filter((row) => row.is_active !== false).length ? (
              <ul className="tg-schedule-list">
                {rules
                  .filter((row) => row.is_active !== false)
                  .sort((a, b) => a.weekday - b.weekday)
                  .map((row) => (
                    <li key={row.id}>
                      <strong>{WEEKDAY_FULL[row.weekday]}</strong>
                      <p>
                        {formatRuleTime(row.starts_at)}–{formatRuleTime(row.ends_at)}
                      </p>
                      <p className="tg-muted">{t("tGd.roomFull", { room: roomMap.get(String(row.room)) || "—" })}</p>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState title={t("tGd.noSchedule")} />
            )}
            {upcomingLessons.length ? (
              <>
                <h3 className="tg-section-title">{t("tGd.upcoming")}</h3>
                <ul className="tg-lesson-list">
                  {upcomingLessons.map((lesson) => (
                    <li key={lesson.id}>
                      <div>
                        <strong>{formatDate(lesson.starts_at)}</strong>
                        <p className="tg-muted">
                          {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenSchedule?.(group.id)}>
              {t("tGd.fullSchedule")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer teacher-drawer teacher-drawer-wide" onClick={(e) => e.stopPropagation()}>
        {content}
      </aside>
    </div>
  );
}


