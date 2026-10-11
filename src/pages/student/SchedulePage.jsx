import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { listAttendance, listLessons, loadHomework } from "@/services/student";
import { formatDayLong, formatTime, localDayKey, pluralRu, sameDay, shiftDays, startOfWeek } from "@/utils/format";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClock, IconPin, IconTeacher } from "./icons";
import { LoadError, useCabinetHeader } from "./parts";
import { Badge, FxEmpty, courseToneMap, lessonBadge } from "./fx";
import { ATTENDANCE_SHORT, LessonDialog, WEEKDAYS, lessonTitle, lessonTone, weekNumber } from "./scheduleParts";

const VIEW_KEY = "yagona-student-schedule-view";
const HOUR_PX = 62;
const VIEWS = [
  ["day", "День"],
  ["week", "Неделя"],
  ["list", "Список"],
];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function readView() {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return VIEWS.some(([key]) => key === value) ? value : "week";
  } catch {
    return "week";
  }
}

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function minutesOfDay(value) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

/** Lay overlapping lessons of one day side by side. */
function withLanes(list) {
  const sorted = [...list].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const laneEnds = [];
  const placed = sorted.map((lesson) => {
    const start = new Date(lesson.starts_at).getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = new Date(lesson.ends_at).getTime();
    return { lesson, lane };
  });
  return placed.map((item) => ({ ...item, lanes: laneEnds.length }));
}

function rangeTitle(days) {
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length === 1) return `${first.getDate()} ${MONTHS_GEN[first.getMonth()]} ${first.getFullYear()}`;
  const from = first.getMonth() === last.getMonth() ? `${first.getDate()}` : `${first.getDate()} ${MONTHS_GEN[first.getMonth()]}`;
  return `${from} – ${last.getDate()} ${MONTHS_GEN[last.getMonth()]} ${last.getFullYear()}`;
}

