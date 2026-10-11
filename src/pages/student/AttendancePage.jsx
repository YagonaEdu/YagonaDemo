import { useMemo, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { listAttendance, listLessons, loadHomework } from "@/services/student";
import { formatDate, formatDayShort, formatTime, shiftDays } from "@/utils/format";
import { IconCheck, IconStar } from "./icons";
import { ATTENDANCE_LABELS, LoadError, attendanceStats, useCabinetHeader } from "./parts";
import { Badge, CardSkeleton, FxEmpty } from "./fx";

/* Status colours (validated: teal / amber / red; amber always paired with a text label). */
const STATUS_TONE = { present: "teal", late: "amber", absent: "red", excused: "violet" };
const PERIODS = [
  ["all", "Семестр"],
  ["month", "Месяц"],
];
const MONTH_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function monthKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function loadGrades() {
  const today = new Date();
  const [attendance, homework, lessons] = await Promise.all([
    listAttendance(),
    loadHomework(),
    listLessons(shiftDays(today, -180), shiftDays(today, 1)),
  ]);
  return { attendance, homework, lessons };
}

/* Donut split by status (Figma 34:249). */
function AttendanceDonut({ stats, size = 170, stroke = 22 }) {
  const parts = [
    ["present", stats.present, "var(--fx-teal)"],
    ["late", stats.late, "var(--fx-amber-bar)"],
    ["absent", stats.absent, "var(--fx-red)"],
  ].filter(([, value]) => value > 0);
  const total = parts.reduce((sum, [, value]) => sum + value, 0);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const gap = total > 1 ? 4 : 0;
  let offset = 0;
  return (
    <div className="sx-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Посещаемость ${stats.rate ?? 0}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#edf0f6" strokeWidth={stroke} />
        {parts.map(([key, value, color]) => {
          const segment = (value / total) * length;
          const dash = Math.max(segment - gap, 0.1);
          const node = (
            <circle
              key={key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${length - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${ATTENDANCE_LABELS[key]}: ${value}`}</title>
            </circle>
          );
          offset += segment;
          return node;
        })}
      </svg>
      <div className="sx-ring-label">
        <strong>{stats.rate == null ? "—" : `${stats.rate}%`}</strong>
        <span>посещаемость</span>
      </div>
    </div>
  );
}

/* One square per lesson mark, oldest → newest (Figma heat grid). */
function AttendanceGrid({ rows }) {
  const ordered = [...rows].sort((a, b) => new Date(a.lesson_starts_at) - new Date(b.lesson_starts_at)).slice(-60);
  return (
    <div className="fg-heat" role="list" aria-label="Отметки по урокам">
      {ordered.map((row) => {
        const cancelled = row.lesson_status === "cancelled";
        const label = cancelled ? "Урок отменён" : ATTENDANCE_LABELS[row.status];
        return (
          <span
            key={row.id}
            role="listitem"
            className={`fg-cell is-${cancelled ? "none" : row.status}`}
            title={`${formatDayShort(row.lesson_starts_at)} · ${row.course_name || ""} · ${label}`}
            aria-label={`${formatDayShort(row.lesson_starts_at)}: ${label}`}
          />
        );
      })}
    </div>
  );
}

/* Line of my homework grades on a 10-point scale (single series → no legend box). */
function ScoreChart({ points }) {
  const [hover, setHover] = useState(null);
  const width = 560;
  const height = 220;
  const pad = { top: 14, right: 16, bottom: 30, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value) => pad.top + innerH - (value / 10) * innerH;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${path} L${x(points.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z` : "";
  const ticks = [0, 5, 10];

  return (
    <div className="fg-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика оценок за задания" onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="fg-grid-line" />
            <text x={pad.left - 8} y={y(tick) + 4} className="fg-axis" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {area ? <path d={area} className="fg-area" /> : null}
        <path d={path} className="fg-line" />
        {points.map((point, index) => (
          <g key={point.id}>
            <circle cx={x(index)} cy={y(point.value)} r={hover === index ? 6 : 4.5} className="fg-dot" />
            <rect
              x={x(index) - Math.max(innerW / points.length / 2, 10)}
              y={pad.top}
              width={Math.max(innerW / points.length, 20)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
              aria-label={`${point.title}: ${point.label}`}
            />
            {points.length <= 8 || index % Math.ceil(points.length / 8) === 0 ? (
              <text x={x(index)} y={height - 8} className="fg-axis" textAnchor="middle">
                {point.short}
              </text>
            ) : null}
          </g>
        ))}
        {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="fg-cross" /> : null}
      </svg>
      {hover != null ? (
        <div
          className="fg-tip"
          style={{ left: `${(x(hover) / width) * 100}%`, top: `${(y(points[hover].value) / height) * 100}%` }}
        >
          <strong>{points[hover].label}</strong>
          <span>{points[hover].title}</span>
          <span>{points[hover].date}</span>
        </div>
      ) : null}
    </div>
  );
}

function gradeChipTone(value) {
  if (value >= 8.5) return "is-good";
  if (value >= 6.5) return "is-ok";
  return "is-low";
}

export default function StudentGradesPage() {
  const data = useAsync(loadGrades);
  const [period, setPeriod] = useState("all");
  const [course, setCourse] = useState("");
  const [month, setMonth] = useState("");
  const [now] = useState(() => Date.now());

  useCabinetHeader("Оценки и посещаемость", "Посещаемость уроков и оценки за задания");

  const attendance = useMemo(() => data.data?.attendance || [], [data.data]);
  const periodRows = useMemo(
    () => (period === "month" ? attendance.filter((row) => new Date(row.lesson_starts_at).getTime() > now - 30 * 86400000) : attendance),
    [attendance, period, now],
  );
  const stats = attendanceStats(periodRows);

  const graded = useMemo(
    () =>
      (data.data?.homework || [])
        .filter((item) => item.my_submission?.status === "graded" && item.my_submission.score != null && item.max_score)
        .map((item) => ({
          ...item,
          value: Math.round((item.my_submission.score / item.max_score) * 100) / 10,
          gradedAt: item.my_submission.graded_at || item.my_submission.submitted_at || item.due_at,
        }))
        .sort((a, b) => new Date(a.gradedAt) - new Date(b.gradedAt)),
    [data.data],
  );
  const points = graded.map((item) => {
    const d = new Date(item.gradedAt);
    return {
      id: item.id,
      value: item.value,
      label: `${item.my_submission.score} из ${item.max_score}`,
      title: item.title,
      date: formatDate(item.gradedAt),
      short: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
    };
  });

  const teacherByCourse = useMemo(() => {
    const map = new Map();
    for (const lesson of data.data?.lessons || []) {
      if (lesson.course && lesson.teacher_name && !map.has(String(lesson.course))) map.set(String(lesson.course), lesson.teacher_name);
    }
    return map;
  }, [data.data]);

  const subjects = useMemo(() => {
    const map = new Map();
    for (const item of graded) {
      const key = String(item.course || item.group);
      if (!map.has(key)) map.set(key, { key, name: item.course_name || item.group_name, values: [] });
      map.get(key).values.push(item.value);
    }
    return [...map.values()].map((entry) => ({
      ...entry,
      avg: Math.round((entry.values.reduce((sum, v) => sum + v, 0) / entry.values.length) * 10) / 10,
      recent: entry.values.slice(-5),
    }));
  }, [graded]);

  const options = useMemo(() => {
    const courses = new Map();
    const months = new Map();
    for (const row of attendance) {
      if (row.course) courses.set(String(row.course), row.course_name);
      const key = monthKey(row.lesson_starts_at);
      if (!months.has(key)) {
        const d = new Date(row.lesson_starts_at);
        months.set(key, d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }));
      }
    }
    return { courses: [...courses.entries()], months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
  }, [attendance]);
  const history = attendance
    .filter((row) => (!course || String(row.course) === course) && (!month || monthKey(row.lesson_starts_at) === month))
    .sort((a, b) => new Date(b.lesson_starts_at) - new Date(a.lesson_starts_at));

  if (data.loading) {
    return (
      <div className="sx-page">
        <div className="fg-top">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    );
  }
  if (data.error) return <LoadError error={data.error} onRetry={data.reload} />;

  return (
    <div className="sx-page">
      <div className="fg-top">
        <section className="sx-card">
          <div className="sx-card-head">
            <h2>Посещаемость</h2>
            <div className="sx-tabs" role="tablist" aria-label="Период">
              {PERIODS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={period === key}
                  className={`sx-tab${period === key ? " is-active" : ""}`}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {periodRows.length ? (
            <>
              <div className="fg-att">
                <AttendanceDonut stats={stats} />
                <AttendanceGrid rows={periodRows} />
              </div>
              <ul className="fg-legend">
                <li className="is-present">Был · {stats.present}</li>
                <li className="is-late">Опоздал · {stats.late}</li>
                <li className="is-absent">Пропустил · {stats.absent}</li>
                {stats.excused ? <li className="is-excused">Уважительная · {stats.excused}</li> : null}
                <li className="is-none">Урок отменён</li>
              </ul>
            </>
          ) : (
            <FxEmpty icon={IconCheck} title="Отметок пока нет" body="После первого урока здесь появится посещаемость." />
          )}
        </section>

        <section className="sx-card">
          <div className="sx-card-head">
            <h2>Динамика оценок</h2>
            {points.length ? <span className="sx-muted">по 10-балльной шкале</span> : null}
          </div>
          {points.length ? (
            <ScoreChart points={points} />
          ) : (
            <FxEmpty icon={IconStar} title="Оценок пока нет" body="Когда преподаватель проверит задания, здесь появится график." />
          )}
        </section>
      </div>

      <section className="sx-card sx-table-card">
        <div className="sx-card-head">
          <h2>Оценки по предметам</h2>
        </div>
        {subjects.length ? (
          <div className="sx-table-wrap">
            <table className="sx-table">
              <thead>
                <tr>
                  <th>Предмет</th>
                  <th>Учитель</th>
                  <th>Последние оценки</th>
                  <th>Среднее</th>
                  <th>Прогресс</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      <strong>{entry.name}</strong>
                    </td>
                    <td>{teacherByCourse.get(entry.key) || "—"}</td>
                    <td>
                      <span className="fg-chips">
                        {entry.recent.map((value, index) => (
                          <span key={index} className={`fg-chip ${gradeChipTone(value)}`}>
                            {String(value).replace(".", ",")}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      <strong>{String(entry.avg).replace(".", ",")}</strong>
                    </td>
                    <td className="fg-progress-cell">
                      <div className="sx-bar">
                        <span style={{ width: `${entry.avg * 10}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FxEmpty icon={IconStar} title="Оценок по предметам пока нет" />
        )}
      </section>

      <section className="sx-card sx-table-card">
        <div className="sx-card-head fg-history-head">
          <h2>История посещаемости</h2>
          <div className="fh-filters">
            <label className="fh-select">
              <span>Курс:</span>
              <select value={course} onChange={(event) => setCourse(event.target.value)}>
                <option value="">Все</option>
                {options.courses.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fh-select">
              <span>Месяц:</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="">Все</option>
                {options.months.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {history.length ? (
          <div className="sx-table-wrap">
            <table className="sx-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Урок</th>
                  <th>Тема</th>
                  <th>Отметка</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => {
                  const cancelled = row.lesson_status === "cancelled";
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="sx-cell-title">
                          <strong>{formatDayShort(row.lesson_starts_at)}</strong>
                          <span>{formatTime(row.lesson_starts_at)}</span>
                        </span>
                      </td>
                      <td>
                        <span className="sx-cell-title">
                          <strong>{row.course_name}</strong>
                          <span>{row.group_name}</span>
                        </span>
                      </td>
                      <td>{row.lesson_topic || row.comment || "—"}</td>
                      <td>
                        {cancelled ? (
                          <Badge tone="grey">Урок отменён</Badge>
                        ) : (
                          <Badge tone={STATUS_TONE[row.status] || "grey"}>{ATTENDANCE_LABELS[row.status]}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <FxEmpty icon={IconCheck} title="По выбранным фильтрам отметок нет" />
        )}
      </section>
    </div>
  );
}
