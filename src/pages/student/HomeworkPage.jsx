import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { loadHomework } from "@/services/student";
import { formatDate, formatTime, pluralRu, sameDay } from "@/utils/format";
import { IconCheck, IconChevronRight, IconClock, IconHomework, IconStar, IconTimer } from "./icons";
import { LoadError, homeworkState, useCabinetHeader } from "./parts";
import { Badge, CardSkeleton, FxEmpty, Kpi, KpiSkeleton, averageGrade, homeworkStatusBadge } from "./fx";

const TABS = [
  { key: "all", label: "Все", states: null },
  { key: "active", label: "Активные", states: ["todo", "draft", "returned"] },
  { key: "review", label: "На проверке", states: ["submitted", "late"] },
  { key: "graded", label: "Проверено", states: ["graded"] },
  { key: "overdue", label: "Просрочено", states: ["overdue"] },
];

const SORTS = [
  ["due", "по дедлайну"],
  ["new", "сначала новые"],
  ["title", "по названию"],
];

function deadlineText(item, now) {
  if (!item.due_at) return { text: "Без срока", urgent: false };
  const due = new Date(item.due_at);
  if (sameDay(due, now)) return { text: `Сегодня, ${formatTime(due)}`, urgent: true };
  return { text: formatDate(due), urgent: due.getTime() < now };
}

function gradeTone(score, max) {
  if (score == null || !max) return "";
  const ratio = score / max;
  if (ratio >= 0.85) return "is-good";
  if (ratio >= 0.65) return "is-ok";
  return "is-low";
}

export default function StudentHomeworkPage() {
  const navigate = useNavigate();
  const homework = useAsync(loadHomework);
  const [tab, setTab] = useState("all");
  const [course, setCourse] = useState("");
  const [sort, setSort] = useState("due");
  const [now] = useState(() => Date.now());

  const rows = useMemo(
    () => (homework.data || []).map((item) => ({ ...item, state: homeworkState(item, now) })),
    [homework.data, now],
  );
  const count = (states) => (states ? rows.filter((row) => states.includes(row.state)).length : rows.length);
  const active = count(["todo", "draft", "returned"]);
  const review = count(["submitted", "late"]);
  const overdue = count(["overdue"]);
  const dueToday = rows.filter(
    (row) => ["todo", "draft", "returned"].includes(row.state) && row.due_at && sameDay(row.due_at, now),
  ).length;
  const submitted = rows.filter((row) => row.my_submission?.submitted_at);
  const onTime = submitted.filter(
    (row) => !row.due_at || new Date(row.my_submission.submitted_at) <= new Date(row.due_at),
  ).length;
  const onTimePct = submitted.length ? Math.round((onTime / submitted.length) * 100) : null;
  const avg = averageGrade(rows);

  useCabinetHeader(
    "Домашние задания",
    homework.loading
      ? "Задания ваших групп"
      : `${pluralRu(active, ["активное", "активных", "активных"])} · ${review} на проверке`,
  );

  const courses = useMemo(() => {
    const map = new Map();
    for (const row of rows) if (row.course) map.set(String(row.course), row.course_name || row.group_name);
    return [...map.entries()];
  }, [rows]);

  const states = TABS.find((item) => item.key === tab)?.states;
  const visible = rows
    .filter((row) => (!states || states.includes(row.state)) && (!course || String(row.course) === course))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "new") return new Date(b.created_at) - new Date(a.created_at);
      const x = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const y = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      return x - y;
    });

  return (
    <div className="sx-page">
      <div className="sx-kpis">
        {homework.loading ? (
          [0, 1, 2, 3].map((key) => <KpiSkeleton key={key} />)
        ) : (
          <>
            <Kpi
              icon={IconHomework}
              tone="blue"
              label="Активные"
              value={active}
              note={dueToday ? `${dueToday} ${dueToday === 1 ? "сгорает" : "сгорают"} сегодня` : "На сегодня дедлайнов нет"}
            />
            <Kpi
              icon={IconCheck}
              tone="teal"
              label="Сдано вовремя"
              value={onTimePct == null ? "—" : `${onTimePct}%`}
              note={submitted.length ? `${onTime} из ${submitted.length} работ` : "Работ пока нет"}
            />
            <Kpi
              icon={IconStar}
              tone="amber"
              label="Средняя оценка"
              value={avg == null ? "—" : String(avg).replace(".", ",")}
              note={avg == null ? "Оценок пока нет" : "из 10 баллов"}
            />
            <Kpi
              icon={IconTimer}
              tone="red"
              label="Просрочено"
              value={overdue}
              note={overdue ? "Сдайте как можно скорее" : "Просрочек нет"}
              tag={overdue ? "Важно" : null}
              tagTone="red"
            />
          </>
        )}
      </div>

      <div className="fh-toolbar">
        <div className="sx-tabs" role="tablist" aria-label="Статус заданий">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`sx-tab${tab === item.key ? " is-active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label} · {count(item.states)}
            </button>
          ))}
        </div>
        <div className="fh-filters">
          <label className="fh-select">
            <span>Курс:</span>
            <select value={course} onChange={(event) => setCourse(event.target.value)}>
              <option value="">Все</option>
              {courses.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="fh-select">
            <span>Сортировка:</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {homework.loading ? (
        <CardSkeleton lines={6} />
      ) : homework.error ? (
        <LoadError error={homework.error} onRetry={homework.reload} />
      ) : visible.length ? (
        <section className="sx-card sx-table-card">
          <div className="sx-table-wrap">
            <table className="sx-table fh-table">
              <thead>
                <tr>
                  <th>Задание</th>
                  <th>Дедлайн</th>
                  <th>Статус</th>
                  <th>Оценка</th>
                  <th aria-label="Открыть" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const badge = homeworkStatusBadge(row, now);
                  const deadline = deadlineText(row, now);
                  const sub = row.my_submission;
                  const graded = row.state === "graded" && sub?.score != null;
                  return (
                    <tr
                      key={row.id}
                      className="is-link"
                      tabIndex={0}
                      onClick={() => navigate(`/student/homework/${row.id}`)}
                      onKeyDown={(event) => event.key === "Enter" && navigate(`/student/homework/${row.id}`)}
                    >
                      <td>
                        <span className="sx-cell-title">
                          <strong>{row.title}</strong>
                          <span>{[row.course_name, row.group_name].filter(Boolean).join(" · ")}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`fh-deadline${deadline.urgent && !["graded", "submitted", "late"].includes(row.state) ? " is-urgent" : ""}`}>
                          <IconClock size={16} />
                          {deadline.text}
                        </span>
                      </td>
                      <td>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td>
                        {graded ? (
                          <span className={`fh-grade ${gradeTone(sub.score, row.max_score)}`}>
                            {sub.score}
                            {row.max_score ? ` / ${row.max_score}` : ""}
                          </span>
                        ) : (
                          <span className="fh-grade is-empty">—</span>
                        )}
                      </td>
                      <td className="fh-chevron">
                        <IconChevronRight size={18} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="sx-card">
          <FxEmpty
            icon={IconHomework}
            title={tab === "active" ? "Все задания выполнены" : "Здесь пока пусто"}
            body="Новые задания от преподавателя появятся в этом списке."
          />
        </section>
      )}
    </div>
  );
}
