import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/student";
import { formatWhen, pluralRu, sameDay, shiftDays, startOfWeek } from "@/utils/format";
import {
  IconAlert,
  IconBell,
  IconCalendar,
  IconCards,
  IconCheck,
  IconChevronRight,
  IconFolder,
  IconHomework,
  IconSearch,
  IconWallet,
} from "./icons";
import { LoadError, NOTIFICATION_CATEGORY_LABELS, relativeTime, useCabinetHeader, useStudentCabinet } from "./parts";
import { Badge, CardSkeleton, FxEmpty, Kpi } from "./fx";

const PAGE = 30;

/* Where a notification leads and how it looks. `route` comes from the backend metadata. */
const KINDS = {
  homework: { label: "Домашнее задание", icon: IconHomework, tone: "violet", to: (id) => (id ? `/student/homework/${id}` : "/student/homework") },
  vocab: { label: "Словарь", icon: IconCards, tone: "teal", to: () => "/student/vocab" },
  materials: { label: "Материалы", icon: IconFolder, tone: "blue", to: () => "/student/materials" },
  payment: { label: "Оплата", icon: IconWallet, tone: "amber", to: () => "/student/payments" },
  schedule: { label: "Расписание", icon: IconCalendar, tone: "blue", to: () => "/student/schedule" },
  attendance: { label: "Посещаемость", icon: IconCheck, tone: "teal", to: () => "/student/grades" },
  announcement: { label: "Объявление", icon: IconBell, tone: "navy", to: null },
  system: { label: "Система", icon: IconBell, tone: "grey", to: null },
};

function kindOf(item) {
  const route = item.data?.route;
  return KINDS[route] || KINDS[item.category] || { label: NOTIFICATION_CATEGORY_LABELS[item.category] || "Уведомление", icon: IconBell, tone: "navy", to: null };
}

function isImportant(item) {
  return item.priority === "important" || item.priority === "critical";
}

function bucketOf(value, now) {
  const date = new Date(value);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (sameDay(date, today)) return "today";
  if (sameDay(date, shiftDays(today, -1))) return "yesterday";
  if (date >= startOfWeek(today)) return "week";
  return "earlier";
}

const BUCKETS = [
  ["today", "Сегодня"],
  ["yesterday", "Вчера"],
  ["week", "На этой неделе"],
  ["earlier", "Ранее"],
];

