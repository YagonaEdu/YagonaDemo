import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { initialsOf, UserMenu } from "@/components/layout/FigmaChrome";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import { positionLabel, ROLE_LABELS } from "@/constants";
import { useI18n } from "@/i18n/useI18n";
import { educationHomePath, educationSegmentPath } from "@/utils/routes";
import { loadReceptionCounts } from "@/pages/education-admin/resepshen_yagona/receptionData";
import {
  IconBell,
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconCheckSquare,
  IconChevronDown,
  IconDoor,
  IconFunnel,
  IconGrid,
  IconLayers,
  IconList,
  IconLogout,
  IconMore,
  IconSettings,
  IconStar,
  IconSun,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/pages/education-admin/resepshen_yagona/rxIcons";
import "@/styles/student-figma.css";
import "@/styles/reception-figma.css";

/* Sidebar groups per role. Reception follows the Figma «Кабинет ресепшн» frame; owner and
   accountant get the same cabinet with their own sections. Labels are i18n keys. */
const NAV = {
  admin: {
    brandSub: "rxShell.brandSub",
    bottom: ["", "crm", "trials", "billing"],
    groups: [
      {
        label: "rxShell.groupToday",
        items: [
          { segment: "", label: "rxShell.today", icon: IconSun, end: true },
          { segment: "crm", label: "rxShell.leads", icon: IconFunnel, count: "leads" },
          { segment: "trials", label: "rxShell.trials", icon: IconStar, count: "trials" },
          { segment: "tasks", label: "rxShell.tasks", icon: IconList, count: "tasks" },
        ],
      },
      {
        label: "rxShell.groupBase",
        items: [
          { segment: "students", label: "rxShell.students", icon: IconUsers },
          { segment: "billing", label: "rxShell.payments", icon: IconWallet },
          { segment: "schedule", label: "rxShell.schedule", icon: IconCalendar },
          { segment: "attendance", label: "rxShell.attendance", icon: IconCheckSquare },
          { segment: "teachers", label: "rxShell.teachers", icon: IconUser },
          { segment: "notifications", label: "rxShell.notifications", icon: IconBell },
        ],
      },
      {
        label: "rxShell.groupLearning",
        items: [
          { segment: "courses", label: "rxShell.courses", icon: IconBook },
          { segment: "groups", label: "rxShell.groups", icon: IconLayers },
          { segment: "rooms", label: "rxShell.rooms", icon: IconDoor },
        ],
      },
    ],
  },
  owner: {
    brandSub: "rxShell.brandSubOwner",
    bottom: ["", "students", "billing", "finance"],
    groups: [
      {
        label: "rxShell.groupMain",
        items: [
          { segment: "", label: "rxShell.overview", icon: IconGrid, end: true },
          { segment: "crm", label: "rxShell.leads", icon: IconFunnel, count: "leads" },
          { segment: "trials", label: "rxShell.trials", icon: IconStar, count: "trials" },
          { segment: "tasks", label: "rxShell.tasks", icon: IconList, count: "tasks" },
        ],
      },
      {
        label: "rxShell.groupLearning",
        items: [
          { segment: "students", label: "rxShell.students", icon: IconUsers },
          { segment: "courses", label: "rxShell.courses", icon: IconBook },
          { segment: "groups", label: "rxShell.groups", icon: IconLayers },
          { segment: "schedule", label: "rxShell.schedule", icon: IconCalendar },
          { segment: "attendance", label: "rxShell.attendance", icon: IconCheckSquare },
          { segment: "rooms", label: "rxShell.rooms", icon: IconDoor },
        ],
      },
      {
        label: "rxShell.groupMoney",
        items: [
          { segment: "billing", label: "rxShell.payments", icon: IconWallet },
          { segment: "finance", label: "rxShell.finance", icon: IconChart },
        ],
      },
      {
        label: "rxShell.groupTeam",
        items: [
          { segment: "teachers", label: "rxShell.teachers", icon: IconUser },
          { segment: "staff", label: "rxShell.team", icon: IconBriefcase },
          { segment: "notifications", label: "rxShell.notifications", icon: IconBell },
        ],
      },
    ],
  },
  accountant: {
    brandSub: "rxShell.brandSubAccountant",
    bottom: ["", "students", "billing", "finance"],
    noCounts: true,
    groups: [
      {
        label: "rxShell.groupMain",
        items: [
          { segment: "", label: "rxShell.overview", icon: IconGrid, end: true },
          { segment: "students", label: "rxShell.students", icon: IconUsers },
        ],
      },
      {
        label: "rxShell.groupMoney",
        items: [
          { segment: "billing", label: "rxShell.payments", icon: IconWallet },
          { segment: "finance", label: "rxShell.finance", icon: IconChart },
        ],
      },
    ],
  },
};

const COUNTS_POLL_MS = 180000;

function segmentOf(pathname, slug) {
  const base = educationHomePath(slug);
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, "") : "";
  return rest.split("/")[0] || "";
}

