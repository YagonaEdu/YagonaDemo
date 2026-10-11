import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS_LABELS } from "@/constants";
import { t } from "@/i18n";
import {
  formatMoneyInput,
  formatQueryWithPhone,
  formatUzPhone,
  formatUzPhoneLocal,
  moneyInputSuffix,
  normalizePriceDigits,
  toApiPhone,
  uzPhoneLocalDigits,
} from "@/utils/format";

export function Banner({ children, tone = "error" }) {
  if (!children) return null;
  const cls = tone === "ok" ? "ok" : tone === "warn" ? "warn" : "";
  return <div className={`banner ${cls}`}>{children}</div>;
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "300 000",
  currency = "UZS",
  className = "",
  required = false,
  ...rest
}) {
  const display = formatMoneyInput(value);
  const hasValue = Boolean(normalizePriceDigits(value));
  const suffix = moneyInputSuffix(currency);

  function commit(nextRaw) {
    onChange?.(normalizePriceDigits(nextRaw));
  }

  function handleChange(event) {
    commit(event.target.value);
  }

  function handlePaste(event) {
    const text = event.clipboardData?.getData("text") || "";
    if (!text) return;
    event.preventDefault();
    commit(text);
  }

  function handleClear(event) {
    event.preventDefault();
    commit("");
  }

  return (
    <div className={`money-field ${hasValue ? "has-value" : ""} ${className}`.trim()}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="money-input"
        value={display}
        placeholder={placeholder}
        onChange={handleChange}
        onPaste={handlePaste}
        aria-label={t("ui.amount")}
      />
      {hasValue ? (
        <button
          type="button"
          className="money-field-clear"
          aria-label={t("ui.clearAmount")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
        >
          ×
        </button>
      ) : null}
      <span className="money-field-suffix">{suffix}</span>
      {required && !hasValue ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="person-search-required"
          value=""
          required
          onChange={() => {}}
        />
      ) : null}
    </div>
  );
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "90 123 45 67",
  className = "",
  required = false,
  onApiChange,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const localDigits = uzPhoneLocalDigits(value);
  const localValue = formatUzPhoneLocal(value);
  const hasPhone = Boolean(localDigits);
  const maskGuide = "00 000 00 00";
  const showGuide = focused || hasPhone;

  function commit(local) {
    const nextLocal = String(local || "").replace(/\D/g, "").slice(0, 9);
    const formatted = nextLocal ? formatUzPhone(`998${nextLocal}`) : "";
    onChange?.(formatted);
    onApiChange?.(toApiPhone(formatted));
  }

  function handleChange(event) {
    // Accept paste of +998… / 998… / raw local digits
    commit(uzPhoneLocalDigits(event.target.value));
  }

  function handlePaste(event) {
    const text = event.clipboardData?.getData("text") || "";
    if (!text) return;
    event.preventDefault();
    commit(uzPhoneLocalDigits(text));
  }

  function handleClear(event) {
    event.preventDefault();
    commit("");
  }

  return (
    <div
      className={`phone-field ${hasPhone ? "has-value" : ""} ${focused ? "is-focused" : ""} ${className}`.trim()}
    >
      <span className="phone-field-prefix" aria-hidden="true">
        <span className="phone-field-flag">UZ</span>
        <span className="phone-field-code">+998</span>
      </span>
      <div className="phone-field-body">
        {showGuide ? (
          <span className="phone-field-ghost" aria-hidden="true">
            <span className="phone-field-ghost-filled">{localValue}</span>
            <span className="phone-field-ghost-rest">{maskGuide.slice(localValue.length)}</span>
          </span>
        ) : null}
        <input
          {...rest}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={localValue}
          placeholder={focused ? "" : placeholder}
          onChange={handleChange}
          onPaste={handlePaste}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          aria-label={t("ui.phone")}
        />
      </div>
      {hasPhone ? (
        <button
          type="button"
          className="phone-field-clear"
          aria-label={t("ui.clearPhone")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClear}
        >
          ×
        </button>
      ) : null}
      {required && !hasPhone ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="person-search-required"
          value=""
          required
          onChange={() => {}}
        />
      ) : null}
    </div>
  );
}

