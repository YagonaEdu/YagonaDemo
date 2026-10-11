import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SectionSearch, UserMenu } from "@/components/layout/FigmaChrome";
import { useAsync } from "@/hooks/useAsync";
import {
  getMyCard,
  loadHomework,
  refreshStudentMemberships,
  switchStudentTenant,
  unreadNotificationsCount,
} from "@/services/student";
import { homeworkState } from "@/pages/student/parts";
import {
  IconBell,
  IconCalendar,
  IconCards,
  IconCourses,
  IconGrades,
  IconHome,
  IconHomework,
  IconLogout,
  IconMore,
  IconUser,
  IconWallet,
} from "@/pages/student/icons";
import "@/styles/student.css";
import "@/styles/student-features.css";
import "@/styles/student-learning.css";
import "@/styles/student-vocab.css";
import "@/styles/student-home.css";
import "@/styles/student-profile.css";
import "@/styles/student-figma.css";

/* Sidebar groups follow the Figma «Кабинет студента» frame. */
const GROUPS = [
  {
    label: "Обучение",
    items: [
      { to: "/student", label: "Главная", icon: IconHome, end: true },
      { to: "/student/schedule", label: "Расписание", icon: IconCalendar },
      { to: "/student/courses", label: "Мои курсы", icon: IconCourses },
      { to: "/student/homework", label: "Домашние задания", icon: IconHomework, count: "homework" },
      { to: "/student/vocab", label: "Словарь", icon: IconCards },
      { to: "/student/grades", label: "Оценки и посещаемость", icon: IconGrades },
      { to: "/student/payments", label: "Оплаты", icon: IconWallet },
    ],
  },
  {
    label: "Общение",
    items: [{ to: "/student/notifications", label: "Уведомления", icon: IconBell, count: "unread" }],
  },
  {
    label: "Аккаунт",
    items: [{ to: "/student/profile", label: "Профиль", icon: IconUser }],
  },
];

const ALL_ITEMS = GROUPS.flatMap((group) => group.items);

/* Mobile bottom bar (Figma mobile): 4 main sections + «Ещё». */
const BOTTOM = ["/student", "/student/schedule", "/student/homework", "/student/payments"];

/* Fallback header per route; pages refine it through useCabinetHeader(). */
const HEADERS = [
  ["/student/schedule", "Расписание", "Ваши уроки по неделям"],
  ["/student/courses", "Мои курсы", "Курсы и материалы"],
  ["/student/homework/", "Домашнее задание", ""],
  ["/student/homework", "Домашние задания", "Задания ваших групп"],
  ["/student/vocab", "Словарь", "Слова и тренировки"],
  ["/student/grades", "Оценки и посещаемость", "Ваши результаты"],
  ["/student/attendance", "Оценки и посещаемость", "Ваши результаты"],
  ["/student/materials", "Материалы", "Файлы и ссылки от преподавателей"],
  ["/student/payments", "Оплаты", "Баланс и история платежей"],
  ["/student/notifications", "Уведомления", "Сообщения учебного центра"],
  ["/student/profile", "Профиль", "Личные данные и настройки"],
];

const UNREAD_POLL_MS = 60000;
const HOMEWORK_POLL_MS = 300000;

function defaultHeader(pathname) {
  const hit = HEADERS.find(([prefix]) => pathname.startsWith(prefix));
  return hit ? { title: hit[1], subtitle: hit[2] } : { title: "Главная", subtitle: "Обзор обучения" };
}

function displayName(card, user) {
  if (card?.full_name) return card.full_name;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return name || user?.phone || user?.email || "Ученик";
}

function Count({ value }) {
  if (!value) return null;
  return <span className="sx-count">{value > 99 ? "99+" : value}</span>;
}

