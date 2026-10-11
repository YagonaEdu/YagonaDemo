import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, EmptyState, SearchInput } from "@/components/ui";
import { t, translated } from "@/i18n";
import { getSession, invalidateApiCache } from "@/services/api/client";
import { attendanceForLessons } from "@/services/api/paginate";
import { money } from "@/utils/format";
import StudentDrawer from "./StudentDrawer";
import {
  avatarColor,
  buildStudentAttendanceStats,
  computeLastActivity,
  computeStudentAttendancePct,
  formatLastActivityLabel,
  getAttendanceTone,
  getStudentStatus,
  studentInitials,
  studentNeedsAttention,
} from "./groupHelpers";
import { asList, attachGuardiansToStudents, computeStudentDebt, optionalList } from "./utils";
import { loadHomeworkOverview } from "./homeworkApi";
import { IconUsers, SUMMARY_ICON_MAP } from "./tgIcons";

const QUICK_FILTERS = [
  { id: "all", label: "t:tStudents.quickAll" },
  { id: "low_attendance", label: "t:tStudents.quickLowAttendance" },
  { id: "missing", label: "t:tStudents.quickMissing" },
  { id: "review", label: "t:tStudents.quickReview" },
  { id: "debt", label: "t:tStudents.quickDebt" },
  { id: "active", label: "t:tStudents.quickActive" },
].map(translated);

const SORT_OPTIONS = [
  { value: "name", label: "t:tStudents.sortName" },
  { value: "attendance", label: "t:tStudents.sortAttendance" },
  { value: "result", label: "t:tStudents.sortResult" },
  { value: "activity", label: "t:tStudents.sortActivity" },
  { value: "missing", label: "t:tStudents.sortMissing" },
  { value: "debt", label: "t:tStudents.sortDebt" },
].map(translated);

function TableSkeleton() {
  return (
    <div className="ts-panel ts-skeleton">
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <div key={key} className="ts-skeleton-row" />
      ))}
    </div>
  );
}

