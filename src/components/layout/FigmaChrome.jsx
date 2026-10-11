/* Top-bar pieces shared by the Figma student and teacher shells (styles: student-figma.css). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "@/i18n";

function Svg({ size = 18, children }) {
  return (
    <svg className="y-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconSearch = () => (
  <Svg>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
const IconChevronDown = () => (
  <Svg size={16}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const IconUser = () => (
  <Svg>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c1.3-3.6 4.1-5.4 7.5-5.4s6.2 1.8 7.5 5.4" />
  </Svg>
);
const IconLogout = () => (
  <Svg>
    <path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Svg>
);

export function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Jumps to a cabinet section by name; ⌘K / Ctrl+K focuses it. */
export function SectionSearch({ items }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  }, [query, items]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(item) {
    if (!item) return;
    navigate(item.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="sx-search">
      <IconSearch />
      <input
        ref={inputRef}
        value={query}
        placeholder={t("common.search")}
        aria-label={t("ui.sectionSearch")}
        role="combobox"
        aria-expanded={open}
        aria-controls="sx-search-list"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          } else if (event.key === "Enter") {
            go(matches[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      <kbd>⌘K</kbd>
      {open && matches.length ? (
        <ul className="sx-search-list" id="sx-search-list" role="listbox">
          {matches.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.to} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  className={index === active ? "is-active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(item)}
                >
                  {Icon ? <Icon size={18} /> : null}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Avatar pill with profile link, centre switcher and logout. */
export function UserMenu({ name, subtitle, avatarClass = "", profileTo, centers = [], currentCenter, onPickCenter, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="sx-user" ref={rootRef}>
      <button type="button" className="sx-user-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={`sx-avatar ${avatarClass}`.trim()}>{initialsOf(name)}</span>
        <span className="sx-user-copy">
          <strong>{name}</strong>
          <span>{subtitle}</span>
        </span>
        <IconChevronDown />
      </button>
      {open ? (
        <div className="sx-user-menu" role="menu">
          <Link role="menuitem" to={profileTo} onClick={() => setOpen(false)}>
            <IconUser /> {t("ui.profile")}
          </Link>
          {centers.length > 1 ? (
            <>
              <span className="sx-user-menu-label">{t("ui.centre")}</span>
              {centers.map((item) => {
                const current = String(item.id) === String(currentCenter);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={current}
                    className={current ? "is-current" : ""}
                    onClick={() => {
                      setOpen(false);
                      if (!current) onPickCenter(item);
                    }}
                  >
                    <span className="sx-radio" aria-hidden="true" />
                    {item.name}
                  </button>
                );
              })}
            </>
          ) : null}
          <button type="button" role="menuitem" className="is-danger" onClick={onLogout}>
            <IconLogout /> {t("common.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
