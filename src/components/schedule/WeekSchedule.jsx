import { formatDateTime, t, translated } from "@/i18n";
import { localDayKey, sameDay, shiftDays } from "@/utils/format";

const weekdays = () => t("week.days").split(",");

const STATE_LABELS = translated({
  scheduled: "t:week.scheduled",
  ongoing: "t:week.ongoing",
  completed: "t:week.completed",
  cancelled: "t:week.cancelled",
});

export function lessonDisplayState(lesson, now = Date.now()) {
  if (lesson.status === "cancelled") return "cancelled";
  if (lesson.status === "completed") return "completed";
  if (new Date(lesson.ends_at).getTime() < now) return "completed";
  if (new Date(lesson.starts_at).getTime() <= now) return "ongoing";
  return "scheduled";
}

function time(value) {
  return formatDateTime(value, { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(lessons) {
  const map = new Map();
  for (const lesson of lessons) {
    const key = localDayKey(lesson.starts_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lesson);
  }
  for (const list of map.values()) list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return map;
}

function LessonChip({ lesson, now, renderMeta, onSelect, compact }) {
  const state = lessonDisplayState(lesson, now);
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      type={onSelect ? "button" : undefined}
      className={`ws-lesson is-${state}${compact ? " is-compact" : ""}`}
      onClick={onSelect ? () => onSelect(lesson) : undefined}
    >
      <span className="ws-lesson-time">
        {time(lesson.starts_at)}–{time(lesson.ends_at)}
      </span>
      <strong className="ws-lesson-title">{lesson.course_name || lesson.group_name || t("week.lesson")}</strong>
      <span className="ws-lesson-sub">{lesson.group_name}</span>
      {renderMeta ? <span className="ws-lesson-meta">{renderMeta(lesson)}</span> : null}
      <span className={`y-pill is-${state === "ongoing" ? "scheduled" : state}`}>{STATE_LABELS[state]}</span>
    </Tag>
  );
}

/** Seven-day grid (stacks into a list of days below 900px). */
export function WeekGrid({ weekStart, lessons, now = Date.now(), renderMeta, onSelect }) {
  const byDay = groupByDay(lessons);
  return (
    <div className="ws-grid">
      {weekdays().map((label, index) => {
        const day = shiftDays(weekStart, index);
        const list = byDay.get(localDayKey(day)) || [];
        const isToday = sameDay(day, now);
        return (
          <section key={label} className={`ws-day${isToday ? " is-today" : ""}${list.length ? "" : " is-empty"}`}>
            <header className="ws-day-head">
              <span>{label}</span>
              <strong>{day.getDate()}</strong>
              {isToday ? <em>{t("week.today")}</em> : null}
            </header>
            <div className="ws-day-body">
              {list.length ? (
                list.map((lesson) => (
                  <LessonChip key={lesson.id} lesson={lesson} now={now} renderMeta={renderMeta} onSelect={onSelect} compact />
                ))
              ) : (
                <span className="ws-day-empty">{t("week.noLessons")}</span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Chronological list grouped by day. */
export function LessonList({ lessons, now = Date.now(), renderMeta, onSelect }) {
  const byDay = groupByDay(lessons);
  const keys = [...byDay.keys()].sort();
  return (
    <div className="ws-list">
      {keys.map((key) => {
        const first = byDay.get(key)[0];
        const isToday = sameDay(first.starts_at, now);
        return (
          <section key={key} className={`ws-list-day${isToday ? " is-today" : ""}`}>
            <h3>
              {formatDateTime(first.starts_at, { weekday: "long", day: "numeric", month: "long" })}
              {isToday ? <em>{t("week.today")}</em> : null}
            </h3>
            <div className="ws-list-items">
              {byDay.get(key).map((lesson) => (
                <LessonChip key={lesson.id} lesson={lesson} now={now} renderMeta={renderMeta} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function weekRangeLabel(weekStart) {
  const end = shiftDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startText = formatDateTime(weekStart, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const endText = formatDateTime(end, { day: "numeric", month: "long", year: "numeric" });
  return `${startText} – ${endText}`;
}

const chevron = (d) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function WeekToolbar({ weekStart, onChange, view, onViewChange, thisWeek }) {
  const isCurrent = sameDay(weekStart, thisWeek);
  return (
    <div className="ws-toolbar">
      <div className="ws-nav">
        <button type="button" className="ws-nav-btn" onClick={() => onChange(shiftDays(weekStart, -7))} aria-label={t("week.prevWeek")}>
          {chevron("m14.5 6-6 6 6 6")}
        </button>
        <strong className="ws-range">{weekRangeLabel(weekStart)}</strong>
        <button type="button" className="ws-nav-btn" onClick={() => onChange(shiftDays(weekStart, 7))} aria-label={t("week.nextWeek")}>
          {chevron("m9.5 6 6 6-6 6")}
        </button>
        {!isCurrent ? (
          <button type="button" className="y-btn y-btn-ghost y-btn-sm" onClick={() => onChange(thisWeek)}>
            {t("week.currentWeek")}
          </button>
        ) : null}
      </div>
      {onViewChange ? (
        <div className="ws-tabs" role="tablist" aria-label={t("week.view")}>
          {[
            ["week", t("week.viewWeek")],
            ["list", t("week.viewList")],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`ws-tab${view === key ? " is-active" : ""}`}
              onClick={() => onViewChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
