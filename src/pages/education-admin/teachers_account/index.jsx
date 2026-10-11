import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { useCabinetHeader } from "@/hooks/useCabinetHeader";
import { api } from "@/services/api/client";
import { buildQuery, fetchAll } from "@/services/api/paginate";
import { t } from "@/i18n";
import { formatDayLong, formatTime, sameDay } from "@/utils/format";
import { educationSegmentPath } from "@/utils/routes";
import { IconCalendar, IconCheck, IconHomework } from "@/pages/student/icons";
import { Badge, CardSkeleton, FxEmpty, Kpi, KpiSkeleton, courseToneMap, initialsOf } from "@/pages/student/fx";
import { LoadError } from "@/pages/student/parts";
import { loadHomeworkOverview } from "./homeworkApi";
import { programProgress } from "./groupHelpers";

function IconUsers(props) {
  return (
    <svg className="y-icon" width={props.size || 22} height={props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.5.6 2.6 2 3 4.4" />
    </svg>
  );
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return t("tHome.greetNight");
  if (hour < 12) return t("tHome.greetMorning");
  if (hour < 18) return t("tHome.greetDay");
  return t("tHome.greetEvening");
}

/** Short code for a group tile: "Math A" → "MA", short names ("B1-07") stay as is. */
function groupCode(name) {
  const text = String(name || "").trim();
  if (text.length <= 5) return text.toUpperCase();
  return initialsOf(text);
}

async function loadDashboard() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const [stats, today, groups, courses, students, overview, attendance] = await Promise.all([
    api.get("/teacher/dashboard").catch(() => null),
    fetchAll(
      `/lessons${buildQuery({ page_size: 100, ordering: "starts_at", starts_at_from: dayStart.toISOString(), starts_at_to: dayEnd.toISOString() })}`,
    ),
    fetchAll(`/groups${buildQuery({ page_size: 100 })}`),
    fetchAll(`/courses${buildQuery({ page_size: 100 })}`),
    fetchAll(`/students${buildQuery({ page_size: 100 })}`).catch(() => []),
    loadHomeworkOverview().catch(() => ({ assignments: [], submissions: [] })),
    fetchAll(`/attendance${buildQuery({ page_size: 100 })}`).catch(() => []),
  ]);
  // Whole span of my groups → programme progress (lessons held / planned) per group.
  const starts = groups.map((g) => g.start_date).filter(Boolean).sort();
  const ends = groups.map((g) => g.end_date).filter(Boolean).sort();
  const span =
    starts.length && ends.length
      ? await fetchAll(
          `/lessons${buildQuery({
            page_size: 100,
            starts_at_from: new Date(`${starts[0]}T00:00:00`).toISOString(),
            starts_at_to: new Date(`${ends[ends.length - 1]}T23:59:59`).toISOString(),
          })}`,
        ).catch(() => [])
      : [];
  return { stats, today, groups, courses, students, overview, attendance, span };
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* «Уроки сегодня» (Figma 42:2): time · course · group, status chip, «Отметить» on the current/next lesson. */
function TodayLessons({ lessons, now, path, marked, expected, tones }) {
  const navigate = useNavigate();
  const next = lessons.find((lesson) => new Date(lesson.ends_at).getTime() > now && lesson.status !== "cancelled");
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>
          {t("tHome.lessonsToday")} <span className="tx-head-note">{formatDayLong(now)}</span>
        </h2>
        <Link to={path("schedule")} className="sx-link">
          {t("tHome.scheduleLink")}
        </Link>
      </div>
      {lessons.length ? (
        <ul className="tx-lessons">
          {lessons.map((lesson) => {
            const start = new Date(lesson.starts_at).getTime();
            const end = new Date(lesson.ends_at).getTime();
            const isNext = next && lesson.id === next.id;
            const cancelled = lesson.status === "cancelled";
            const done = end < now;
            const live = start <= now && now <= end;
            const need = expected(lesson);
            const unmarked = done && need > 0 && marked(lesson) < need;
            let badge = { tone: "navy", label: t("tHome.badgeExpected") };
            if (cancelled) badge = { tone: "red", label: t("tHome.badgeCancelled") };
            else if (live) badge = { tone: "teal", label: t("tHome.badgeLive") };
            else if (unmarked) badge = { tone: "amber", label: t("tHome.badgeUnmarked") };
            else if (done) badge = { tone: "grey", label: t("tHome.badgeDone") };
            else if (isNext) badge = { tone: "blue", label: t("tHome.badgeNext") };
            const showMark = !cancelled && (isNext || live || unmarked);
            const minutes = Math.round((end - start) / 60000);
            return (
              <li
                key={lesson.id}
                className={`tx-lesson${isNext || live ? " is-next" : ""}${done && !unmarked ? " is-done" : ""} is-${tones.get(String(lesson.course)) || "blue"}`}
              >
                <strong className="tx-lesson-time">{formatTime(lesson.starts_at)}</strong>
                <span className="tx-lesson-copy">
                  <strong>
                    {lesson.course_name || t("tHome.lesson")}
                    {lesson.group_name ? ` · ${lesson.group_name}` : ""}
                  </strong>
                  <span>
                    {[
                      lesson.room_name && t("tHome.room", { room: lesson.room_name }),
                      need ? t("plural.students", { count: need }) : null,
                      t("format.minutes", { count: minutes }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                {showMark ? (
                  <button
                    type="button"
                    className="sx-btn sx-btn-primary sx-btn-sm"
                    onClick={() => navigate(`${path("attendance")}?lesson=${lesson.id}`)}
                  >
                    <IconCheck size={16} />
                    {t("tHome.mark")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <FxEmpty icon={IconCalendar} title={t("tHome.noLessonsTitle")} body={t("tHome.noLessonsBody")} />
      )}
    </section>
  );
}

/* «Ждут проверки» (Figma): student avatar, homework · group, «Проверить». */
function AwaitingReview({ rows, path }) {
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>
          {t("tHome.waitingReview")}{" "}
          {rows.length ? (
            <Badge tone="amber" plain>
              {rows.length}
            </Badge>
          ) : null}
        </h2>
        <Link to={`${path("assignments")}?status=review`} className="sx-link">
          {t("tHome.allLink")}
        </Link>
      </div>
      {rows.length ? (
        <ul className="sx-rows">
          {rows.slice(0, 5).map((row, index) => (
            <li key={row.id}>
              <div className="sx-row">
                <span className={`tx-av is-${["blue", "teal", "navy", "violet", "amber"][index % 5]}`}>{initialsOf(row.studentName)}</span>
                <span className="sx-row-copy">
                  <strong>{row.studentName}</strong>
                  <span>
                    {row.title}
                    {row.groupName ? ` · ${row.groupName}` : ""}
                  </span>
                </span>
                <Link
                  to={`${path("assignments")}?status=review${row.group ? `&group=${row.group}` : ""}`}
                  className="sx-btn sx-btn-soft sx-btn-sm"
                >
                  {t("tHome.review")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <FxEmpty icon={IconHomework} title={t("tHome.allCheckedTitle")} body={t("tHome.allCheckedBody")} />
      )}
    </section>
  );
}

/* «Мои группы» cards: code tile, students, programme progress, attendance. */
function GroupCards({ groups, courseName, span, attendance, now, tones, path }) {
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>{t("tHome.myGroups")}</h2>
        <Link to={path("groups")} className="sx-link">
          {t("tHome.allGroupsLink")}
        </Link>
      </div>
      {groups.length ? (
        <div className="tx-groups">
          {groups.map((group) => {
            const tone = tones.get(String(group.course)) || "blue";
            const own = span.filter((lesson) => String(lesson.group) === String(group.id) && lesson.status !== "cancelled");
            const program = programProgress(group, own, now) ?? 0;
            const counted = attendance.filter(
              (row) => String(row.group) === String(group.id) && row.lesson_status !== "cancelled" && ["present", "late", "absent"].includes(row.status),
            );
            const attended = counted.filter((row) => row.status !== "absent").length;
            const rate = counted.length ? Math.round((attended / counted.length) * 100) : null;
            return (
              <Link key={group.id} to={path("groups")} className={`tx-group is-${tone}`}>
                <div className="tx-group-head">
                  <span className="tx-group-code">{groupCode(group.name)}</span>
                  <span>
                    <strong>{courseName(group.course) || group.name}</strong>
                    <small>
                      {group.name} · {t("plural.students", { count: group.active_students || 0 })}
                    </small>
                  </span>
                </div>
                <div className="tx-group-stat">
                  <span>
                    {t("tHome.programProgress")} <b>{program}%</b>
                  </span>
                  <div className={`sx-bar is-${tone === "blue" ? "" : tone}`}>
                    <span style={{ width: `${program}%` }} />
                  </div>
                </div>
                <div className="tx-group-att">
                  <span>{t("tHome.attendance")}</span>
                  <b>{rate == null ? "—" : `${rate}%`}</b>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <FxEmpty title={t("tHome.noGroupsTitle")} body={t("tHome.noGroupsBody")} />
      )}
    </section>
  );
}

export default function TeacherDashboard() {
  const { tenantSlug = "" } = useParams();
  const { teacherName = "" } = useOutletContext() || {};
  const path = (segment) => educationSegmentPath(tenantSlug, segment);
  const data = useAsync(loadDashboard, [tenantSlug]);
  const [attendanceByLesson, setAttendanceByLesson] = useState({});
  const now = useNow();

  const d = data.data;
  const today = useMemo(() => (d?.today || []).filter((lesson) => sameDay(lesson.starts_at, Date.now())), [d]);

  // Marks per today's lesson decide «Не отмечен» / «Проведён».
  useEffect(() => {
    if (!today.length) return undefined;
    let alive = true;
    Promise.all(
      today.map((lesson) =>
        api
          .get(`/lessons/${lesson.id}/attendance`)
          .then((rows) => [lesson.id, (rows?.results || rows || []).length])
          .catch(() => [lesson.id, 0]),
      ),
    ).then((entries) => alive && setAttendanceByLesson(Object.fromEntries(entries)));
    return () => {
      alive = false;
    };
  }, [today]);

  const groupById = useMemo(() => new Map((d?.groups || []).map((g) => [String(g.id), g])), [d]);
  const courseById = useMemo(() => new Map((d?.courses || []).map((c) => [String(c.id), c.name])), [d]);
  const studentById = useMemo(() => new Map((d?.students || []).map((s) => [String(s.id), s.full_name])), [d]);
  const tones = useMemo(() => courseToneMap(d?.groups || []), [d]);
  const homeworkById = useMemo(() => new Map((d?.overview.assignments || []).map((a) => [String(a.id), a])), [d]);

  const awaiting = useMemo(
    () =>
      (d?.overview.submissions || [])
        .filter((row) => ["submitted", "late"].includes(row.status))
        .sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
        .map((row) => {
          const homework = homeworkById.get(String(row.homework || row.assignment));
          const group = homework ? groupById.get(String(homework.group)) : null;
          return {
            id: row.id,
            studentName: row.student_name || studentById.get(String(row.student)) || t("tHome.student"),
            title: homework?.title || row.homework_title || t("tHome.assignment"),
            group: group?.id,
            groupName: group?.name,
          };
        }),
    [d, homeworkById, groupById, studentById],
  );

  const stats = d?.stats;
  const pending = stats?.pending_reviews ?? awaiting.length;
  const nextLesson = today.find((lesson) => new Date(lesson.starts_at).getTime() > now && lesson.status !== "cancelled");
  const first = (teacherName || "").split(" ")[0];
  useCabinetHeader(
    first
      ? t("tHome.greeting", { greeting: greeting(new Date(now)), name: first })
      : t("tHome.greetingPlain", { greeting: greeting(new Date(now)) }),
    data.loading
      ? t("tHome.loadingDay")
      : t("tHome.daySummary", {
          lessons: t("plural.lessons", { count: today.length }),
          works: t("plural.works", { count: pending }),
        }),
  );

  if (data.error) return <LoadError error={data.error} onRetry={data.reload} />;

  const expected = (lesson) => groupById.get(String(lesson.group))?.active_students || 0;
  const marked = (lesson) => attendanceByLesson[lesson.id] || 0;

  return (
    <div className="sx-page">
      <div className="sx-kpis">
        {data.loading ? (
          [0, 1, 2, 3].map((key) => <KpiSkeleton key={key} />)
        ) : (
          <>
            <Kpi
              icon={IconCalendar}
              tone="blue"
              label={t("tHome.kpiLessons")}
              value={today.length}
              note={
                nextLesson
                  ? t("tHome.kpiNextAt", { time: formatTime(nextLesson.starts_at) })
                  : t(today.length ? "tHome.kpiAllDone" : "tHome.kpiFreeDay")
              }
              to={path("schedule")}
            />
            <Kpi
              icon={IconUsers}
              tone="teal"
              label={t("tHome.kpiStudents")}
              value={stats?.students_count ?? "—"}
              note={t("tHome.kpiInGroups", { count: stats?.groups_count ?? d.groups.length })}
              to={path("students")}
            />
            <Kpi
              icon={IconHomework}
              tone="amber"
              label={t("tHome.kpiReview")}
              value={pending}
              note={t(pending ? "tHome.kpiReviewNote" : "tHome.kpiReviewDone")}
              tag={pending ? t("tHome.review") : null}
              tagTone="amber"
              to={`${path("assignments")}?status=review`}
            />
            <Kpi
              icon={IconCheck}
              tone="violet"
              label={t("tHome.kpiAttendance")}
              value={stats?.avg_attendance_pct == null ? "—" : `${Math.round(stats.avg_attendance_pct)}%`}
              note={t("tHome.kpiAttendanceNote")}
              tag={stats?.unmarked_attendance ? t("tHome.kpiUnmarked", { count: stats.unmarked_attendance }) : null}
              tagTone="red"
              to={path("attendance")}
            />
          </>
        )}
      </div>

      {data.loading ? (
        <div className="tx-grid">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : (
        <div className="tx-grid">
          <TodayLessons lessons={today} now={now} path={path} marked={marked} expected={expected} tones={tones} />
          <AwaitingReview rows={awaiting} path={path} />
        </div>
      )}

      {data.loading ? (
        <CardSkeleton lines={4} />
      ) : (
        <GroupCards
          groups={d.groups}
          courseName={(id) => courseById.get(String(id))}
          span={d.span}
          attendance={d.attendance}
          now={now}
          tones={tones}
          path={path}
        />
      )}
    </div>
  );
}
