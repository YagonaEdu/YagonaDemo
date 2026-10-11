import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/brand";
import { Avatar } from "@/components/ui";
import { SUPER_ADMIN_NAV } from "@/constants";
import { enterEducationCenter } from "@/services/tenant";
import { educationHomePath } from "@/utils/routes";
import {
  IconChevronDown,
  IconClose,
  IconEnter,
  IconLogout,
  IconMenu,
  SUPER_NAV_ICONS,
} from "./superAdminIcons";
import "@/styles/super-admin.css";

function groupNav(items) {
  const groups = [];
  for (const item of items) {
    const name = item.group || "Меню";
    let group = groups.find((entry) => entry.name === name);
    if (!group) {
      group = { name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function activeNavItem(pathname) {
  return (
    [...SUPER_ADMIN_NAV]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to))) || null
  );
}

function AccountMenu({ session, firstMembership, onEnterCenter, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const displayName = session.user?.name || session.user?.email || "Пользователь";
  const contact = session.user?.email || session.user?.phone || "—";

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`sa-account${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="sa-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={displayName} />
        <span className="sa-account-copy">
          <strong>{displayName}</strong>
          <span>Super Admin</span>
        </span>
        <IconChevronDown size={16} />
      </button>

      {open ? (
        <div className="sa-account-menu" role="menu">
          <div className="sa-account-meta">
            <strong>{displayName}</strong>
            <span>{contact}</span>
          </div>
          {firstMembership ? (
            <button
              type="button"
              role="menuitem"
              className="sa-account-item"
              onClick={() => {
                setOpen(false);
                onEnterCenter();
              }}
            >
              <IconEnter size={16} />
              В кабинет центра
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="sa-account-item is-danger"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            <IconLogout size={16} />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SuperAdminLayout({ session, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const firstMembership = session.memberships?.[0];
  const current = activeNavItem(location.pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  function enterFirstCenter() {
    enterEducationCenter(firstMembership.tenant_id, firstMembership.tenant_slug);
    navigate(educationHomePath(firstMembership.tenant_slug));
  }

  return (
    <div className={`shell shell-super${navOpen ? " is-nav-open" : ""}`}>
      <aside className="sa-sidebar" id="sa-sidebar" aria-label="Навигация Super Admin">
        <div className="sa-sidebar-head">
          <BrandMark title="Yagona" subtitle="Super Admin" />
          <button
            type="button"
            className="sa-icon-btn sa-sidebar-close"
            aria-label="Закрыть меню"
            onClick={() => setNavOpen(false)}
          >
            <IconClose />
          </button>
        </div>

        <nav className="sa-nav" aria-label="Основное меню">
          {groupNav(SUPER_ADMIN_NAV).map((group) => (
            <div className="sa-nav-group" key={group.name}>
              <div className="sa-nav-label">{group.name}</div>
              {group.items.map((item) => {
                const Icon = SUPER_NAV_ICONS[item.to];
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className="sa-nav-link">
                    {Icon ? <Icon /> : null}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sa-sidebar-foot">
          <span className="sa-scope-dot" aria-hidden="true" />
          <div>
            <strong>Платформа Yagona</strong>
            <span>Все центры</span>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="sa-scrim"
        aria-label="Закрыть меню"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <main className="main">
        <header className="sa-header">
          <button
            type="button"
            className="sa-icon-btn sa-menu-btn"
            aria-label="Открыть меню"
            aria-controls="sa-sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <IconMenu />
          </button>
          <nav className="sa-breadcrumb" aria-label="Хлебные крошки">
            <span>Yagona</span>
            {current?.group ? (
              <>
                <span className="sa-breadcrumb-sep" aria-hidden="true">/</span>
                <span>{current.group}</span>
              </>
            ) : null}
            {current ? (
              <>
                <span className="sa-breadcrumb-sep" aria-hidden="true">/</span>
                <strong aria-current="page">{current.label}</strong>
              </>
            ) : null}
          </nav>
          <div className="sa-header-right">
            <AccountMenu
              session={session}
              firstMembership={firstMembership}
              onEnterCenter={enterFirstCenter}
              onLogout={onLogout}
            />
          </div>
        </header>
        <div className="main-stage">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
