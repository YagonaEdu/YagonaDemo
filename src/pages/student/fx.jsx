/* Building blocks of the Figma «Кабинет студента» frames (styles: student-figma.css). */
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui";
import { lessonDisplayState } from "@/components/schedule/WeekSchedule";
import { pluralRu, sameDay } from "@/utils/format";
import { homeworkState } from "./parts";

/** Each course keeps one colour everywhere (lesson bars, schedule blocks, legends). */
export const COURSE_TONES = ["blue", "teal", "violet", "red", "amber"];

export function courseToneMap(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = String(item.course ?? item.id ?? "");
    if (key && !map.has(key)) map.set(key, COURSE_TONES[map.size % COURSE_TONES.length]);
  }
  return map;
}

export function Kpi({ icon: Icon, tone = "teal", label, value, note, tag, tagTone = "teal", to }) {
  const body = (
    <>
      <span className="sx-kpi-icon">
        <Icon size={22} />
      </span>
      {tag ? <span className={`sx-badge is-plain is-${tagTone} sx-kpi-tag`}>{tag}</span> : null}
      <span className="sx-kpi-label">{label}</span>
      <strong className="sx-kpi-value">{value ?? "—"}</strong>
      {note ? <span className="sx-kpi-note">{note}</span> : null}
    </>
  );
  return to ? (
    <Link to={to} className={`sx-kpi is-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`sx-kpi is-${tone}`}>{body}</div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="sx-kpi" aria-busy="true">
      <Skeleton width={44} height={44} radius={12} />
      <Skeleton width="50%" height={14} />
      <Skeleton width="40%" height={28} />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="sx-card" aria-busy="true">
      <Skeleton width="40%" height={18} />
      <Skeleton lines={lines} height={16} />
    </div>
  );
}

export function FxRing({ value, max, size = 140, stroke = 16, color = "var(--fx-blue)", track = "#edf0f6", children }) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="sx-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - ratio)}
          strokeLinecap="round"
        />
      </svg>
      <div className="sx-ring-label">{children}</div>
    </div>
  );
}

export function FxEmpty({ icon: Icon, title, body, action }) {
  return (
    <div className="sx-empty">
      {Icon ? (
        <span className="sx-empty-icon">
          <Icon size={24} />
        </span>
      ) : null}
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

/** Lesson status chip used in «Уроки сегодня» and the schedule side card. */
export function lessonBadge(lesson, now = Date.now()) {
  const state = lessonDisplayState(lesson, now);
  if (state === "cancelled") return { tone: "red", label: "Отменён" };
  if (state === "ongoing") return { tone: "teal", label: "Идёт сейчас" };
  if (state === "completed") return { tone: "grey", label: "Прошёл" };
  const minutes = Math.round((new Date(lesson.starts_at).getTime() - now) / 60000);
  if (minutes <= 30) return { tone: "teal", label: "Скоро" };
  if (minutes < 60 * 24 && sameDay(lesson.starts_at, now)) {
    return { tone: "blue", label: minutes < 60 ? `Через ${minutes} мин` : `Через ${Math.floor(minutes / 60)} ч` };
  }
  const days = Math.ceil(minutes / 1440);
  return { tone: "blue", label: days <= 1 ? "Завтра" : `Через ${pluralRu(days, ["день", "дня", "дней"])}` };
}

const HW_TONE = {
  todo: "red",
  draft: "amber",
  returned: "amber",
  overdue: "red",
  submitted: "navy",
  late: "navy",
  graded: "teal",
};

export const HW_STATUS_LABEL = {
  todo: "Не сдано",
  draft: "В работе",
  returned: "На доработке",
  overdue: "Просрочено",
  submitted: "На проверке",
  late: "На проверке",
  graded: "Проверено",
};

/** Status chip for the homework table (Figma 20:886). */
export function homeworkStatusBadge(item, now = Date.now()) {
  const state = homeworkState(item, now);
  return { state, tone: HW_TONE[state], label: HW_STATUS_LABEL[state] };
}

/** Deadline chip for the home widget: «Сегодня», «2 дня», «Просрочено». */
export function deadlineBadge(item, now = Date.now()) {
  if (!item.due_at) return { tone: "grey", label: "Без срока" };
  const diff = new Date(item.due_at).getTime() - now;
  if (diff < 0) return { tone: "red", label: "Просрочено" };
  if (sameDay(item.due_at, now)) return { tone: "red", label: "Сегодня" };
  const days = Math.ceil(diff / 86400000);
  return { tone: days <= 2 ? "amber" : "teal", label: pluralRu(days, ["день", "дня", "дней"]) };
}

export function Badge({ tone = "grey", children, plain = false }) {
  return <span className={`sx-badge is-${tone}${plain ? " is-plain" : ""}`}>{children}</span>;
}

/** Average grade on a 10-point scale (homework max scores differ). */
export function averageGrade(homework) {
  const graded = (homework || []).filter(
    (item) => item.my_submission?.status === "graded" && item.my_submission.score != null && item.max_score,
  );
  if (!graded.length) return null;
  const sum = graded.reduce((acc, item) => acc + (item.my_submission.score / item.max_score) * 10, 0);
  return Math.round((sum / graded.length) * 10) / 10;
}

export function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
