import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import "@/styles/lang-switch.css";

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * UZ / RU / EN picker. `panel` (login, Figma: globe + name + chevron) or `compact`
 * (cabinet top bar: globe + code).
 */
export default function LanguageSwitch({ variant = "compact" }) {
  const { t, lang, setLanguage, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = languages.find((item) => item.code === lang) || languages[0];

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
    <div className={`lang-switch is-${variant}`} ref={rootRef}>
      <button
        type="button"
        className="lang-switch-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("common.language")}: ${current.label}`}
        title={t("common.language")}
        onClick={() => setOpen((value) => !value)}
      >
        {variant === "panel" ? (
          <img src="/login/ic-globe.svg" width="18" height="18" alt="" />
        ) : (
          <GlobeIcon />
        )}
        <span>{variant === "panel" ? current.label : current.short}</span>
        {variant === "panel" ? (
          <img src="/login/ic-chevron-down.svg" width="14" height="14" alt="" />
        ) : (
          <ChevronIcon />
        )}
      </button>
      {open ? (
        <ul className="lang-switch-menu" role="listbox" aria-label={t("common.language")}>
          {languages.map((item) => {
            const selected = item.code === lang;
            return (
              <li key={item.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  lang={item.code}
                  className={selected ? "is-current" : ""}
                  onClick={() => {
                    setLanguage(item.code);
                    setOpen(false);
                  }}
                >
                  <span className="lang-switch-code">{item.short}</span>
                  <span className="lang-switch-name">{item.label}</span>
                  {selected ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
