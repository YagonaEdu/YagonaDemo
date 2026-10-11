import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SectionSearch, UserMenu } from "@/components/layout/FigmaChrome";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import { useI18n } from "@/i18n/useI18n";
import { api } from "@/services/api/client";
import { educationHomePath, educationSegmentPath } from "@/utils/routes";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconFolder,
  IconGrades,
  IconHome,
  IconHomework,
  IconLogout,
  IconMore,
  IconUser,
} from "@/pages/student/icons";
import "@/styles/student-figma.css";
import "@/styles/teacher-figma.css";
import "@/styles/teacher-figma-pages.css";
import "@/styles/teacher-dialogs.css";

function IconGroups(props) {
  return (
    <svg className="y-icon" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.5.6 2.6 2 3 4.4" />
    </svg>
  );
}

function IconStudents(props) {
  return (
    <svg className="y-icon" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 5l9 4.5-9 4.5z" />
      <path d="M7 11.5v4c1.4 1.3 3 2 5 2s3.6-.7 5-2v-4M21 9.5v5" />
    </svg>
  );
}

/* Sidebar groups follow the Figma «Кабинет учителя» frame; labels are i18n keys. */
const GROUPS = [
  {
    label: "shell.groupWork",
    items: [
      { segment: "", label: "shell.home", icon: IconHome, end: true },
      { segment: "groups", label: "shell.groups", icon: IconGroups },
      { segment: "students", label: "shell.students", icon: IconStudents },
      { segment: "attendance", label: "shell.journal", icon: IconCheck },
      { segment: "schedule", label: "shell.schedule", icon: IconCalendar },
      { segment: "assignments", label: "shell.assignments", icon: IconHomework, count: "reviews" },
      { segment: "results", label: "shell.results", icon: IconGrades },
      { segment: "materials", label: "shell.materials", icon: IconFolder },
    ],
  },
  { label: "shell.groupContact", items: [{ segment: "notifications", label: "shell.notifications", icon: IconBell }] },
  { label: "shell.groupAccount", items: [{ segment: "profile", label: "shell.profile", icon: IconUser }] },
];

const BOTTOM = ["", "attendance", "groups", "assignments"];
const BOTTOM_LABEL = {
  "": "shell.home",
  attendance: "shell.journal",
  groups: "shell.groupsShort",
  assignments: "shell.assignments",
};

const HEADERS = {
  "": ["shell.headHome", "shell.subHome"],
  groups: ["shell.headGroups", "shell.subGroups"],
  students: ["shell.headStudents", "shell.subStudents"],
  attendance: ["shell.headAttendance", "shell.subAttendance"],
  schedule: ["shell.headSchedule", "shell.subSchedule"],
  assignments: ["shell.headAssignments", "shell.subAssignments"],
  results: ["shell.headResults", "shell.subResults"],
  materials: ["shell.headMaterials", "shell.subMaterials"],
  notifications: ["shell.headNotifications", "shell.subNotifications"],
  profile: ["shell.headProfile", "shell.subProfile"],
};

function defaultHeader(segment, t) {
  const [title, subtitle] = HEADERS[segment] || HEADERS[""];
  return { title: t(title), subtitle: t(subtitle) };
}

const REVIEWS_POLL_MS = 300000;

function segmentOf(pathname, slug) {
  const base = educationHomePath(slug);
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, "") : "";
  return rest.split("/")[0] || "";
}

function teacherName(membership, user, t) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return membership?.full_name || name || user?.email || user?.phone || t("shell.teacherFallback");
}

function Count({ value }) {
  if (!value) return null;
  return <span className="sx-count">{value > 99 ? "99+" : value}</span>;
}

