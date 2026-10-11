import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Banner, EmptyState, SearchInput } from "@/components/ui";
import { useCabinetHeader } from "@/hooks/useCabinetHeader";
import { t, translated } from "@/i18n";
import { api, getSession } from "@/services/api/client";
import { attendanceForLessons } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import { educationSegmentPath } from "@/utils/routes";
import CreateAssignmentSheet from "./CreateAssignmentSheet";
import GroupContextMenu from "./GroupContextMenu";
import GroupDetailPanel from "./GroupDetailPanel";
import {
  buildScheduleSummary,
  computeGroupAttendancePct,
  findNextLesson,
  formatNextLessonLabel,
  groupAttentionItems,
  programProgress,
  reviewPendingCount,
  studentInitials,
} from "./groupHelpers";
import { asList, attachGuardiansToStudents, isSameLocalDay, membershipName, optionalList } from "./utils";
import { loadHomeworkOverview } from "./homeworkApi";

const STATUS_TABS = [
  { value: "", label: "t:tGroups.filterAll" },
  { value: "active", label: "t:tGroups.filterActive" },
  { value: "planned", label: "t:tGroups.filterPlanned" },
  { value: "completed", label: "t:tGroups.filterCompleted" },
  { value: "archived", label: "t:tGroups.filterArchived" },
].map(translated);

const TONES = ["blue", "teal", "violet", "amber", "pink", "navy"];

function groupCode(name) {
  const text = String(name || "").trim();
  if (text.length <= 5) return text.toUpperCase();
  const words = text.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : text.slice(0, 2)).toUpperCase();
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function GroupsSkeleton() {
  return (
    <div className="tgc-grid">
      {[1, 2, 3].map((key) => (
        <div key={key} className="tgc-card tgc-skeleton" />
      ))}
    </div>
  );
}