export default function StudentLayout({ session, onLogout }) {
  const membership = useMemo(
    () =>
      session.memberships.find((item) => String(item.tenant_id) === String(session.tenantId)) ||
      null,
    [session.memberships, session.tenantId],
  );
  const card = useAsync(getMyCard, [session.tenantId]);
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [homeworkDue, setHomeworkDue] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [header, setHeaderState] = useState(() => defaultHeader(location.pathname));

  const setHeader = useCallback((next) => setHeaderState(next), []);

  useEffect(() => {
    setHeaderState(defaultHeader(location.pathname));
    setMoreOpen(false);
  }, [location.pathname]);

  const refreshUnread = useCallback(() => {
    unreadNotificationsCount()
      .then(setUnread)
      .catch(() => {
        /* badge is best-effort */
      });
  }, []);

  const refreshHomework = useCallback(() => {
    loadHomework()
      .then((rows) =>
        setHomeworkDue(rows.filter((row) => ["todo", "draft", "returned"].includes(homeworkState(row))).length),
      )
      .catch(() => {
        /* badge is best-effort */
      });
  }, []);

  useEffect(() => {
    refreshUnread();
    refreshHomework();
    const unreadId = setInterval(refreshUnread, UNREAD_POLL_MS);
    const homeworkId = setInterval(refreshHomework, HOMEWORK_POLL_MS);
    const onFocus = () => {
      refreshUnread();
      refreshHomework();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(unreadId);
      clearInterval(homeworkId);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnread, refreshHomework, session.tenantId]);

  useEffect(() => {
    let alive = true;
    refreshStudentMemberships()
      .then((list) => {
        if (!alive) return;
        if (!list.length) {
          onLogout();
          return;
        }
        if (!list.some((item) => String(item.tenant_id) === String(session.tenantId))) {
          switchStudentTenant(list[0].tenant_id);
        }
      })
      .catch(() => {
        /* keep the cached list; page-level requests surface real errors */
      });
    return () => {
      alive = false;
    };
    // Re-validate only on mount; switching centres is driven by the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = displayName(card.data, session.user);
  const centerName = membership?.tenant_name || "Учебный центр";
  const counts = { unread, homework: homeworkDue };
  const context = {
    session,
    membership,
    centerName,
    card,
    studentName: name,
    onLogout,
    unread,
    refreshUnread,
    refreshHomework,
    setHeader,
  };
  const bottomItems = BOTTOM.map((to) => ALL_ITEMS.find((item) => item.to === to));
  const moreItems = ALL_ITEMS.filter((item) => !BOTTOM.includes(item.to));
  const moreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  return (
    <div className="st-shell sx-shell">
      <aside className="sx-side" aria-label="Меню кабинета студента">
        <Link to="/student" className="sx-brand">
          <img src="/student/logo-mark.svg" alt="" width="40" height="40" />
          <span>
            <strong>Yagona</strong>
            <small>Кабинет студента</small>
          </span>
        </Link>

        <nav className="sx-nav">
          {GROUPS.map((group) => (
            <div key={group.label} className="sx-nav-group">
              <span className="sx-nav-label">{group.label}</span>
              {group.items.map(({ to, label, icon: Icon, end, count }) => (
                <NavLink key={to} to={to} end={end} className="sx-nav-link">
                  <Icon size={20} />
                  <span>{label}</span>
                  {count ? <Count value={counts[count]} /> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button type="button" className="sx-nav-link sx-logout" onClick={onLogout}>
          <IconLogout size={20} />
          <span>Выйти</span>
        </button>
      </aside>

      <div className="sx-main">
        <header className="sx-top">
          <div className="sx-top-title">
            <h1>{header.title}</h1>
            {header.subtitle ? <p>{header.subtitle}</p> : null}
          </div>
          <SectionSearch items={ALL_ITEMS} />
          <Link
            to="/student/notifications"
            className="sx-ibtn"
            aria-label={`Уведомления${unread ? `: ${unread} новых` : ""}`}
          >
            <IconBell size={20} />
            {unread ? <span className="sx-dot" aria-hidden="true" /> : null}
          </Link>
          <UserMenu
            name={name}
            subtitle={`Студент · ${centerName}`}
            profileTo="/student/profile"
            centers={session.memberships.map((item) => ({ id: item.tenant_id, name: item.tenant_name }))}
            currentCenter={session.tenantId}
            onPickCenter={(item) => {
              switchStudentTenant(item.id);
              navigate("/student", { replace: true });
            }}
            onLogout={onLogout}
          />
        </header>

        <main className="st-content sx-content" key={session.tenantId}>
          <Outlet context={context} />
        </main>
      </div>

      <nav className="sx-bottom" aria-label="Навигация">
        {bottomItems.map(({ to, label, icon: Icon, end, count }) => (
          <NavLink key={to} to={to} end={end} className="sx-bottom-link">
            <span className="sx-bottom-icon">
              <Icon size={22} />
              {count && counts[count] ? <span className="sx-bottom-badge">{counts[count]}</span> : null}
            </span>
            <span>{to === "/student/homework" ? "Задания" : label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`sx-bottom-link${moreActive || moreOpen ? " active" : ""}`}
          aria-expanded={moreOpen}
          aria-controls="sx-more-sheet"
          onClick={() => setMoreOpen((value) => !value)}
        >
          <span className="sx-bottom-icon">
            <IconMore size={22} />
            {unread ? <span className="sx-bottom-badge">{unread}</span> : null}
          </span>
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen ? (
        <>
          <button type="button" className="sx-more-scrim" aria-label="Закрыть" onClick={() => setMoreOpen(false)} />
          <div className="sx-more-sheet" id="sx-more-sheet" role="dialog" aria-label="Ещё разделы">
            <span className="sx-more-handle" aria-hidden="true" />
            {moreItems.map(({ to, label, icon: Icon, count }) => (
              <NavLink key={to} to={to} className="sx-more-link">
                <span className="sx-more-icon">
                  <Icon size={20} />
                </span>
                {label}
                {count ? <Count value={counts[count]} /> : null}
              </NavLink>
            ))}
            <button type="button" className="sx-more-link is-danger" onClick={onLogout}>
              <span className="sx-more-icon">
                <IconLogout size={20} />
              </span>
              Выйти
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