function Count({ value }) {
  if (!value) return null;
  return <span className="sx-count">{value > 99 ? "99+" : value}</span>;
}

function staffName(membership, user, t) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return membership?.full_name || name || user?.email || user?.phone || t("rxShell.staff");
}

/** Cabinet of the centre's staff (owner, reception, accountant): one look, menu per role. */
export default function ReceptionShell({ session, membership, slug, onLogout }) {
  const cabinetRole = NAV[membership?.role] ? membership.role : "owner";
  const nav = NAV[cabinetRole];
  const { t, lang, setLanguage, languages } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const segment = segmentOf(location.pathname, slug);
  const [counts, setCounts] = useState({});
  const [moreOpen, setMoreOpen] = useState(false);

  // Sheets and modals are portalled or fixed; this class gives them the cabinet's palette.
  useEffect(() => {
    document.body.classList.add("rx-cabinet");
    return () => document.body.classList.remove("rx-cabinet");
  }, []);

  // Escape closes the top-most dialog that has no CloseButton of its own (those handle it first).
  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const overlays = document.querySelectorAll(".overlay");
      const top = overlays[overlays.length - 1];
      const close = top?.querySelector(".sheet-close, .overlay-backdrop");
      if (close) {
        event.preventDefault();
        close.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  // Phones show tables as cards: copy each column title onto its cells (CSS reads data-label).
  const contentRef = useRef(null);
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;
    let frame = 0;
    const label = () => {
      frame = 0;
      root.querySelectorAll("table").forEach((table) => {
        const titles = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
        if (!titles.length) return;
        table.querySelectorAll("tbody tr").forEach((row) => {
          [...row.children].forEach((cell, index) => {
            const text = titles[index] || "";
            if (cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
          });
        });
      });
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(label);
    });
    observer.observe(root, { childList: true, subtree: true });
    label();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [lang]);

  const refreshCounts = useCallback(() => {
    if (nav.noCounts) return;
    loadReceptionCounts()
      .then(setCounts)
      .catch(() => {
        /* badges are best-effort */
      });
  }, [nav.noCounts]);

  useEffect(() => {
    refreshCounts();
    const id = setInterval(refreshCounts, COUNTS_POLL_MS);
    window.addEventListener("focus", refreshCounts);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refreshCounts);
    };
  }, [refreshCounts, session.tenantId]);

  const path = (seg) => (seg ? educationSegmentPath(slug, seg) : educationHomePath(slug));
  const allItems = useMemo(() => nav.groups.flatMap((group) => group.items), [nav]);
  const name = staffName(membership, session.user, t);
  const role = membership?.position ? positionLabel(membership.position) : ROLE_LABELS[cabinetRole];
  const centerName = membership?.tenant_name || slug;
  const centers = (session.memberships || [])
    .filter((item) => item.tenant_slug)
    .map((item) => ({ id: String(item.tenant_slug).toLowerCase(), name: item.tenant_name }));
  const bottomItems = nav.bottom.map((seg) => allItems.find((item) => item.segment === seg));
  const moreItems = allItems.filter((item) => !nav.bottom.includes(item.segment));
  const moreActive = moreItems.some((item) => item.segment === segment) || segment === "settings";

  return (
    <div className={`st-shell sx-shell sx-reception shell-education is-${cabinetRole}`}>
      <aside className="sx-side rx-side" aria-label={t("rxShell.menu")}>
        <Link to={path("")} className="sx-brand rx-brand" aria-label="Yagona">
          <span className="rx-brand-tile" aria-hidden="true">Y</span>
          <span>
            <strong>Yagona</strong>
            <small>{t(nav.brandSub)}</small>
          </span>
        </Link>

        <nav className="sx-nav">
          {nav.groups.map((group) => (
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
                    aria-label={count && counts[count] ? t("rxShell.countLabel", { label, count: counts[count] }) : label}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                    {count ? <Count value={counts[count]} /> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rx-side-foot">
          <div className="rx-side-row">
            <span className="rx-side-label">{t("rxShell.centre")}</span>
            <div className="rx-lang" role="group" aria-label={t("common.language")}>
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  lang={item.code}
                  className={item.code === lang ? "is-active" : ""}
                  aria-pressed={item.code === lang}
                  title={item.label}
                  onClick={() => setLanguage(item.code)}
                >
                  {item.short}
                </button>
              ))}
            </div>
          </div>
          {centers.length > 1 ? (
            <label className="rx-centre">
              <select
                value={String(slug).toLowerCase()}
                onChange={(event) => navigate(educationHomePath(event.target.value))}
                aria-label={t("rxShell.switchCentre")}
              >
                {centers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <IconChevronDown size={16} />
            </label>
          ) : (
            <div className="rx-centre is-static" title={centerName}>
              <span>{centerName}</span>
            </div>
          )}

          <div className="rx-me">
            <span className="rx-me-avatar" aria-hidden="true">{initialsOf(name)}</span>
            <span className="rx-me-copy">
              <strong title={name}>{name}</strong>
              <small>{role}</small>
            </span>
            <NavLink to={path("settings")} className="rx-me-btn" title={t("rxShell.settings")} aria-label={t("rxShell.settings")}>
              <IconSettings size={18} />
            </NavLink>
            <button type="button" className="rx-me-btn" onClick={onLogout} title={t("common.logout")} aria-label={t("common.logout")}>
              <IconLogout size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="sx-main">
        {/* Phones only: the mockup keeps title and actions inside each page. */}
        <header className="sx-top rx-top">
          <Link to={path("")} className="rx-top-brand" aria-label="Yagona">
            <span className="rx-brand-tile" aria-hidden="true">Y</span>
            <span className="rx-top-centre">{centerName}</span>
          </Link>
          <LanguageSwitch variant="compact" />
          <UserMenu
            name={name}
            subtitle={role}
            avatarClass="is-teal"
            profileTo={path("settings")}
            centers={centers}
            currentCenter={String(slug).toLowerCase()}
            onPickCenter={(item) => navigate(educationHomePath(item.id))}
            onLogout={onLogout}
          />
        </header>

        {/* Remount on language change so memoised labels in pages are rebuilt. */}
        <main ref={contentRef} className="st-content sx-content rx-content" key={`${session.tenantId}:${lang}`}>
          <Outlet context={{ refreshCounts }} />
        </main>
      </div>

      <nav className="sx-bottom" aria-label={t("rxShell.navigation")}>
        {bottomItems.map(({ segment: seg, icon: Icon, end, count, label }) => (
          <NavLink key={seg || "home"} to={path(seg)} end={end} className="sx-bottom-link">
            <span className="sx-bottom-icon">
              <Icon size={22} />
              {count && counts[count] ? <span className="sx-bottom-badge">{counts[count]}</span> : null}
            </span>
            <span>{t(label)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`sx-bottom-link${moreActive || moreOpen ? " active" : ""}`}
          aria-expanded={moreOpen}
          aria-controls="rx-more-sheet"
          onClick={() => setMoreOpen((value) => !value)}
        >
          <span className="sx-bottom-icon">
            <IconMore size={22} />
          </span>
          <span>{t("rxShell.more")}</span>
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
          <div className="sx-more-sheet rx-more-sheet" id="rx-more-sheet" role="dialog" aria-label={t("rxShell.more")}>
            <span className="sx-more-handle" aria-hidden="true" />
            {[...moreItems, { segment: "settings", label: "rxShell.settings", icon: IconSettings }].map(
              ({ segment: seg, label, icon: Icon, count }) => (
                <NavLink key={seg} to={path(seg)} className="sx-more-link">
                  <span className="sx-more-icon">
                    <Icon size={20} />
                  </span>
                  {t(label)}
                  {count ? <Count value={counts[count]} /> : null}
                </NavLink>
              ),
            )}
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
