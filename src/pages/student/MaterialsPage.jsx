import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { listCourses, listMaterials } from "@/services/student";
import { formatDate, mediaUrl } from "@/utils/format";
import { IconFile, IconFolder, IconLink, IconSearch, IconText, IconVideo } from "./icons";
import { CardSkeleton, LoadError, PageTitle } from "./parts";

const TYPES = {
  file: { label: "Файл", icon: IconFile },
  pdf: { label: "PDF", icon: IconFile },
  link: { label: "Ссылка", icon: IconLink },
  video: { label: "Видео", icon: IconVideo },
  text: { label: "Текст", icon: IconText },
};

function MaterialCard({ item, courseName }) {
  const [open, setOpen] = useState(false);
  const type = TYPES[item.material_type] || TYPES.file;
  const Icon = type.icon;
  const href = item.file ? mediaUrl(item.file) : item.link;

  return (
    <article className={`st-mat is-${item.material_type}`}>
      <span className="st-mat-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="st-mat-body">
        <span className="st-mat-kicker">
          {type.label}
          {courseName ? ` · ${courseName}` : ""}
          {item.topic ? ` · ${item.topic}` : ""}
        </span>
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
        <span className="st-mat-date">Добавлено {formatDate(item.created_at)}</span>
        {open && item.text_content ? <div className="st-mat-text">{item.text_content}</div> : null}
      </div>
      <div className="st-mat-action">
        {href ? (
          <a className="y-btn y-btn-secondary y-btn-sm" href={href} target="_blank" rel="noreferrer">
            Открыть
          </a>
        ) : item.material_type === "text" ? (
          <button
            type="button"
            className="y-btn y-btn-secondary y-btn-sm"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Свернуть" : "Читать"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function StudentMaterialsPage() {
  const data = useAsync(() => Promise.all([listMaterials(), listCourses()]));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const [materials, courses] = data.data || [[], []];
  const courseName = useMemo(
    () => new Map(courses.map((row) => [String(row.id), row.name])),
    [courses],
  );
  const types = useMemo(
    () => [...new Set(materials.map((item) => item.material_type))].filter((key) => TYPES[key]),
    [materials],
  );
  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return materials.filter(
      (item) =>
        (!type || item.material_type === type) &&
        (!needle ||
          [item.title, item.description, item.topic].some((text) =>
            String(text || "").toLowerCase().includes(needle),
          )),
    );
  }, [materials, search, type]);

  return (
    <div className="st-page">
      <PageTitle title="Материалы" subtitle="Учебники, ссылки и файлы от ваших преподавателей" />

      {data.loading ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </>
      ) : data.error ? (
        <LoadError error={data.error} onRetry={data.reload} />
      ) : !materials.length ? (
        <div className="st-card">
          <EmptyState
            icon={<IconFolder />}
            title="Материалов пока нет"
            body="Когда преподаватель опубликует материалы для вашей группы, они появятся здесь."
          />
        </div>
      ) : (
        <>
          <div className="st-mat-tools">
            <label className="st-search">
              <IconSearch size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию или теме"
                aria-label="Поиск материалов"
              />
            </label>
            {types.length > 1 ? (
              <div className="st-chips" role="group" aria-label="Тип материала">
                <button type="button" className={`st-chip${!type ? " is-active" : ""}`} onClick={() => setType("")}>
                  Все
                </button>
                {types.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`st-chip${type === key ? " is-active" : ""}`}
                    onClick={() => setType(key)}
                  >
                    {TYPES[key].label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {list.length ? (
            <div className="st-mat-list">
              {list.map((item) => (
                <MaterialCard key={item.id} item={item} courseName={courseName.get(String(item.course))} />
              ))}
            </div>
          ) : (
            <p className="st-muted">Ничего не найдено.</p>
          )}
        </>
      )}
    </div>
  );
}