function StudentRowButton({ row, onOpen }) {
  return (
    <tr
      className="tg-row-clickable"
      tabIndex={0}
      role="button"
      onClick={() => onOpen(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(row);
        }
      }}
    >
      <td>
        <span className="tg-student-cell">
          <span className="tg-student-avatar-sm" style={{ background: avatarColor(row.full_name || row.name) }}>
            {studentInitials(row)}
          </span>
          <span className="ts-student-name-block">
            <span className="tg-student-name">{row.full_name || row.name}</span>
            <span className="ts-student-sub">{row.groupName}</span>
          </span>
        </span>
      </td>
      <td className="ts-col-group">{row.groupName}</td>
      <td>
        <span className={`tg-att-${getAttendanceTone(row.attendancePct)}`}>
          {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
        </span>
        {row.attendancePct != null ? (
          <span className="ts-att-bar" aria-hidden="true">
            <span className="ts-att-fill" style={{ width: `${row.attendancePct}%` }} />
          </span>
        ) : null}
      </td>
      <td>
        <span>{row.assignmentsDone}</span>
        {row.missingCount > 0 ? (
          <span className="ts-cell-sub ts-warn">{t("tStudents.notSubmitted", { count: row.missingCount })}</span>
        ) : row.pendingReview > 0 ? (
          <span className="ts-cell-sub ts-info">{t("tStudents.toReview", { count: row.pendingReview })}</span>
        ) : row.totalAssignments > 0 ? (
          <span className="ts-cell-sub">{t("tStudents.submitted")}</span>
        ) : null}
      </td>
      <td>{row.avgScore}</td>
      <td>
        {row.debt > 0 ? (
          <span className="ts-debt-badge">{money(row.debt, row.currency)}</span>
        ) : (
          <span className="tg-muted">{t("tStudents.none")}</span>
        )}
      </td>
      <td>
        {row.activityLabel ? (
          <>
            <span>{row.activityLabel.prefix}</span>
            <span className="ts-cell-sub">{row.activityLabel.dateLabel}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td>
        <span className={`tg-pill tg-pill-${row.status.tone}`}>{row.status.label}</span>
      </td>
      <td className="tg-row-chevron" aria-hidden="true">
        ›
      </td>
    </tr>
  );
}

function StudentCard({ row, onOpen }) {
  return (
    <button type="button" className="ts-student-card" onClick={() => onOpen(row)}>
      <div className="ts-student-card-head">
        <span className="tg-student-avatar-sm" style={{ background: avatarColor(row.full_name || row.name) }}>
          {studentInitials(row)}
        </span>
        <div>
          <strong>{row.full_name || row.name}</strong>
          <p className="tg-muted">{row.groupName}</p>
        </div>
        <span className="tg-row-chevron" aria-hidden="true">
          ›
        </span>
      </div>
      <dl className="ts-student-card-grid">
        <div>
          <dt>{t("tStudents.attendance")}</dt>
          <dd className={`tg-att-${getAttendanceTone(row.attendancePct)}`}>
            {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
          </dd>
        </div>
        <div>
          <dt>{t("tStudents.assignments")}</dt>
          <dd>{row.assignmentsDone}</dd>
        </div>
        <div>
          <dt>{t("tStudents.result")}</dt>
          <dd>{row.avgScore}</dd>
        </div>
        <div>
          <dt>{t("tStudents.debt")}</dt>
          <dd className={row.debt > 0 ? "students-debt" : ""}>
            {row.debt > 0 ? money(row.debt, row.currency) : t("tStudents.none")}
          </dd>
        </div>
      </dl>
      <span className={`tg-pill tg-pill-${row.status.tone}`}>{row.status.label}</span>
    </button>
  );
}

function AttentionRow({ row, onOpen }) {
  const name = row.full_name || row.name || "—";
  return (
    <li className="ts-attention-item">
      <button type="button" className="ts-attention-main" onClick={() => onOpen(row)}>
        <span className="tg-student-avatar-sm" style={{ background: avatarColor(name) }}>
          {studentInitials(row)}
        </span>
        <span className="ts-attention-body">
          <strong>{name}</strong>
          <span className="ts-attention-meta">{row.groupName}</span>
          <span className="tg-reason-chips">
            {row.attention.reasons.map((reason) => (
              <span key={reason.code} className={`tg-reason-chip tg-reason-${reason.tone}`}>
                {reason.text}
              </span>
            ))}
          </span>
        </span>
      </button>
      <Button variant="ghost" onClick={() => onOpen(row)}>
        {t("tStudents.open")}
      </Button>
    </li>
  );
}

export default function TeacherStudentsPage() {
  const session = getSession();

  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendanceByLesson, setAttendanceByLesson] = useState({});
  const [invoices, setInvoices] = useState([]);

  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const homework = loadHomeworkOverview();
      const [s, g, c, e, a, sub, l, inv, guardians, links] = await Promise.all([
        asList("/students?page_size=500"),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
        asList("/enrollments?page_size=500"),
        homework.then((data) => data.assignments),
        homework.then((data) => data.submissions),
        asList("/lessons?page_size=300"),
        optionalList("/invoices?page_size=500"),
        optionalList("/guardians?page_size=500"),
        optionalList("/student-guardians?page_size=500"),
      ]);
      setStudents(attachGuardiansToStudents(s, guardians, links));
      setGroups(g);
      setCourses(c);
      setEnrollments(e);
      setAssignments(a);
      setSubmissions(sub);
      setLessons(l.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
      setInvoices(inv);

      const groupIds = new Set(g.map((row) => String(row.id)));
      const pastLessons = l
        .filter((row) => groupIds.has(String(row.group)) && new Date(row.starts_at) < new Date())
        .slice(-80);
      const marks = await attendanceForLessons(pastLessons.map((lesson) => lesson.id), { cache: true }).catch(() => ({}));
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

  const publishedByGroup = useMemo(() => {
    const map = new Map();
    assignments
      .filter((row) => row.status === "published")
      .forEach((row) => {
        const key = String(row.group);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      });
    return map;
  }, [assignments]);

  const allRows = useMemo(() => {
    const activeEnrollments = enrollments.filter((row) => row.status === "active");

    return activeEnrollments
      .map((enrollment) => {
        const group = groupMap.get(String(enrollment.group));
        const student = students.find((row) => String(row.id) === String(enrollment.student));
        if (!group || !student) return null;

        const published = publishedByGroup.get(String(group.id)) || [];
        const studentSubs = submissions.filter((row) => String(row.student) === String(student.id));
        const relevantSubs = studentSubs.filter((row) =>
          published.some((assignment) => String(assignment.id) === String(row.assignment)),
        );
        const graded = relevantSubs.filter((row) => row.status === "graded" && row.score != null);
        const done = relevantSubs.filter((row) => row.status !== "not_submitted").length;
        const missingCount = relevantSubs.filter((row) => row.status === "not_submitted").length;
        const pendingReview = relevantSubs.filter((row) =>
          ["submitted", "late"].includes(row.status),
        ).length;
        const avg =
          graded.length > 0
            ? Math.round(graded.reduce((sum, row) => sum + Number(row.score || 0), 0) / graded.length)
            : null;
        const attendancePct = computeStudentAttendancePct(
          student.id,
          lessons,
          attendanceByLesson,
          group.id,
        );
        const lastActivity = computeLastActivity({
          submissions: relevantSubs,
          lessons,
          attendanceByLesson,
          groupId: group.id,
          studentId: student.id,
        });
        const activityLabel = formatLastActivityLabel(lastActivity, relevantSubs);
        const debt = computeStudentDebt(student.id, invoices);
        const studentInvoices = invoices.filter((row) => String(row.student) === String(student.id));
        const currency = studentInvoices.find((row) => row.currency)?.currency || "UZS";
        const status = getStudentStatus({
          attendancePct,
          missingCount,
          totalAssignments: published.length,
          studentStatus: student.status,
        });
        const attention = studentNeedsAttention({
          attendancePct,
          missingCount,
          pendingReview,
          studentStatus: student.status,
        });
        if (debt > 0) {
          attention.reasons.push({
            code: "debt",
            tone: "debt",
            text: t("tch.student.debt", { amount: money(debt, currency) }),
          });
          attention.needs = true;
        }

        return {
          ...student,
          // `status` below is the computed badge; keep the record's own status for the drawer.
          studentStatus: student.status,
          enrollmentId: enrollment.id,
          group,
          groupName: group.name,
          courseName: courseMap.get(String(group.course)) || "—",
          courseId: group.course,
          attendancePct,
          assignmentsDone: published.length ? `${done} / ${published.length}` : "—",
          doneCount: done,
          missingCount,
          pendingReview,
          totalAssignments: published.length,
          avgScore: avg != null ? `${avg}%` : "—",
          avgRaw: avg,
          debt,
          currency,
          studentSubs: relevantSubs,
          lastActivity,
          activityLabel,
          status,
          attention,
        };
      })
      .filter(Boolean);
  }, [
    enrollments,
    groupMap,
    students,
    publishedByGroup,
    submissions,
    lessons,
    attendanceByLesson,
    courseMap,
    invoices,
  ]);

  const filteredRows = useMemo(() => {
    let rows = allRows.filter((row) => {
      const name = (row.full_name || row.name || "").toLowerCase();
      if (query && !name.includes(query.toLowerCase())) return false;
      if (groupFilter && String(row.group.id) !== groupFilter) return false;
      if (courseFilter && String(row.courseId) !== courseFilter) return false;

      if (quickFilter === "low_attendance") {
        if (row.attendancePct == null || row.attendancePct >= 75) return false;
      }
      if (quickFilter === "missing") {
        if (row.missingCount <= 0) return false;
      }
      if (quickFilter === "review") {
        if (row.pendingReview <= 0) return false;
      }
      if (quickFilter === "debt") {
        if (row.debt <= 0) return false;
      }
      if (quickFilter === "active") {
        if (row.status.tone !== "green") return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "attendance") {
        return (b.attendancePct ?? -1) - (a.attendancePct ?? -1);
      }
      if (sortBy === "result") {
        return (b.avgRaw ?? -1) - (a.avgRaw ?? -1);
      }
      if (sortBy === "activity") {
        return (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0);
      }
      if (sortBy === "missing") {
        return b.missingCount - a.missingCount;
      }
      if (sortBy === "debt") {
        return b.debt - a.debt;
      }
      const nameA = (a.full_name || a.name || "").toLowerCase();
      const nameB = (b.full_name || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return rows;
  }, [allRows, query, groupFilter, courseFilter, quickFilter, sortBy]);

  const summary = useMemo(() => {
    const uniqueStudents = new Set(allRows.map((row) => String(row.id)));
    const activeGroups = groups.filter((row) => row.status === "active").length;
    const attendanceValues = allRows
      .map((row) => row.attendancePct)
      .filter((value) => value != null);
    const avgAttendance = attendanceValues.length
      ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length)
      : null;
    const attentionCount = allRows.filter((row) => row.attention.needs).length;

    return [
      { key: "students", label: t("tStudents.statTotal"), value: uniqueStudents.size },
      { key: "groups", label: t("tStudents.statGroups"), value: activeGroups },
      {
        key: "attendance",
        label: t("tStudents.statAttendance"),
        value: avgAttendance != null ? `${avgAttendance}%` : "—",
      },
      { key: "attention", label: t("tStudents.statAttention"), value: attentionCount },
    ];
  }, [allRows, groups]);

  const attentionRows = useMemo(
    () => allRows.filter((row) => row.attention.needs).slice(0, 5),
    [allRows],
  );

  const hasActiveFilters = Boolean(query || groupFilter || courseFilter || quickFilter !== "all");

  function resetFilters() {
    setQuery("");
    setGroupFilter("");
    setCourseFilter("");
    setQuickFilter("all");
  }

  function openStudent(row) {
    setSelected(row);
  }

  const selectedAttendance = selected
    ? buildStudentAttendanceStats(selected.id, lessons, attendanceByLesson, selected.group?.id)
    : null;

  return (
    <div className="ts-page">
      <header className="tg-header">
        <div>
          <h1>{t("tStudents.title")}</h1>
          <p className="tg-sub">{t("tStudents.sub")}</p>
        </div>
      </header>

      {error ? (
        <Banner>
          {t("tStudents.loadError")}{" "}
          <Button variant="ghost" onClick={() => { invalidateApiCache(); load(); }}>
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

      {!loading && attentionRows.length ? (
        <section className="ts-attention" aria-label={t("tStudents.attentionTitle")}>
          <div className="ts-attention-head">
            <h2 className="ts-attention-title">{t("tStudents.attentionTitle")}</h2>
            <span className="ts-attention-count">{attentionRows.length}</span>
          </div>
          <ul className="ts-attention-list">
            {attentionRows.map((row) => (
              <AttentionRow
                key={`${row.id}-${row.group.id}`}
                row={row}
                onOpen={openStudent}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="ts-panel">
        <div className="ts-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder={t("tStudents.searchPlaceholder")} />
          <button
            type="button"
            className="ts-filters-toggle"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            {t("common.filters")}
          </button>
          <div className={`ts-toolbar-filters${filtersOpen ? " is-open" : ""}`}>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label={t("tStudents.groupLabel")}>
              <option value="">{t("common.allGroups")}</option>
              {groups.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label={t("tStudents.courseLabel")}>
              <option value="">{t("common.allCourses")}</option>
              {courses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label={t("tStudents.sortLabel")}>
              {SORT_OPTIONS.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
            {hasActiveFilters ? (
              <button type="button" className="ts-reset-btn" onClick={resetFilters}>
                {t("common.reset")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="ts-quick-filters" role="tablist" aria-label={t("tStudents.quickFilters")}>
          {QUICK_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={quickFilter === item.id}
              className={quickFilter === item.id ? "is-active" : ""}
              onClick={() => setQuickFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <TableSkeleton /> : null}

        {!loading && !allRows.length ? (
          <EmptyState
            title={t("tStudents.emptyTitle")}
            body={t("tStudents.emptyBody")}
          />
        ) : null}

        {!loading && allRows.length && !filteredRows.length ? (
          <EmptyState title={t("tStudents.notFoundTitle")} body={t("tStudents.notFoundBody")} />
        ) : null}

        {!loading && filteredRows.length ? (
          <>
            <div className="tg-table-wrap ts-table-desktop">
              <table className="tg-table ts-table">
                <thead>
                  <tr>
                    <th>{t("tStudents.colStudent")}</th>
                    <th className="ts-col-group">{t("tStudents.colGroup")}</th>
                    <th>{t("tStudents.colAttendance")}</th>
                    <th>{t("tStudents.colAssignments")}</th>
                    <th>{t("tStudents.colAverage")}</th>
                    <th>{t("tStudents.colDebt")}</th>
                    <th>{t("tStudents.colActivity")}</th>
                    <th>{t("tStudents.colStatus")}</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <StudentRowButton key={`${row.id}-${row.group.id}`} row={row} onOpen={openStudent} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ts-cards-mobile">
              {filteredRows.map((row) => (
                <StudentCard key={`${row.id}-${row.group.id}`} row={row} onOpen={openStudent} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <StudentDrawer
        student={selected}
        onClose={() => setSelected(null)}
        submissions={selected?.studentSubs || []}
        assignments={assignments.filter((row) => String(row.group) === String(selected?.group?.id))}
        group={selected?.group}
        courseName={selected?.courseName}
        attendanceStats={selectedAttendance}
        lastActivity={selected?.lastActivity}
        debt={selected?.debt || 0}
        currency={selected?.currency || "UZS"}
      />
    </div>
  );
}