function NoteRow({ item, now, open, onToggle, onRead }) {
  const kind = kindOf(item);
  const Icon = kind.icon;
  const target = kind.to ? kind.to(item.data?.entity_id) : null;
  const important = isImportant(item);
  const compact = item.read && !open;

  return (
    <li className={`fn-item${item.read ? "" : " is-unread"}${important ? ` is-${item.priority}` : ""}${compact && target ? " has-go" : ""}`}>
      <button type="button" className="fn-main" aria-expanded={open} onClick={() => onToggle(item)}>
        <span className={`fn-icon is-${kind.tone}`}>
          <Icon size={20} />
        </span>
        <span className="fn-body">
          <span className="fn-top">
            <span className="fn-kind">{kind.label}</span>
            {important ? (
              <Badge tone={item.priority === "critical" ? "red" : "amber"}>{item.priority === "critical" ? "Срочно" : "Важно"}</Badge>
            ) : null}
            <time dateTime={item.created_at} title={formatWhen(item.created_at)}>
              {relativeTime(item.created_at, now)}
            </time>
          </span>
          <strong className="fn-title">{item.title}</strong>
          <span className={`fn-msg${open ? " is-open" : ""}`}>{item.message}</span>
        </span>
        {item.read ? null : <span className="fn-dot" aria-label="Не прочитано" />}
      </button>
      {compact && target ? (
        <Link to={target} className="fn-go" aria-label={`Открыть: ${item.title}`}>
          <IconChevronRight size={18} />
        </Link>
      ) : null}
      {!compact && (target || !item.read) ? (
        <div className="fn-actions">
          {target ? (
            <Link to={target} className="sx-btn sx-btn-soft sx-btn-sm" onClick={() => !item.read && onRead(item)}>
              Открыть
              <IconChevronRight size={16} />
            </Link>
          ) : null}
          {!item.read ? (
            <button type="button" className="sx-btn sx-btn-outline sx-btn-sm" onClick={() => onRead(item)}>
              <IconCheck size={16} />
              Прочитано
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function StudentNotificationsPage() {
  const { refreshUnread } = useStudentCabinet();
  const data = useAsync(() => listNotifications());
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (data.data) setItems(data.data);
  }, [data.data]);

  const unread = items.filter((item) => !item.read).length;
  const important = items.filter(isImportant).length;
  const weekCount = items.filter((item) => new Date(item.created_at).getTime() > now - 7 * 86400000).length;

  useCabinetHeader(
    "Уведомления",
    data.loading ? "Сообщения учебного центра" : unread ? pluralRu(unread, ["непрочитанное", "непрочитанных", "непрочитанных"]) : "Всё прочитано",
  );

  const kinds = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const kind = kindOf(item);
      map.set(kind.label, (map.get(kind.label) || 0) + 1);
    }
    return [...map.entries()];
  }, [items]);

  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      (tab === "all" || (tab === "unread" ? !item.read : isImportant(item))) &&
      (!category || kindOf(item).label === category) &&
      (!needle || `${item.title} ${item.message}`.toLowerCase().includes(needle)),
  );
  const shown = filtered.slice(0, limit);
  const groups = BUCKETS.map(([key, label]) => [label, shown.filter((item) => bucketOf(item.created_at, now) === key)]).filter(
    ([, list]) => list.length,
  );

  async function markRead(item) {
    if (item.read) return;
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    try {
      await markNotificationRead(item.id);
      refreshUnread();
    } catch {
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: false } : row)));
      showToast("Не удалось отметить как прочитанное", "error");
    }
  }

  function toggle(item) {
    setOpenId((value) => (value === item.id ? "" : item.id));
    markRead(item);
  }

  async function readAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((row) => ({ ...row, read: true })));
      refreshUnread();
      showToast("Все уведомления прочитаны");
    } catch (error) {
      showToast(error.message || "Не удалось отметить", "error");
    } finally {
      setBusy(false);
    }
  }

  function resetFilters() {
    setTab("all");
    setCategory("");
    setQuery("");
  }

  if (data.loading) {
    return (
      <div className="sx-page">
        <div className="fn-kpis">
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
        <CardSkeleton lines={6} />
      </div>
    );
  }
  if (data.error) return <LoadError error={data.error} onRetry={data.reload} />;

  if (!items.length) {
    return (
      <section className="sx-card">
        <FxEmpty
          icon={IconBell}
          title="Уведомлений пока нет"
          body="Здесь появятся объявления центра, новые задания, оценки, напоминания об оплате и изменения в расписании."
        />
      </section>
    );
  }

  const filtersOn = tab !== "all" || category || needle;

  return (
    <div className="sx-page">
      <div className="fn-kpis">
        <Kpi icon={IconBell} tone="blue" label="Непрочитанные" value={unread} note={unread ? "Нажмите на уведомление, чтобы прочитать" : "Вы всё прочитали"} />
        <Kpi icon={IconAlert} tone="amber" label="Важные" value={important} note={important ? "Требуют внимания" : "Важных нет"} />
        <Kpi icon={IconCalendar} tone="teal" label="За неделю" value={weekCount} note={`Всего ${pluralRu(items.length, ["уведомление", "уведомления", "уведомлений"])}`} />
      </div>

      <section className="sx-card fn-card">
        <div className="fn-toolbar">
          <div className="sx-tabs" role="tablist" aria-label="Фильтр уведомлений">
            {[
              ["all", "Все", items.length],
              ["unread", "Непрочитанные", unread],
              ["important", "Важные", important],
            ].map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`sx-tab${tab === key ? " is-active" : ""}`}
                onClick={() => {
                  setTab(key);
                  setLimit(PAGE);
                }}
              >
                {label} · {n}
              </button>
            ))}
          </div>
          <div className="fn-tools">
            <label className="fn-search">
              <IconSearch size={16} />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Поиск по уведомлениям"
                aria-label="Поиск по уведомлениям"
              />
            </label>
            <button type="button" className="sx-btn sx-btn-primary sx-btn-sm" onClick={readAll} disabled={busy || !unread}>
              <IconCheck size={16} />
              Прочитать все
            </button>
          </div>
        </div>

        {kinds.length > 1 ? (
          <div className="fn-chips" role="group" aria-label="Тип уведомления">
            <button type="button" className={`fn-chip${!category ? " is-active" : ""}`} onClick={() => setCategory("")}>
              Все типы
            </button>
            {kinds.map(([label, n]) => (
              <button
                key={label}
                type="button"
                className={`fn-chip${category === label ? " is-active" : ""}`}
                onClick={() => {
                  setCategory(category === label ? "" : label);
                  setLimit(PAGE);
                }}
              >
                {label} <span>{n}</span>
              </button>
            ))}
          </div>
        ) : null}

        {groups.length ? (
          <div className="fn-groups">
            {groups.map(([label, list]) => (
              <section key={label} className="fn-group">
                <h3>{label}</h3>
                <ul className="fn-list">
                  {list.map((item) => (
                    <NoteRow key={item.id} item={item} now={now} open={openId === item.id} onToggle={toggle} onRead={markRead} />
                  ))}
                </ul>
              </section>
            ))}
            {filtered.length > shown.length ? (
              <button type="button" className="sx-btn sx-btn-outline fn-more" onClick={() => setLimit((value) => value + PAGE)}>
                Показать ещё · {filtered.length - shown.length}
              </button>
            ) : null}
          </div>
        ) : (
          <FxEmpty
            icon={IconSearch}
            title={tab === "unread" && !category && !needle ? "Непрочитанных нет" : "Ничего не найдено"}
            body={tab === "unread" && !category && !needle ? "Вы прочитали все уведомления." : "Попробуйте изменить фильтры или поиск."}
            action={
              filtersOn ? (
                <button type="button" className="sx-btn sx-btn-soft sx-btn-sm" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              ) : null
            }
          />
        )}
      </section>
      {toast}
    </div>
  );
}