export default function TeacherShell({ session, membership, slug, onLogout }) {
  const { t, lang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const segment = segmentOf(location.pathname, slug);
  const [header, setHeaderState] = useState(() => defaultHeader(segment, t));
  const [reviews, setReviews] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const setHeader = useCallback((next) => setHeaderState(next), []);

  // Drawers and modals are portalled into <body>; this class gives them the cabinet's look.
  useEffect(() => {
    document.body.classList.add("tx-cabinet");
    return () => document.body.classList.remove("tx-cabinet");
  }, []);

  useEffect(() => {
    setHeaderState(defaultHeader(segment, t));
    setMoreOpen(false);
  }, [segment, location.pathname, t, lang]);

  const refreshReviews = useCallback(() => {
    api
      .get("/teacher/dashboard")
      .then((data) => setReviews(Number(data?.pending_reviews || 0)))
      .catch(() => {
        /* badge is best-effort */
      });
  }, []);

  useEffect(() => {
    refreshReviews();
    const id = setInterval(refreshReviews, REVIEWS_POLL_MS);
    window.addEventListener("focus", refreshReviews);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refreshReviews);
    };
  }, [refreshReviews, session.tenantId]);

  const path = (seg) => (seg ? educationSegmentPath(slug, seg) : educationHomePath(slug));
  const allItems = useMemo(
    () =>
      GROUPS.flatMap((group) => group.items).map((item) => ({
        ...item,
        label: t(item.label),
        to: path(item.segment),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, lang],
  );
  const counts = { reviews };
  const name = teacherName(membership, session.user, t);
  const centerName = membership?.tenant_name || slug;
  const centers = (session.memberships || [])
    .filter((item) => item.tenant_slug)
    .map((item) => ({ id: String(item.tenant_slug).toLowerCase(), name: item.tenant_name }));
  const bottomItems = BOTTOM.map((seg) => allItems.find((item) => item.segment === seg));
  const moreItems = allItems.filter((item) => !BOTTOM.includes(item.segment));
  const moreActive = moreItems.some((item) => item.segment === segment);

  return (
    <div className="st-shell sx-shell sx-teacher shell-education is-teacher">
      <aside className="sx-side" aria-label={t("shell.menu")}>
        <Link to={path("")} className="sx-brand" aria-label={t("shell.brandLabel")}>
          <img src="/student/logo-mark.svg" alt="" width="40" height="40" />
          <span>
            <strong>Yagona</strong>
            <small>{t("shell.cabinet")}</small>
          </span>
        </Link>

        <nav className="sx-nav">
          {GROUPS.map((group) => (
            <div key={group.label} className="sx-nav-group">
              <span className="sx-nav-label">{t(group.label)}</span>
              {group.items.map(({ segment: seg, label: labelKey, icon: Icon, end, count }) => {
                const label = t(labelKey);
                return (
                <NavLink
                  key={seg || "home"}
                  to={path(seg)}
                  end={end}
                  className="sx-nav-link"
                  title={label}
                  aria-label={
                    count && counts[count] ? t("shell.countLabel", { label, count: counts[count] }) : label
                  }
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {count ? <Count value={counts[count]} /> : null}
                </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="sx-nav-link sx-logout"
          onClick={onLogout}
          title={t("common.logout")}
          aria-label={t("common.logout")}
        >
          <IconLogout size={20} />
          <span>{t("common.logout")}</span>
        </button>
      </aside>

      <div className="sx-main">
        <header className="sx-top">
          <div className="sx-top-title">
            <h1>{header.title}</h1>
            {header.subtitle ? <p>{header.subtitle}</p> : null}
          </div>
          <SectionSearch items={allItems} />
          <LanguageSwitch variant="compact" />
          <Link to={path("notifications")} className="sx-ibtn" aria-label={t("shell.notifications")}>
            <IconBell size={20} />
          </Link>
          <UserMenu
            name={name}
            subtitle={t("shell.userSubtitle", { centre: centerName })}
            avatarClass="is-teal"
            profileTo={path("profile")}
            centers={centers}
            currentCenter={String(slug).toLowerCase()}
            onPickCenter={(item) => navigate(educationHomePath(item.id))}
            onLogout={onLogout}
          />
        </header>

        {/* Remount on language change so memoised labels in pages are rebuilt. */}
        <main className="st-content sx-content tx-content" key={`${session.tenantId}:${lang}`}>
          <Outlet context={{ setHeader, refreshReviews, teacherName: name }} />
        </main>
      </div>

      <nav className="sx-bottom" aria-label={t("shell.navigation")}>
        {bottomItems.map(({ segment: seg, to, icon: Icon, end, count }) => (
          <NavLink key={seg || "home"} to={to} end={end} className="sx-bottom-link">
            <span className="sx-bottom-icon">
              <Icon size={22} />
              {count && counts[count] ? <span className="sx-bottom-badge">{counts[count]}</span> : null}
            </span>
            <span>{t(BOTTOM_LABEL[seg])}</span>
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
          </span>
          <span>{t("shell.more")}</span>
        </button>
      </nav>

      {moreOpen ? (
        <>
          <button
            type="button"
            className="sx-more-scrim"
            aria-label={t("common.close")}
            onClick={() => setMoreOpen(false)}
          />
          <div className="sx-more-sheet" id="sx-more-sheet" role="dialog" aria-label={t("shell.moreSections")}>
            <span className="sx-more-handle" aria-hidden="true" />
            {moreItems.map(({ segment: seg, to, label, icon: Icon }) => (
              <NavLink key={seg} to={to} className="sx-more-link">
                <span className="sx-more-icon">
                  <Icon size={20} />
                </span>
                {label}
              </NavLink>
            ))}
            <button type="button" className="sx-more-link is-danger" onClick={onLogout}>
              <span className="sx-more-icon">
                <IconLogout size={20} />
              </span>
              {t("common.logout")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
