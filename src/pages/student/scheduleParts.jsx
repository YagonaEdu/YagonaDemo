import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { lessonDisplayState } from "@/components/schedule/WeekSchedule";
import { formatDayLong, formatTime, sameDay } from "@/utils/format";
import { IconClock, IconFamily, IconHomework, IconPin, IconTeacher } from "./icons";

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Colour of a lesson in the Figma schedule: past grey, today navy, later teal, cancelled dashed. */
export function lessonTone(lesson, now = Date.now()) {
  const state = lessonDisplayState(lesson, now);
  if (state === "cancelled") return "cancelled";
  if (state === "ongoing") return "ongoing";
  if (state === "completed") return "past";
  return sameDay(lesson.starts_at, now) ? "today" : "upcoming";
}

export const TONE_LABELS = {
  ongoing: "Идёт сейчас",
  today: "Сегодня",
  upcoming: "Запланирован",
  past: "Прошёл",
  cancelled: "Отменён",
};

export const ATTENDANCE_SHORT = {
  present: "✓ Был",
  late: "Опоздал",
  absent: "Пропуск",
  excused: "Уважит.",
};

/** ISO-8601 week number. */
export function weekNumber(date) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
}

/** "Тема · ДЗ: …" topics written by teachers are split into topic and homework note. */
export function splitTopic(topic) {
  const [title, ...rest] = (topic || "").split("·").map((part) => part.trim());
  const note = rest.join(" · ").replace(/^ДЗ:\s*/i, "");
  return { title, note };
}

export function lessonTitle(lesson) {
  return lesson.course_name || lesson.group_name || "Урок";
}

/** Lesson details in a native <dialog> (focus trap and Esc for free). */
export function LessonDialog({ lesson, homework = [], attendance, now = Date.now(), onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (lesson && !dialog.open) dialog.showModal();
    if (!lesson && dialog.open) dialog.close();
  }, [lesson]);

  const tone = lesson ? lessonTone(lesson, now) : "";
  const { title: topic, note } = splitTopic(lesson?.topic);
  const linked = lesson ? homework.filter((item) => String(item.lesson) === String(lesson.id)) : [];

  return (
    <dialog
      ref={ref}
      className="st-dialog st-lesson-dialog"
      aria-labelledby="st-lesson-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      {lesson ? (
        <>
          <header className={`st-lesson-dialog-head is-${tone}`}>
            <span className="st-lesson-dialog-state">{TONE_LABELS[tone]}</span>
            <h2 id="st-lesson-title">{lessonTitle(lesson)}</h2>
            <p>
              {formatDayLong(lesson.starts_at)}, {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
            </p>
          </header>
          <ul className="st-lesson-facts">
            <li>
              <IconFamily size={18} />
              <span>Группа {lesson.group_name || "—"}</span>
            </li>
            <li>
              <IconPin size={18} />
              <span>{lesson.room_name ? `Аудитория ${lesson.room_name}` : "Аудитория не указана"}</span>
            </li>
            <li>
              <IconTeacher size={18} />
              <span>{lesson.teacher_name || "Преподаватель не назначен"}</span>
            </li>
            {attendance ? (
              <li>
                <IconClock size={18} />
                <span>Отметка: {ATTENDANCE_SHORT[attendance.status] || attendance.status}</span>
              </li>
            ) : null}
          </ul>
          {topic ? (
            <section className="st-lesson-topic">
              <span className="st-overline">Тема урока</span>
              <p>{topic}</p>
              {note ? <p className="st-muted">Задание с урока: {note}</p> : null}
            </section>
          ) : null}
          {linked.length ? (
            <section className="st-lesson-topic">
              <span className="st-overline">Домашнее задание</span>
              {linked.map((item) => (
                <Link key={item.id} to={`/student/homework/${item.id}`} className="st-lesson-hw">
                  <IconHomework size={18} />
                  <span>{item.title}</span>
                </Link>
              ))}
            </section>
          ) : null}
          <div className="st-dialog-actions">
            <button type="button" className="y-btn y-btn-primary" onClick={onClose} autoFocus>
              Закрыть
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
