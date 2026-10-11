import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, EmptyState, SearchInput } from "@/components/ui";
import { t, translated } from "@/i18n";
import { getSession } from "@/services/api/client";
import { attendanceForLessons } from "@/services/api/paginate";
import {
  avatarColor,
  computeStudentAttendancePct,
  getAttendanceTone,
  studentInitials,
} from "./groupHelpers";
import {
  averageScore,
  computeTrend,
  formatScoreLabel,
  hardAssignments,
  hasRealReason,
  inPeriod,
  periodRange,
  reasonChipTone,
  scoreTone,
  studentResultReasons,
} from "./resultHelpers";
import StudentResultDrawer from "./StudentResultDrawer";
import { asList } from "./utils";
import { loadHomeworkOverview } from "./homeworkApi";
import { IconUsers, SUMMARY_ICON_MAP } from "./tgIcons";

const PERIODS = [
  { id: "7d", label: "t:tResults.period7" },
  { id: "30d", label: "t:tResults.period30" },
  { id: "month", label: "t:tResults.periodMonth" },
  { id: "all", label: "t:tResults.periodAll" },
].map(translated);

const QUICK = [
  { id: "all", label: "t:tResults.quickAll" },
  { id: "low", label: "t:tResults.quickLow" },
  { id: "missing", label: "t:tResults.quickMissing" },
  { id: "attendance", label: "t:tResults.quickAttendance" },
  { id: "improved", label: "t:tResults.quickImproved" },
].map(translated);

const SORTS = [
  { id: "name", label: "t:tResults.sortName" },
  { id: "avg", label: "t:tResults.sortAvg" },
  { id: "latest", label: "t:tResults.sortLatest" },
  { id: "attendance", label: "t:tResults.sortAttendance" },
  { id: "trend", label: "t:tResults.sortTrend" },
].map(translated);

function Skeleton() {
  return (
    <div className="tr-skeleton">
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <div key={key} className="tr-skeleton-row" />
      ))}
    </div>
  );
}