export default function TeacherGroupsPage() {
  const { tenantSlug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = getSession();
  const path = (segment) => educationSegmentPath(tenantSlug, segment);

  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [rules, setRules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendanceByLesson, setAttendanceByLesson] = useState({});
  const [dashStats, setDashStats] = useState(null);

  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const selectedId = searchParams.get("group");
  const [createForGroup, setCreateForGroup] = useState(null);
  const [detailTab, setDetailTab] = useState("students");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const homework = loadHomeworkOverview();
      const [dash, g, c, r, a, sub, m, e, rm, l, st, guardians, links] = await Promise.all([
        api.get("/teacher/dashboard", { cache: true }).catch(() => null),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
        asList("/schedule-rules?page_size=200"),
        homework.then((data) => data.assignments),
        homework.then((data) => data.submissions),
        asList("/materials?page_size=200"),
        asList("/enrollments?page_size=500"),
        asList("/rooms?page_size=100"),
        asList("/lessons?page_size=300"),
        asList("/students?page_size=500"),
        optionalList("/guardians?page_size=500"),
        optionalList("/student-guardians?page_size=500"),
      ]);
      setDashStats(dash);
      setGroups(g);
      setCourses(c);
      setRules(r);
      setAssignments(a);
      setSubmissions(sub);
      setMaterials(m);
      setEnrollments(e);
      setRooms(rm);
      setLessons(l.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
      setStudents(attachGuardiansToStudents(st, guardians, links));

      const pastLessons = l.filter((row) => new Date(row.starts_at) < new Date()).slice(-80);
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
  const roomMap = useMemo(() => new Map(rooms.map((row) => [String(row.id), row.name])), [rooms]);
  const studentMap = useMemo(() => new Map(students.map((row) => [String(row.id), row])), [students]);

  const allRows = useMemo(() => {
    return groups
      .map((group) => {
        const groupRules = rules.filter(
          (row) => String(row.group) === String(group.id) && row.is_active !== false,
        );
        const schedule = buildScheduleSummary(groupRules);
        const roomId = groupRules[0]?.room;
        const groupLessons = lessons.filter((row) => String(row.group) === String(group.id));
        const groupAssignments = assignments.filter((row) => String(row.group) === String(group.id));
        const published = groupAssignments.filter((row) => row.status === "published");
        const pendingReviews = published.reduce((sum, row) => sum + reviewPendingCount(row), 0);
        const missingSubmissions = published.reduce(
          (sum, row) => sum + Number(row.missing_count || 0),
          0,
        );
        const studentCount =
          group.active_students ??
          enrollments.filter((row) => String(row.group) === String(group.id) && row.status === "active")
            .length;
        const nextLesson = findNextLesson(lessons, group.id);
        const attendancePct = computeGroupAttendancePct(lessons, attendanceByLesson, group.id);
        const todayLessons = groupLessons.filter((row) => isSameLocalDay(row.starts_at));
        const programPct = programProgress(group, groupLessons);
        const roster = enrollments
          .filter((row) => String(row.group) === String(group.id) && row.status === "active")
          .map((row) => studentMap.get(String(row.student)))
          .filter(Boolean);
        const unmarkedToday = todayLessons.filter((lesson) => {
          const expected = studentCount;
          const marked = (attendanceByLesson[lesson.id] || []).length;
          return expected > 0 && marked < expected && new Date(lesson.starts_at) < new Date();
        }).length;

        return {
          ...group,
          courseName: courseMap.get(String(group.course)) || "—",
          schedule,
          roomName: roomMap.get(String(roomId)) || "—",
          studentCount,
          pendingReviews,
          missingSubmissions,
          nextLesson,
          nextLessonLabel: formatNextLessonLabel(nextLesson),
          nextLessonToday: nextLesson ? isSameLocalDay(nextLesson.starts_at) : false,
          attendancePct,
          programPct,
          roster,
          unmarkedToday,
          groupLessons,
        };
      })
      .filter((group) => {
        if (courseFilter && String(group.course) !== courseFilter) return false;
        if (query && !group.name.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      });
  }, [
    groups,
    rules,
    lessons,
    assignments,
    enrollments,
    courseFilter,
    query,
    courseMap,
    roomMap,
    studentMap,
    attendanceByLesson,
  ]);

  const rows = useMemo(
    () => (statusFilter ? allRows.filter((row) => row.status === statusFilter) : allRows),
    [allRows, statusFilter],
  );

  const selected = useMemo(
    () => allRows.find((row) => String(row.id) === String(selectedId)) || null,
    [allRows, selectedId],
  );

  const studentTotal = dashStats?.students_count ?? enrollments.filter((row) => row.status === "active").length;
  useCabinetHeader(
    t("tGroups.title"),
    loading
      ? t("tGroups.subLoading")
      : `${t("plural.groups", { count: groups.length })} · ${t("plural.students", { count: studentTotal })}`,
  );

  const tabCounts = useMemo(() => {
    const counts = { "": allRows.length };
    allRows.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });
    return counts;
  }, [allRows]);

  function openGroup(id, tab) {
    if (tab) setDetailTab(tab);
    setSearchParams(id ? { group: String(id) } : {});
    window.scrollTo({ top: 0 });
  }

  function openAttendance(groupRow) {
    const target =
      groupRow.nextLesson && isSameLocalDay(groupRow.nextLesson.starts_at)
        ? groupRow.nextLesson
        : groupRow.groupLessons.find((row) => new Date(row.starts_at) < new Date()) || groupRow.nextLesson;
    if (target) {
      navigate(`${path("attendance")}?lesson=${target.id}`);
      return;
    }
    navigate(path("attendance"));
  }

  function openNotify(groupRow) {
    navigate(`${path("notifications")}?group=${groupRow.id}`);
  }

  async function handleAssignmentSaved() {
    setCreateForGroup(null);
    await load();
  }

  const teacherName = membershipName(currentMembership(session), session?.user);

  return (
    <div className="tg-page">
      {error ? <Banner>{error}</Banner> : null}

      {loading ? <GroupsSkeleton /> : null}

      {!loading && !groups.length ? (
        <EmptyState
          title={t("tGroups.emptyTitle")}
          body={t("tGroups.emptyBody")}
        />
      ) : null}

      {!loading && groups.length && selected ? (
        <div className="tgc-detail">
          <button type="button" className="tgc-back" onClick={() => openGroup(null)}>
            {t("tGroups.backToAll")}
          </button>
          <section className="tg-detail-pane">
            <GroupDetailPanel
              inline
              group={selected}
              teacherName={teacherName}
              initialTab={detailTab}
              onTabChange={setDetailTab}
              enrollments={enrollments}
              students={students}
              assignments={assignments.filter((row) => String(row.group) === String(selected.id))}
              submissions={submissions.filter((row) =>
                assignments.some(
                  (a) =>
                    String(a.group) === String(selected.id) &&
                    String(a.id) === String(row.assignment),
                ),
              )}
              materials={materials.filter((row) => String(row.group) === String(selected.id))}
              rules={rules.filter((row) => String(row.group) === String(selected.id))}
              lessons={lessons.filter((row) => String(row.group) === String(selected.id))}
              attendanceByLesson={attendanceByLesson}
              courseName={courseMap.get(String(selected.course)) || ""}
              roomMap={roomMap}
              onOpenAttendance={openAttendance}
              onCreateAssignment={(group) => setCreateForGroup(group)}
              onOpenSchedule={(groupId) => navigate(`${path("schedule")}?group=${groupId}`)}
              onOpenAssignments={(assignmentId) =>
                navigate(
                  assignmentId
                    ? `${path("assignments")}?assignment=${assignmentId}`
                    : path("assignments"),
                )
              }
              onNotify={() => openNotify(selected)}
              onRefresh={load}
            />
          </section>
        </div>
      ) : null}

      {!loading && groups.length && !selected ? (
        <>
          <div className="tgc-toolbar">
            <div className="sx-tabs tgc-tabs" role="tablist" aria-label={t("tGroups.statusTabs")}>
              {STATUS_TABS.filter((tab) => !tab.value || tab.value === "active" || tabCounts[tab.value]).map((tab) => (
                <button
                  key={tab.value || "all"}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.value}
                  className={`sx-tab${statusFilter === tab.value ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                  {tab.value === "archived" ? "" : ` · ${tabCounts[tab.value] || 0}`}
                </button>
              ))}
            </div>
            <div className="tgc-tools">
              <SearchInput className="tgc-search" value={query} onChange={setQuery} placeholder={t("tGroups.searchPlaceholder")} />
              {courses.length > 1 ? (
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label={t("tGroups.course")}>
                  <option value="">{t("common.allCourses")}</option>
                  {courses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          {!rows.length ? <EmptyState title={t("tGroups.notFound")} /> : null}

          <div className="tgc-grid">
            {rows.map((row, index) => {
              const tone = TONES[index % TONES.length];
              const alert = groupAttentionItems(row)[0];
              const shown = row.roster.slice(0, 4);
              const rest = Math.max(0, row.studentCount - shown.length);
              return (
                <article key={row.id} className={`tgc-card is-${tone}`}>
                  <header className="tgc-head">
                    <span className="tgc-code">{groupCode(row.name)}</span>
                    <div className="tgc-title">
                      <strong>{row.name}</strong>
                      <span>{row.courseName}</span>
                    </div>
                    <span className={`tgc-status is-${row.status}`}>{statusLabel(row.status)}</span>
                  </header>

                  <ul className="tgc-meta">
                    <li>
                      <IconClock />
                      {row.schedule.days !== "—" ? `${row.schedule.days} · ${row.schedule.time}` : t("tGroups.noSchedule")}
                    </li>
                    <li>
                      <IconPin />
                      {row.roomName !== "—" ? t("tGroups.room", { room: row.roomName }) : t("tGroups.noRoom")}
                    </li>
                  </ul>

                  <div className="tgc-stats">
                    <div>
                      <span>{t("tGroups.attendance")}</span>
                      <strong>{row.attendancePct != null ? `${row.attendancePct}%` : "—"}</strong>
                    </div>
                    <div>
                      <span>{t("tGroups.program")}</span>
                      <strong>{row.programPct != null ? `${row.programPct}%` : "—"}</strong>
                    </div>
                  </div>

                  <div className="tgc-note">
                    {alert ? <p className="tgc-alert">{alert}</p> : <span />}
                    <GroupContextMenu
                      ariaLabel={t("tGroups.actionsFor", { name: row.name })}
                      onAttendance={() => openAttendance(row)}
                      onCreateAssignment={() => setCreateForGroup(row)}
                      onAddMaterial={() => openGroup(row.id, "materials")}
                      onNotify={() => openNotify(row)}
                      onOpenSchedule={() => navigate(`${path("schedule")}?group=${row.id}`)}
                    />
                  </div>

                  <footer className="tgc-foot">
                    <div className="tgc-people">
                      {shown.length ? (
                        <span className="tgc-avatars" aria-hidden="true">
                          {shown.map((student) => (
                            <span key={student.id} className="tgc-av">
                              {studentInitials(student)}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className="tgc-more">
                        {shown.length
                          ? rest
                            ? `+${t("plural.students", { count: rest })}`
                            : ""
                          : t("plural.students", { count: row.studentCount })}
                      </span>
                    </div>
                    <button type="button" className="sx-btn sx-btn-outline tgc-open" onClick={() => openGroup(row.id, "students")}>
                      {t("tGroups.open")}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      <CreateAssignmentSheet
        open={Boolean(createForGroup)}
        onClose={() => setCreateForGroup(null)}
        groups={groups}
        courses={courses}
        initialGroup={createForGroup?.id || ""}
        lockGroup={Boolean(createForGroup)}
        onSaved={handleAssignmentSaved}
      />
    </div>
  );
}

function statusLabel(status) {
  const keys = { active: "statusActive", planned: "statusPlanned", completed: "statusCompleted", archived: "statusArchived" };
  return keys[status] ? t(`tGroups.${keys[status]}`) : status;
}
