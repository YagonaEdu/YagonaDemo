import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { listCourses, listGroups, listLessons, listMaterials } from "@/services/student";
import { formatDate, formatTime, mediaUrl, pluralRu, sameDay } from "@/utils/format";
import { IconClock, IconCourses, IconFile, IconFolder, IconLink, IconText, IconVideo } from "./icons";
import { LoadError, useCabinetHeader } from "./parts";
import { Badge, CardSkeleton, FxEmpty, courseToneMap, initialsOf } from "./fx";

const TYPE = {
  file: { label: "Файл", tone: "blue", icon: IconFile, iconTone: "blue" },
  pdf: { label: "PDF", tone: "red", icon: IconFile, iconTone: "red" },
  link: { label: "Ссылка", tone: "teal", icon: IconLink, iconTone: "teal" },
  video: { label: "Видео", tone: "blue", icon: IconVideo, iconTone: "blue" },
  text: { label: "Текст", tone: "violet", icon: IconText, iconTone: "violet" },
};

const TABS = [
  ["active", "Активные"],
  ["finished", "Завершённые"],
];

async function loadCourses() {
  const [groups, courses, materials] = await Promise.all([listGroups(), listCourses(), listMaterials()]);
  // One request for the whole span of my groups gives progress and the next lesson per course.
  const starts = groups.map((g) => g.start_date).filter(Boolean).sort();
  const ends = groups.map((g) => g.end_date).filter(Boolean).sort();
  const from = starts[0] ? new Date(`${starts[0]}T00:00:00`) : new Date(Date.now() - 90 * 86400000);
  const to = ends.length ? new Date(`${ends[ends.length - 1]}T23:59:59`) : new Date(Date.now() + 90 * 86400000);
  const lessons = await listLessons(from, to);
  return { groups, courses, materials, lessons };
}