export function SearchInput({ value, onChange, className = "", ...rest }) {
  return (
    <input
      {...rest}
      className={className}
      value={value}
      onChange={(event) => onChange?.(formatQueryWithPhone(event.target.value))}
    />
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions }) {
  return (
    <div className="topbar">
      <div className="topbar-copy">
        {eyebrow ? <div className="topbar-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="muted lead">{subtitle}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="card compact stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat">{value}</div>
      {hint ? <div className="muted">{hint}</div> : null}
    </div>
  );
}

export function Badge({ value, label }) {
  if (!value && !label) return "—";
  const text = label || STATUS_LABELS[value] || value;
  return <span className={`status ${value || ""}`}>{text}</span>;
}

export function Avatar({ name, size }) {
  const letters = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return <div className={size === "lg" ? "avatar lg" : "avatar"}>{letters}</div>;
}

export function DataTable({ columns, rows, empty = t("common.emptyDefault"), onRowClick }) {
  if (!rows?.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              className={onRowClick ? "is-clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={col.align ? { textAlign: col.align } : undefined}
                  onClick={col.stopRowClick ? (event) => event.stopPropagation() : undefined}
                >
                  {col.render ? col.render(row) : row[col.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  busy,
  disabled,
  onClick,
  className = "",
}) {
  return (
    <button
      className={`btn btn-${variant} ${busy ? "is-busy" : ""} ${className}`.trim()}
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
      <span className={busy ? "btn-label is-hidden" : "btn-label"}>{children}</span>
    </button>
  );
}

/* Dialogs currently on screen, innermost last: Escape closes only the top one. */
const openDialogs = [];
let bodyOverflowBeforeDialogs = "";

/**
 * «×» button for drawers and modals. While mounted it also closes its dialog on Escape
 * and stops the page behind it from scrolling.
 */
export function CloseButton({ onClick, disabled = false, label = t("common.close"), className = "" }) {
  const closeRef = useRef(onClick);
  closeRef.current = disabled ? null : onClick;

  useEffect(() => {
    const entry = {};
    if (!openDialogs.length) {
      bodyOverflowBeforeDialogs = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(entry);
    function onKey(event) {
      if (event.key !== "Escape" || openDialogs[openDialogs.length - 1] !== entry) return;
      event.preventDefault();
      closeRef.current?.();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openDialogs.splice(openDialogs.indexOf(entry), 1);
      if (!openDialogs.length) document.body.style.overflow = bodyOverflowBeforeDialogs;
    };
  }, []);

  return (
    <button
      type="button"
      className={`y-close-btn ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={t("common.closeEsc", { label })}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

export function EmptyState({ title, body, action, icon }) {
  return (
    <div className={`empty-state${icon ? " has-icon" : ""}`}>
      {icon ? <span className="empty-state-icon" aria-hidden="true">{icon}</span> : null}
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function FiltersBar({ children }) {
  return <div className="card filters-bar">{children}</div>;
}

export function TextAction({ children, onClick, type = "button" }) {
  return (
    <button className="text-action" type={type} onClick={onClick}>
      {children}
    </button>
  );
}

export function RowActionsMenu({ items, align = "end" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const visible = (items || []).filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <div
      className={`row-actions row-actions-${align}`}
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="row-actions-trigger"
        aria-label={t("common.actions")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="row-actions-menu" role="menu">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-actions-item ${item.danger ? "is-danger" : ""}`}
              disabled={item.disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Shimmer placeholder. Pass `lines` for a text block, or width/height for a shape. */
export function Skeleton({ width, height = 14, radius, lines = 0, className = "" }) {
  if (lines > 0) {
    return (
      <div className={`y-skeleton-lines ${className}`.trim()} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className="y-skeleton"
            style={{ width: index === lines - 1 ? "60%" : "100%", height }}
          />
        ))}
      </div>
    );
  }
  return (
    <span
      className={`y-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function ErrorState({ title = t("common.loadFailed"), message, onRetry, action }) {
  return (
    <div className="y-error-state" role="alert">
      <span className="y-error-icon" aria-hidden="true">!</span>
      <div className="y-error-copy">
        <strong>{title}</strong>
        {message ? <p>{message}</p> : null}
      </div>
      <div className="y-error-actions">
        {onRetry ? (
          <button type="button" className="y-btn y-btn-secondary" onClick={onRetry}>
            {t("common.retry")}
          </button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

/** const [toast, showToast] = useToast(); render {toast}; call showToast("Сохранено"). */
export function useToast(duration = 2800) {
  const [state, setState] = useState(null);
  const timer = useRef(null);
  const show = useCallback(
    (message, tone = "success") => {
      clearTimeout(timer.current);
      setState({ message, tone, key: Date.now() });
      timer.current = setTimeout(() => setState(null), duration);
    },
    [duration],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = state ? (
    <div key={state.key} className={`y-toast is-${state.tone}`} role="status" aria-live="polite">
      {state.message}
    </div>
  ) : null;
  return [node, show];
}