export default function TeacherResultsPage() {
  const session = getSession();
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendanceByLesson, setAttendanceByLesson] = useState({});

  const [groupFilter, setGroupFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [period, setPeriod] = useState("30d");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState("all");
  const [sortBy, setSortBy] = useState("avg");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const homework = loadHomeworkOverview();
      const [s, g, c, e, sub, a, l] = await Promise.all([
        asList("/students?page_size=500"),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
        asList("/enrollments?page_size=500"),
        homework.then((data) => data.submissions),
        homework.then((data) => data.assignments),
        asList("/lessons?page_size=300"),
      ]);
      setStudents(s);
      setGroups(g);
      setCourses(c);
      setEnrollments(e);
      setSubmissions(sub);
      setAssignments(a);
      setLessons(l.sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at)));

      const groupIds = new Set(g.map((row) => String(row.id)));
      const past = l
        .filter((row) => groupIds.has(String(row.group)) && new Date(row.starts_at) < new Date())
        .slice(-80);
      const marks = await attendanceForLessons(past.map((lesson) => lesson.id), { cache: true }).catch(() => ({}));
      setAttendanceByLesson(marks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, session.tenantId]);

  const courseMap = useMemo(() => new Map(courses.map((row) => [String(row.id), row.name])), [courses]);
  const groupMap = useMemo(() => new Map(groups.map((row) => [String(row.id), row])), [groups]);
  const assignmentMap = useMemo(
    () => new Map(assignments.map((row) => [String(row.id), row])),
    [assignments],
  );
  const range = useMemo(() => periodRange(period), [period]);

  const allRows = useMemo(() => {
    const active = enrollments.filter((row) => row.status === "active");
    return active
      .map((enrollment) => {
        const group = groupMap.get(String(enrollment.group));
        const student = students.find((row) => String(row.id) === String(enrollment.student));
        if (!group || !student) return null;

        const published = assignments.filter(
          (row) =>
            String(row.group) === String(group.id) &&
            (row.status === "published" || row.status === "closed"),
        );
        const studentSubs = submissions.filter((row) => String(row.student) === String(student.id));
        const relevant = studentSubs.filter((row) =>
          published.some((item) => String(item.id) === String(row.assignment)),
        );
        const gradedAll = relevant
          .filter((row) => row.status === "graded" && row.score != null)
          .map((row) => {
            const assignment = assignmentMap.get(String(row.assignment));
            return {
              ...row,
              maxScore: assignment?.max_score,
              title: assignment?.title,
            };
          })
          .sort(
            (a, b) =>
              new Date(a.graded_at || a.submitted_at || 0) - new Date(b.graded_at || b.submitted_at || 0),
          );
        const gradedPeriod = gradedAll.filter((row) =>
          inPeriod(row.graded_at || row.submitted_at, range),
        );
        const graded = gradedPeriod.length ? gradedPeriod : gradedAll;
        const avg = averageScore(graded);
        const missing = relevant.filter((row) => row.status === "not_submitted").length;
        const done = relevant.filter((row) => row.status !== "not_submitted").length;
        const latest = graded.length ? graded[graded.length - 1] : null;
        const attendancePct = computeStudentAttendancePct(
          student.id,
          lessons,
          attendanceByLesson,
          group.id,
        );
        const trend = computeTrend(gradedAll);
        const reasons = studentResultReasons({
          avg,
          missingCount: missing,
          attendancePct,
          trend,
          gradedCount: graded.length,
        });

        return {
          ...student,
          group,
          groupName: group.name,
          courseName: courseMap.get(String(group.course)) || "—",
          courseId: group.course,
          published,
          studentSubs: relevant,
          graded,
          gradedAll,
          avg,
          missing,
          done,
          totalAssignments: published.length,
          latest,
          attendancePct,
          trend,
          reasons,
        };
      })
      .filter(Boolean);
  }, [
    enrollments,
    groupMap,
    students,
    assignments,
    submissions,
    assignmentMap,
    range,
    lessons,
    attendanceByLesson,
    courseMap,
  ]);

  const filteredRows = useMemo(() => {
    let rows = allRows.filter((row) => {
      if (groupFilter && String(row.group.id) !== groupFilter) return false;
      if (courseFilter && String(row.courseId) !== courseFilter) return false;
      const name = (row.full_name || "").toLowerCase();
      if (query && !name.includes(query.toLowerCase())) return false;
      if (quick === "low" && !(row.avg != null && row.avg < 60)) return false;
      if (quick === "missing" && row.missing <= 0) return false;
      if (quick === "attendance" && !(row.attendancePct != null && row.attendancePct < 75)) return false;
      if (quick === "improved" && !(row.trend && row.trend.delta > 0)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "avg") return (b.avg ?? -1) - (a.avg ?? -1);
      if (sortBy === "latest") return (b.latest?.score ?? -1) - (a.latest?.score ?? -1);
      if (sortBy === "attendance") return (b.attendancePct ?? -1) - (a.attendancePct ?? -1);
      if (sortBy === "trend") return (b.trend?.delta ?? 0) - (a.trend?.delta ?? 0);
      return (a.full_name || "").localeCompare(b.full_name || "", "ru");
    });
    return rows;
  }, [allRows, groupFilter, courseFilter, query, quick, sortBy]);

  const summary = useMemo(() => {
    const withAvg = allRows.filter((row) => row.avg != null);
    const avg =
      withAvg.length > 0
        ? Math.round(withAvg.reduce((sum, row) => sum + row.avg, 0) / withAvg.length)
        : null;
    const gradedWorks = allRows.reduce((sum, row) => sum + row.graded.length, 0);
    const attention = allRows.filter((row) => hasRealReason(row.reasons)).length;
    const improved = allRows.filter((row) => row.trend && row.trend.delta > 0).length;
    return [
      { key: "attendance", label: t("tResults.statAverage"), value: avg != null ? `${avg}%` : "—" },
      { key: "reviews", label: t("tResults.statGraded"), value: gradedWorks },
      { key: "attention", label: t("tResults.statAttention"), value: attention },
      { key: "students", label: t("tResults.statImproved"), value: improved },
    ];
  }, [allRows]);

  const attentionRows = useMemo(
    () =>
      allRows
        .filter((row) => hasRealReason(row.reasons))
        .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
        .slice(0, 5),
    [allRows],
  );

  const improvedRows = useMemo(
    () =>
      allRows
        .filter((row) => row.trend && row.trend.delta >= 5)
        .sort((a, b) => b.trend.delta - a.trend.delta)
        .slice(0, 5),
    [allRows],
  );

  const hardRows = useMemo(() => {
    const scoped = groupFilter
      ? assignments.filter((row) => String(row.group) === groupFilter)
      : assignments;
    return hardAssignments(scoped, submissions, range).map((item) => ({
      ...item,
      groupName: groupMap.get(String(item.group))?.name || "—",
    }));
  }, [assignments, submissions, range, groupFilter, groupMap]);

  const groupSummary = useMemo(() => {
    if (!groupFilter) return null;
    const group = groupMap.get(groupFilter);
    if (!group) return null;
    const rows = allRows.filter((row) => String(row.group.id) === groupFilter);
    const withAvg = rows.filter((row) => row.avg != null);
    const avg =
      withAvg.length > 0
        ? Math.round(withAvg.reduce((sum, row) => sum + row.avg, 0) / withAvg.length)
        : null;
    const att = rows.map((row) => row.attendancePct).filter((v) => v != null);
    const attAvg = att.length
      ? Math.round(att.reduce((sum, v) => sum + v, 0) / att.length)
      : null;
    const gradedWorks = rows.reduce((sum, row) => sum + row.graded.length, 0);
    const attention = rows.filter((row) => hasRealReason(row.reasons)).length;
    return {
      name: group.name,
      students: rows.length,
      avg,
      attAvg,
      gradedWorks,
      attention,
    };
  }, [groupFilter, groupMap, allRows]);

  const gradebook = useMemo(() => {
    if (!groupFilter) return { cols: [], rows: [] };
    const cols = assignments
      .filter(
        (row) =>
          String(row.group) === groupFilter &&
          (row.status === "published" || row.status === "closed"),
      )
      .slice(0, 8);
    const rows = filteredRows.map((student) => {
      const cells = cols.map((assignment) => {
        const sub = student.studentSubs.find(
          (row) => String(row.assignment) === String(assignment.id),
        );
        return {
          assignment,
          submission: sub,
          score: sub?.score != null ? sub.score : null,
        };
      });
      return { student, cells, avg: student.avg };
    });
    return { cols, rows };
  }, [groupFilter, assignments, filteredRows]);

  const hasActiveFilters = Boolean(
    query || groupFilter || courseFilter || period !== "30d" || quick !== "all" || sortBy !== "avg",
  );

  function resetFilters() {
    setQuery("");
    setGroupFilter("");
    setCourseFilter("");
    setPeriod("30d");
    setQuick("all");
    setSortBy("avg");
    setFiltersOpen(false);
  }

  function openStudent(row) {
    setSelected(row);
  }

  return (
    <div className="tr-page">
      <header className="tg-header">
        <div>
          <h1>{t("tResults.title")}</h1>
          <p className="tg-sub">{t("tResults.sub")}</p>
        </div>
      </header>

      {error ? (
        <Banner>
          {t("tResults.loadError")}{" "}
          <Button variant="ghost" onClick={load}>
            {t("common.retry")}
          </Button>
        </Banner>
      ) : null}

      <div className="tg-summary tg-summary-4">
        {summary.map((item) => {
          const Icon = SUMMARY_ICON_MAP[item.key] || IconUsers;
          return (
            <div key={item.key} className={`tg-summary-item tg-summary-${item.key}`}>
              <span className="tg-summary-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{loading ? "…" : item.value}</strong>
                <span className="tg-summary-label">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {groupSummary ? (
        <section className="tr-group-summary" aria-label={t("tResults.summaryOf", { name: groupSummary.name })}>
          <div className="tr-group-summary-head">
            <strong>{groupSummary.name}</strong>
            <span className="tg-muted">{t("plural.students", { count: groupSummary.students })}</span>
          </div>
          <div className="tr-group-summary-stats">
            <div className="tr-group-stat">
              <span className="tg-muted">{t("tResults.statAverage")}</span>
              <strong>{groupSummary.avg != null ? `${groupSummary.avg}%` : "—"}</strong>
            </div>
            <div className="tr-group-stat">
              <span className="tg-muted">{t("tResults.colAttendance")}</span>
              <strong>{groupSummary.attAvg != null ? `${groupSummary.attAvg}%` : "—"}</strong>
            </div>
            <div className="tr-group-stat">
              <span className="tg-muted">{t("tResults.graded")}</span>
              <strong>{groupSummary.gradedWorks}</strong>
            </div>
            <div className="tr-group-stat">
              <span className="tg-muted">{t("tResults.statAttention")}</span>
              <strong className={groupSummary.attention ? "tr-stat-warn" : ""}>
                {groupSummary.attention}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      <div className="tr-split">
        <section className="tr-main">
          <div className="tr-toolbar">
            <div className="tr-toolbar-row">
              <SearchInput value={query} onChange={setQuery} placeholder={t("tStudents.searchPlaceholder")} />
              <div className="tr-toolbar-actions">
                <div className="tr-view-toggle" role="tablist" aria-label={t("tResults.view")}>
                  <button
                    type="button"
                    className={view === "list" ? "is-active" : ""}
                    onClick={() => setView("list")}
                  >
                    {t("tResults.viewList")}
                  </button>
                  <button
                    type="button"
                    className={view === "gradebook" ? "is-active" : ""}
                    onClick={() => setView("gradebook")}
                    disabled={!groupFilter}
                    title={!groupFilter ? t("tResults.pickGroupFirst") : undefined}
                  >
                    {t("tResults.viewGradebook")}
                  </button>
                </div>
                <button
                  type="button"
                  className="tr-filters-toggle"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                >
                  {t("common.filters")}
                </button>
              </div>
            </div>
            <div className={`tr-toolbar-filters${filtersOpen ? " is-open" : ""}`}>
              <label className="tr-filter-field">
                <span className="tr-filter-label">{t("tResults.group")}</span>
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                  <option value="">{t("common.allGroups")}</option>
                  {groups.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tr-filter-field">
                <span className="tr-filter-label">{t("tResults.course")}</span>
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                  <option value="">{t("common.allCourses")}</option>
                  {courses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tr-filter-field">
                <span className="tr-filter-label">{t("tResults.period")}</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {PERIODS.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tr-filter-field">
                <span className="tr-filter-label">{t("tResults.sort")}</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORTS.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              {hasActiveFilters ? (
                <button type="button" className="tr-reset-btn" onClick={resetFilters}>
                  {t("common.reset")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="tr-quick-filters" role="tablist" aria-label={t("tStudents.quickFilters")}>
            {QUICK.map((item) => (
              <button
                key={item.id}
                type="button"
                className={quick === item.id ? "is-active" : ""}
                onClick={() => setQuick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? <Skeleton /> : null}

          {!loading && !allRows.length ? (
            <EmptyState
              title={t("tResults.emptyTitle")}
              body={t("tResults.emptyBody")}
            />
          ) : null}

          {!loading && allRows.length && !filteredRows.length ? (
            <EmptyState title={t("tResults.notFound")} />
          ) : null}

          {!loading && filteredRows.length && view === "list" ? (
            <>
              <div className={`tg-table-wrap tr-table-desktop${groupFilter ? " tr-table-group-selected" : ""}`}>
                <table className="tg-table tr-table">
                  <thead>
                    <tr>
                      <th>{t("tResults.colStudent")}</th>
                      <th className="tr-col-group">{t("tResults.colGroup")}</th>
                      <th className="tr-col-assign">{t("tResults.colAssignments")}</th>
                      <th>{t("tResults.colAverage")}</th>
                      <th className="tr-col-latest">{t("tResults.colLatest")}</th>
                      <th>{t("tResults.colAttendance")}</th>
                      <th className="tr-col-trend">{t("tResults.colTrend")}</th>
                      <th>{t("tResults.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={`${row.id}-${row.group.id}`}
                        className="tg-row-clickable"
                        tabIndex={0}
                        role="button"
                        onClick={() => openStudent(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openStudent(row);
                          }
                        }}
                      >
                        <td>
                          <span className="tg-student-cell">
                            <span
                              className="tg-student-avatar-sm"
                              style={{ background: avatarColor(row.full_name) }}
                            >
                              {studentInitials(row)}
                            </span>
                            <span className="tg-student-name">{row.full_name}</span>
                          </span>
                        </td>
                        <td className="tr-col-group">{row.groupName}</td>
                        <td className="tr-col-assign">
                          {row.totalAssignments
                            ? `${row.done} / ${row.totalAssignments}`
                            : "—"}
                        </td>
                        <td>
                          <span className={`tr-score-${scoreTone(row.avg)}`}>
                            {row.avg != null ? `${row.avg}%` : "—"}
                          </span>
                        </td>
                        <td className="tr-col-latest">
                          {row.latest
                            ? formatScoreLabel(row.latest.score, row.latest.maxScore)
                            : "—"}
                        </td>
                        <td>
                          <span className={`tg-att-${getAttendanceTone(row.attendancePct)}`}>
                            {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
                          </span>
                        </td>
                        <td className="tr-col-trend">
                          {row.trend ? (
                            <span className={`tr-trend-${row.trend.tone}`}>{row.trend.label}</span>
                          ) : (
                            <span className="tg-muted">—</span>
                          )}
                        </td>
                        <td>
                          {row.reasons[0] ? (
                            <span className={`tg-reason-chip tg-reason-${reasonChipTone(row.reasons[0])}`}>
                              {row.reasons[0].text}
                            </span>
                          ) : (
                            <span className="tg-pill tg-pill-green">{t("tResults.stable")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tr-cards-mobile">
                {filteredRows.map((row) => (
                  <button
                    key={`${row.id}-${row.group.id}-m`}
                    type="button"
                    className="tr-student-card"
                    onClick={() => openStudent(row)}
                  >
                    <div className="tr-student-card-head">
                      <span
                        className="tg-student-avatar-sm"
                        style={{ background: avatarColor(row.full_name) }}
                      >
                        {studentInitials(row)}
                      </span>
                      <div>
                        <strong>{row.full_name}</strong>
                        <p className="tg-muted">{row.groupName}</p>
                      </div>
                    </div>
                    <dl className="tr-student-card-grid">
                      <div>
                        <dt>{t("tResults.colAverage")}</dt>
                        <dd className={`tr-score-${scoreTone(row.avg)}`}>
                          {row.avg != null ? `${row.avg}%` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("tResults.colAttendance")}</dt>
                        <dd>{row.attendancePct != null ? `${row.attendancePct}%` : "—"}</dd>
                      </div>
                      <div>
                        <dt>{t("tResults.assignments")}</dt>
                        <dd>
                          {row.totalAssignments ? `${row.done}/${row.totalAssignments}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("tResults.colTrend")}</dt>
                        <dd>{row.trend?.label || "—"}</dd>
                      </div>
                    </dl>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {!loading && view === "gradebook" ? (
            groupFilter ? (
              gradebook.rows.length ? (
                <div className="tr-gradebook-wrap">
                  <table className="tg-table tr-gradebook">
                    <thead>
                      <tr>
                        <th>{t("tResults.colStudent")}</th>
                        {gradebook.cols.map((col) => (
                          <th key={col.id} title={col.title}>
                            {col.title.length > 12 ? `${col.title.slice(0, 12)}…` : col.title}
                          </th>
                        ))}
                        <th>{t("tResults.colMean")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradebook.rows.map(({ student, cells, avg }) => (
                        <tr key={student.id}>
                          <td>
                            <button type="button" className="tr-name-btn" onClick={() => openStudent(student)}>
                              {student.full_name}
                            </button>
                          </td>
                          {cells.map((cell) => (
                            <td key={cell.assignment.id}>
                              {cell.score != null ? cell.score : "—"}
                            </td>
                          ))}
                          <td>
                            <strong className={`tr-score-${scoreTone(avg)}`}>
                              {avg != null ? `${avg}%` : "—"}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={t("tResults.gradebookEmpty")} />
              )
            ) : (
              <EmptyState title={t("tResults.pickGroup")} body={t("tResults.pickGroupBody")} />
            )
          ) : null}
        </section>

        <aside className="tr-aside">
          <section className="tr-aside-card">
            <h2>{t("tResults.attentionTitle")}</h2>
            {!attentionRows.length ? (
              <p className="tg-muted">{t("tResults.noProblems")}</p>
            ) : (
              <ul className="tr-aside-list">
                {attentionRows.map((row) => (
                  <li key={`att-${row.id}-${row.group.id}`}>
                    <div>
                      <strong>{row.full_name}</strong>
                      <p className="tg-muted">
                        {row.reasons
                          .slice(0, 2)
                          .map((reason) => reason.text)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => openStudent(row)}>
                      {t("common.open")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {improvedRows.length ? (
            <section className="tr-aside-card">
              <h2>{t("tResults.progress")}</h2>
              <ul className="tr-aside-list">
                {improvedRows.map((row) => (
                  <li key={`imp-${row.id}`}>
                    <div>
                      <strong>{row.full_name}</strong>
                      <p className="tg-muted tr-trend-good">{row.trend.label}</p>
                    </div>
                    <Button variant="ghost" onClick={() => openStudent(row)}>
                      {t("common.open")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hardRows.length ? (
            <section className="tr-aside-card">
              <h2>{t("tResults.hardTitle")}</h2>
              <ul className="tr-aside-list">
                {hardRows.map((row) => (
                  <li key={`hard-${row.id}`}>
                    <div>
                      <strong>{row.title}</strong>
                      <p className="tg-muted">
                        {t("tResults.hardMeta", { group: row.groupName, avg: row.avg })}
                        {row.below60 ? t("tResults.hardBelow", { count: row.below60 }) : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <StudentResultDrawer
        student={selected}
        onClose={() => setSelected(null)}
        assignments={assignments.filter((row) => String(row.group) === String(selected?.group?.id))}
        submissions={selected?.studentSubs || []}
        lessons={lessons}
        attendanceByLesson={attendanceByLesson}
      />
    </div>
  );
}