function CourseCard({ group, course, lessons, tone, now, active, onSelect }) {
  const own = lessons.filter((lesson) => String(lesson.group) === String(group.id) && lesson.status !== "cancelled");
  const passed = own.filter((lesson) => new Date(lesson.ends_at).getTime() < now).length;
  const pct = own.length ? Math.round((passed / own.length) * 100) : 0;
  const next = own.find((lesson) => new Date(lesson.ends_at).getTime() > now);
  const teacher = own.find((lesson) => lesson.teacher_name)?.teacher_name;

  return (
    <article className={`fc-card is-${tone}${active ? " is-active" : ""}`}>
      <header className="fc-card-band">
        <Badge tone="grey" plain>
          {group.name}
        </Badge>
        <h3>{course?.name || "Курс"}</h3>
      </header>
      <div className="fc-card-body">
        <div className="fc-teacher">
          <span className="fc-teacher-av">{initialsOf(teacher || course?.name)}</span>
          <span>
            <strong>{teacher || "Преподаватель не назначен"}</strong>
            <small>Преподаватель</small>
          </span>
        </div>
        <div className="fc-progress">
          <span>
            Прогресс · {passed} из {pluralRu(own.length, ["урока", "уроков", "уроков"])}
            <b>{pct}%</b>
          </span>
          <div className={`sx-bar is-${tone === "blue" ? "" : tone}`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="fc-card-foot">
          <span className="fc-next">
            <IconClock size={16} />
            {next
              ? `${sameDay(next.starts_at, now) ? "Сегодня" : formatDate(next.starts_at).slice(0, 5)} ${formatTime(next.starts_at)}`
              : "Уроков не запланировано"}
          </span>
          <button type="button" className="sx-btn sx-btn-soft sx-btn-sm" onClick={onSelect} aria-pressed={active}>
            {active ? "Открыто" : "Материалы"}
          </button>
        </div>
      </div>
    </article>
  );
}

function MaterialsTable({ materials, courseName }) {
  return (
    <section className="sx-card sx-table-card">
      <div className="sx-card-head">
        <h2>Материалы курса{courseName ? ` · ${courseName}` : ""}</h2>
        <Link to="/student/materials" className="sx-link">
          Все материалы →
        </Link>
      </div>
      {materials.length ? (
        <div className="sx-table-wrap">
          <table className="sx-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th>Тема</th>
                <th>Тип</th>
                <th>Добавлен</th>
                <th aria-label="Открыть" />
              </tr>
            </thead>
            <tbody>
              {materials.map((item) => {
                const type = TYPE[item.material_type] || TYPE.file;
                const Icon = type.icon;
                const href = item.file ? mediaUrl(item.file) : item.link;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="fc-mat">
                        <span className={`sx-row-icon is-${type.iconTone}`}>
                          <Icon size={18} />
                        </span>
                        <span className="sx-cell-title">
                          <strong>{item.title}</strong>
                          {item.description ? <span>{item.description}</span> : null}
                        </span>
                      </div>
                    </td>
                    <td>{item.topic || "—"}</td>
                    <td>
                      <Badge tone={type.tone} plain>
                        {type.label}
                      </Badge>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td className="fc-mat-action">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="sx-link">
                          Открыть
                        </a>
                      ) : (
                        <Link to="/student/materials" className="sx-link">
                          Читать
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <FxEmpty icon={IconFolder} title="Материалов пока нет" body="Когда преподаватель опубликует материалы, они появятся здесь." />
      )}
    </section>
  );
}

export default function StudentCoursesPage() {
  const data = useAsync(loadCourses);
  const [tab, setTab] = useState("active");
  const [selected, setSelected] = useState("");
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => data.data?.groups || [], [data.data]);
  const courseById = useMemo(() => new Map((data.data?.courses || []).map((c) => [String(c.id), c])), [data.data]);
  const tones = useMemo(() => courseToneMap(data.data?.lessons || groups), [data.data, groups]);
  const finished = (group) => group.status !== "active" || (group.end_date && new Date(`${group.end_date}T23:59:59`).getTime() < now);
  const visible = groups.filter((group) => (tab === "active" ? !finished(group) : finished(group)));
  const activeCount = groups.filter((group) => !finished(group)).length;

  useCabinetHeader("Мои курсы", data.loading ? "Курсы и материалы" : pluralRu(activeCount, ["активный курс", "активных курса", "активных курсов"]));

  const current = groups.find((group) => String(group.id) === selected) || visible[0] || null;
  const materials = (data.data?.materials || []).filter(
    (item) =>
      !current ||
      String(item.group) === String(current.id) ||
      (!item.group && String(item.course) === String(current.course)),
  );

  if (data.loading) {
    return (
      <div className="sx-page">
        <div className="fc-grid">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    );
  }
  if (data.error) return <LoadError error={data.error} onRetry={data.reload} />;

  return (
    <div className="sx-page">
      <div className="sx-tabs" role="tablist" aria-label="Курсы">
        {TABS.map(([key, label]) => {
          const n = groups.filter((group) => (key === "active" ? !finished(group) : finished(group))).length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`sx-tab${tab === key ? " is-active" : ""}`}
              onClick={() => {
                setTab(key);
                setSelected("");
              }}
            >
              {label} · {n}
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <div className="fc-grid">
          {visible.map((group) => (
            <CourseCard
              key={group.id}
              group={group}
              course={courseById.get(String(group.course))}
              lessons={data.data.lessons}
              tone={tones.get(String(group.course)) || "blue"}
              now={now}
              active={current && String(current.id) === String(group.id)}
              onSelect={() => setSelected(String(group.id))}
            />
          ))}
        </div>
      ) : (
        <section className="sx-card">
          <FxEmpty
            icon={IconCourses}
            title={tab === "active" ? "Активных курсов нет" : "Завершённых курсов нет"}
            body="Курсы появятся, когда администратор запишет вас в группу."
          />
        </section>
      )}

      <MaterialsTable materials={materials} courseName={current ? courseById.get(String(current.course))?.name : ""} />
    </div>
  );
}