/* Time grid (Figma 19:825): day header with big numbers, hour rows, course-coloured blocks. */
function TimeGrid({ days, lessons, now, tones, attendanceByLesson, onOpen }) {
  const byDay = new Map(days.map((day) => [localDayKey(day), []]));
  for (const lesson of lessons) byDay.get(localDayKey(lesson.starts_at))?.push(lesson);

  let first = 9;
  let last = 19;
  for (const lesson of lessons) {
    first = Math.min(first, Math.floor(minutesOfDay(lesson.starts_at) / 60));
    last = Math.max(last, Math.ceil(minutesOfDay(lesson.ends_at) / 60));
  }
  const hours = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const height = (last - first) * HOUR_PX;
  const nowMinutes = minutesOfDay(now) - first * 60;

  return (
    <div className="fs-grid" style={{ "--fs-cols": days.length, "--fs-height": `${height}px` }}>
      <div className="fs-corner" aria-hidden="true" />
      {days.map((day) => {
        const today = sameDay(day, now);
        return (
          <div key={day.toISOString()} className={`fs-day-head${today ? " is-today" : ""}`}>
            <span>{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
            <strong>{day.getDate()}</strong>
          </div>
        );
      })}

      <div className="fs-hours" aria-hidden="true">
        {hours.map((hour) => (
          <span key={hour} style={{ top: `${(hour - first) * HOUR_PX}px` }}>
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
      </div>

      {days.map((day) => {
        const today = sameDay(day, now);
        const placed = withLanes(byDay.get(localDayKey(day)) || []);
        return (
          <div key={day.toISOString()} className="fs-col" aria-label={formatDayLong(day)}>
            {hours.map((hour) => (
              <span key={hour} className="fs-line" style={{ top: `${(hour - first) * HOUR_PX}px` }} />
            ))}
            {today && nowMinutes >= 0 && nowMinutes <= (last - first) * 60 ? (
              <span className="fs-now" style={{ top: `${(nowMinutes / 60) * HOUR_PX}px` }} aria-hidden="true" />
            ) : null}
            {placed.map(({ lesson, lane, lanes }) => {
              const top = ((minutesOfDay(lesson.starts_at) - first * 60) / 60) * HOUR_PX;
              const length = Math.max(((new Date(lesson.ends_at) - new Date(lesson.starts_at)) / 3600000) * HOUR_PX, 44);
              const tone = lessonTone(lesson, now);
              const mark = attendanceByLesson.get(String(lesson.id));
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className={`fs-block is-${tones.get(String(lesson.course)) || "blue"}${tone === "past" ? " is-past" : ""}${tone === "cancelled" ? " is-cancelled" : ""}${tone === "ongoing" ? " is-live" : ""}`}
                  style={{
                    top: `${top + 3}px`,
                    height: `${length - 6}px`,
                    left: `calc(${(lane / lanes) * 100}% + 4px)`,
                    width: `calc(${100 / lanes}% - 8px)`,
                  }}
                  onClick={() => onOpen(lesson)}
                  aria-label={`${lessonTitle(lesson)}, ${formatTime(lesson.starts_at)}–${formatTime(lesson.ends_at)}`}
                >
                  <strong>{lessonTitle(lesson)}</strong>
                  <span>
                    {formatTime(lesson.starts_at)}
                    {lesson.room_name ? ` · Каб. ${lesson.room_name}` : ""}
                  </span>
                  {tone === "cancelled" ? <em>Отменён</em> : null}
                  {tone === "ongoing" ? <em>Идёт сейчас</em> : null}
                  {tone === "past" && mark ? <em>{ATTENDANCE_SHORT[mark.status]}</em> : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function AgendaList({ lessons, now, tones, onOpen }) {
  const byDay = new Map();
  for (const lesson of lessons) {
    const key = localDayKey(lesson.starts_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(lesson);
  }
  return (
    <div className="fs-agenda">
      {[...byDay.keys()].sort().map((key) => {
        const list = byDay.get(key).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        const date = new Date(list[0].starts_at);
        return (
          <section key={key}>
            <h3>
              {date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
              {sameDay(date, now) ? <Badge tone="blue" plain>Сегодня</Badge> : null}
            </h3>
            <ul className="sx-lessons">
              {list.map((lesson) => {
                const badge = lessonBadge(lesson, now);
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className={`sx-lesson fx-lesson-btn is-${tones.get(String(lesson.course)) || "blue"}${badge.label === "Прошёл" ? " is-past" : ""}`}
                      onClick={() => onOpen(lesson)}
                    >
                      <span className="sx-lesson-bar" aria-hidden="true" />
                      <span className="sx-lesson-time">
                        <strong>
                          {formatTime(lesson.starts_at)} – {formatTime(lesson.ends_at)}
                        </strong>
                        <span>{Math.round((new Date(lesson.ends_at) - new Date(lesson.starts_at)) / 60000)} мин</span>
                      </span>
                      <span className="sx-lesson-copy">
                        <strong>{lessonTitle(lesson)}</strong>
                        <span>
                          {[lesson.group_name, lesson.room_name && `Каб. ${lesson.room_name}`, lesson.teacher_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* Mini month calendar (Figma 19:971). Picking a day jumps the grid to it. */
function MonthCalendar({ month, onMonth, selected, onPick, lessonDays, now }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, index) => shiftDays(gridStart, index));
  const weeks = cells[35].getMonth() !== month.getMonth() ? cells.slice(0, 35) : cells;
  const title = month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(" г.", "");

  return (
    <section className="sx-card fs-month">
      <div className="sx-card-head">
        <h2>{title.charAt(0).toUpperCase() + title.slice(1)}</h2>
        <div className="fs-month-nav">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <IconChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Следующий месяц" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="fs-month-grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((label) => (
          <span key={label} className="fs-month-wd">
            {label}
          </span>
        ))}
        {weeks.map((date) => {
          const outside = date.getMonth() !== month.getMonth();
          const isToday = sameDay(date, now);
          const isSelected = sameDay(date, selected);
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={`fs-month-day${outside ? " is-outside" : ""}${isToday ? " is-today" : ""}${isSelected && !isToday ? " is-selected" : ""}${lessonDays.has(localDayKey(date)) ? " has-lesson" : ""}`}
              onClick={() => onPick(date)}
              aria-label={formatDayLong(date)}
              aria-current={isToday ? "date" : undefined}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NearestLesson({ lesson, now, onOpen }) {
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Ближайший урок</h2>
      </div>
      {lesson ? (
        <>
          <div className="fs-nearest">
            <strong>
              {lessonTitle(lesson)}
              {lesson.group_name ? ` · ${lesson.group_name}` : ""}
            </strong>
            <span>
              <IconClock size={16} />
              {sameDay(lesson.starts_at, now) ? "Сегодня" : formatDayLong(lesson.starts_at)}, {formatTime(lesson.starts_at)} –{" "}
              {formatTime(lesson.ends_at)}
            </span>
            <span>
              <IconPin size={16} />
              {lesson.room_name ? `Кабинет ${lesson.room_name}` : "Кабинет не указан"}
            </span>
            <span>
              <IconTeacher size={16} />
              {lesson.teacher_name || "Преподаватель не назначен"}
            </span>
          </div>
          <button type="button" className="sx-btn sx-btn-primary" onClick={() => onOpen(lesson)}>
            Подробнее об уроке
          </button>
        </>
      ) : (
        <FxEmpty icon={IconCalendar} title="Ближайших уроков нет" />
      )}
    </section>
  );
}

function CourseLegend({ lessons, tones }) {
  const courses = new Map();
  for (const lesson of lessons) {
    const key = String(lesson.course);
    if (!courses.has(key)) courses.set(key, lessonTitle(lesson));
  }
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Мои курсы</h2>
      </div>
      {courses.size ? (
        <ul className="fs-legend">
          {[...courses.entries()].map(([key, name]) => (
            <li key={key} className={`is-${tones.get(key) || "blue"}`}>
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sx-muted">Курсы появятся вместе с уроками.</p>
      )}
    </section>
  );
}

export default function StudentSchedulePage() {
  const now = useNow();
  const [anchor, setAnchor] = useState(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  });
  const [view, setView] = useState(readView);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(null);

  const weekStart = startOfWeek(anchor);
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, index) => shiftDays(weekStart, index));
  const from = days[0];
  const to = shiftDays(days[days.length - 1], 1);

  const lessons = useAsync(() => listLessons(from, to), [from.getTime(), to.getTime()]);
  // Month-wide lessons power the mini calendar dots, the nearest lesson and the legend.
  const monthLessons = useAsync(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const fromDate = start < new Date() ? start : new Date();
    return listLessons(startOfWeek(fromDate), shiftDays(end, 7));
  }, [month.getTime()]);
  const attendance = useAsync(() => listAttendance());
  const homework = useAsync(loadHomework);

  const tones = useMemo(() => courseToneMap(monthLessons.data || lessons.data), [monthLessons.data, lessons.data]);
  const attendanceByLesson = useMemo(
    () => new Map((attendance.data || []).map((row) => [String(row.lesson), row])),
    [attendance.data],
  );
  const lessonDays = useMemo(
    () => new Set((monthLessons.data || []).map((lesson) => localDayKey(lesson.starts_at))),
    [monthLessons.data],
  );
  const nearest = (monthLessons.data || []).find(
    (lesson) => new Date(lesson.ends_at).getTime() > now && lesson.status !== "cancelled",
  );

  const count = lessons.data?.length || 0;
  useCabinetHeader(
    "Расписание",
    lessons.loading ? `Неделя ${weekNumber(weekStart)}` : `Неделя ${weekNumber(weekStart)} · ${pluralRu(count, ["урок", "урока", "уроков"])}`,
  );

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  function shift(direction) {
    setAnchor((value) => shiftDays(value, direction * (view === "day" ? 1 : 7)));
  }

  function pick(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    setAnchor(day);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const showingToday = days.some((day) => sameDay(day, today));

  return (
    <div className="fs-layout">
      <section className="sx-card fs-main">
        <div className="fs-toolbar">
          <div className="fs-nav">
            <button type="button" className="fs-nav-btn" onClick={() => shift(-1)} aria-label={view === "day" ? "Предыдущий день" : "Предыдущая неделя"}>
              <IconChevronLeft size={18} />
            </button>
            <button type="button" className="fs-nav-btn" onClick={() => shift(1)} aria-label={view === "day" ? "Следующий день" : "Следующая неделя"}>
              <IconChevronRight size={18} />
            </button>
            <h2>{rangeTitle(days)}</h2>
            {!showingToday ? (
              <button type="button" className="sx-btn sx-btn-soft sx-btn-sm" onClick={() => pick(today)}>
                Сегодня
              </button>
            ) : null}
          </div>
          <div className="sx-tabs" role="tablist" aria-label="Вид расписания">
            {VIEWS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={`sx-tab${view === key ? " is-active" : ""}`}
                onClick={() => changeView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {lessons.loading ? (
          <div className="fs-loading" aria-busy="true">
            <Skeleton height={44} radius={12} />
            <Skeleton lines={7} height={44} />
          </div>
        ) : lessons.error ? (
          <LoadError error={lessons.error} onRetry={lessons.reload} />
        ) : view === "list" ? (
          count ? (
            <AgendaList lessons={lessons.data} now={now} tones={tones} onOpen={setSelected} />
          ) : (
            <FxEmpty icon={IconCalendar} title="На этой неделе уроков нет" body="Переключите неделю стрелками или выберите дату в календаре." />
          )
        ) : (
          <>
            <div className="fs-grid-wrap">
              <TimeGrid
                days={days}
                lessons={lessons.data}
                now={now}
                tones={tones}
                attendanceByLesson={attendanceByLesson}
                onOpen={setSelected}
              />
            </div>
            <div className="fs-mobile-list">
              {count ? (
                <AgendaList lessons={lessons.data} now={now} tones={tones} onOpen={setSelected} />
              ) : (
                <FxEmpty icon={IconCalendar} title="Уроков нет" body="Переключите период стрелками." />
              )}
            </div>
            {!count ? <p className="sx-muted fs-empty-note">В этот период уроков нет.</p> : null}
          </>
        )}
      </section>

      <aside className="fs-side">
        <MonthCalendar month={month} onMonth={setMonth} selected={anchor} onPick={pick} lessonDays={lessonDays} now={now} />
        <NearestLesson lesson={nearest} now={now} onOpen={setSelected} />
        <CourseLegend lessons={monthLessons.data || lessons.data || []} tones={tones} />
      </aside>

      <LessonDialog
        lesson={selected}
        homework={homework.data || []}
        attendance={selected ? attendanceByLesson.get(String(selected.id)) : null}
        now={now}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
