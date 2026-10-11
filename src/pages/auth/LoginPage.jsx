import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import { APP_MODES } from "@/constants";
import { useI18n } from "@/i18n/useI18n";
import { clearSession } from "@/services/api/client";
import {
  authenticate,
  needsCenterChoice,
  rememberStaffTenant,
  startSession,
} from "@/services/auth";
import { formatUzPhone, looksLikeEmail, toLoginIdentifier } from "@/utils/format";
import { educationHomePath } from "@/utils/routes";
import { resetDemoData } from "@/api";
import { DEMO_ACCOUNTS } from "@/mocks";

const LAST_LOGIN_KEY = "yagona-last-login";

const CENTER_TONES = ["is-blue", "is-amber", "is-teal", "is-violet"];

function readLastLogin() {
  try {
    return localStorage.getItem(LAST_LOGIN_KEY) || "";
  } catch {
    return "";
  }
}

function writeLastLogin(value) {
  try {
    if (value) localStorage.setItem(LAST_LOGIN_KEY, value);
    else localStorage.removeItem(LAST_LOGIN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function displayIdentifier(value) {
  if (!value || looksLikeEmail(value)) return value;
  return formatUzPhone(value);
}

function initialsOf(text) {
  return String(text || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function userName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || user?.phone || "";
}

/** Server texts are Russian only, so known failures get a translated message. */
function loginErrorKey(err) {
  if (err?.code === "no_membership") return "login.errorNoAccess";
  if (err?.payload?.code === "authentication_failed" || err?.status === 401) return "login.errorCredentials";
  if (err instanceof TypeError || err?.payload?.code === "network") return "login.errorNetwork";
  return "";
}

function Checkbox({ checked, onChange, children }) {
  return (
    <label className="lg-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="lg-check-box" aria-hidden="true">
        <img src="/login/ic-check.svg" width="14" height="14" alt="" />
      </span>
      <span>{children}</span>
    </label>
  );
}

function CenterPicker({ auth, onPick, onBack }) {
  const { t } = useI18n();
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState("");
  const centers = auth.staffMemberships;
  const name = userName(auth.tokens.user);
  const teaches = centers.every((item) => item.role === "teacher");

  function pick(membership) {
    setPending(String(membership.id));
    onPick(membership, remember);
  }

  return (
    <div className="lg-page">
      <div className="lg-topbar">
        <button type="button" className="lg-back" onClick={onBack}>
          <img src="/login/ic-back.svg" width="16" height="16" alt="" />
          {t("login.switchAccount")}
        </button>
        <LanguageSwitch variant="panel" />
      </div>

      <div className="lg-body lg-body-wide">
        <div className="lg-user">
          <span className="lg-user-avatar">{initialsOf(name)}</span>
          <span>
            <strong>{name}</strong>
            {auth.tokens.user?.phone ? <small>{formatUzPhone(auth.tokens.user.phone)}</small> : null}
          </span>
        </div>

        <h2 className="lg-title lg-title-sm">{t("login.pickTitle")}</h2>
        <p className="lg-lead">
          {t(teaches ? "login.pickLeadTeacher" : "login.pickLeadStaff", {
            centers: t("plural.centers", { count: centers.length }),
          })}
        </p>

        <ul className="lg-centers">
          {centers.map((item, index) => {
            const slug = String(item.tenant_slug || "").toLowerCase();
            const primary = index === 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`lg-center${primary ? " is-primary" : ""}`}
                  onClick={() => pick(item)}
                  disabled={Boolean(pending)}
                >
                  <span className={`lg-center-mark ${CENTER_TONES[index % CENTER_TONES.length]}`}>
                    {initialsOf(item.tenant_name)}
                  </span>
                  <span className="lg-center-copy">
                    <strong>{item.tenant_name}</strong>
                    <small>{item.position || t(`roles.${item.role}`)}</small>
                  </span>
                  <span className="lg-center-meta">
                    <span className="lg-role">{t(`roles.${item.role}`)}</span>
                    <small>→ /education/{slug}</small>
                  </span>
                  <span className={`lg-center-go${primary ? " is-primary" : ""}`}>
                    {pending === String(item.id) ? t("login.opening") : t("login.submit")}
                    <img
                      src={primary ? "/login/ic-arrow-white-sm.svg" : "/login/ic-arrow-navy-sm.svg"}
                      width="16"
                      height="16"
                      alt=""
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Checkbox checked={remember} onChange={setRemember}>
          {t("login.rememberChoice")}
        </Checkbox>
      </div>

      <footer className="lg-foot">
        <span>© {new Date().getFullYear()} Yagona App</span>
        <span>{t("login.missingCenter")}</span>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { setHero } = useOutletContext() || {};
  const [identifier, setIdentifier] = useState(() => displayIdentifier(readLastLogin()));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [demoNote, setDemoNote] = useState("");

  useEffect(() => {
    if (!setHero) return;
    if (!pendingAuth) {
      setHero(null);
      return;
    }
    const firstName = pendingAuth.tokens.user?.first_name || userName(pendingAuth.tokens.user);
    setHero({
      title: firstName ? t("login.welcomeBack", { name: firstName }) : t("login.welcomeBackPlain"),
      lead: t("login.pickerLead"),
    });
  }, [pendingAuth, setHero, t, lang]);

  function onIdentifierChange(value) {
    setFieldErrors((prev) => ({ ...prev, identifier: "" }));
    setIdentifier(value ? displayIdentifier(value) : "");
  }

  function validate() {
    const next = {};
    if (!toLoginIdentifier(identifier)) next.identifier = "login.errorIdentifier";
    if (!password) next.password = "login.errorPassword";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function open(result) {
    if (result.mode === APP_MODES.SUPER_ADMIN) navigate("/super", { replace: true });
    else if (result.mode === APP_MODES.STUDENT) navigate("/student", { replace: true });
    else navigate(educationHomePath(result.membership?.tenant_slug), { replace: true });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const auth = await authenticate(toLoginIdentifier(identifier), password);
      writeLastLogin(remember ? toLoginIdentifier(identifier) : "");
      if (needsCenterChoice(auth)) {
        setPendingAuth(auth);
      } else {
        open(startSession(auth));
      }
    } catch (err) {
      setError(loginErrorKey(err) || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (pendingAuth) {
    return (
      <CenterPicker
        auth={pendingAuth}
        onPick={(membership, rememberChoice) => {
          rememberStaffTenant(rememberChoice ? membership.tenant_id : "");
          open(startSession(pendingAuth, membership));
        }}
        onBack={() => {
          clearSession();
          setPendingAuth(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <div className="lg-page">
      <div className="lg-topbar is-end">
        <LanguageSwitch variant="panel" />
      </div>

      <div className="lg-body">
        <span className="lg-logo-tile" aria-hidden="true">
          <img src="/login/logo-tile.svg" width="44" height="44" alt="" />
        </span>
        <h2 className="lg-title">{t("login.title")}</h2>
        <p className="lg-lead">{t("login.lead")}</p>

        <form className="lg-form" onSubmit={submit} noValidate>
          {error ? (
            <div className="lg-alert" role="alert">
              {error.startsWith("login.") ? t(error) : error}
            </div>
          ) : null}

          <div className="lg-field">
            <label htmlFor="lg-identifier">{t("login.identifierLabel")}</label>
            <div className={`lg-input${fieldErrors.identifier ? " has-error" : ""}`}>
              <img src="/login/ic-user.svg" width="18" height="18" alt="" />
              <input
                id="lg-identifier"
                name="identifier"
                value={identifier}
                onChange={(event) => onIdentifierChange(event.target.value)}
                autoComplete="username"
                placeholder="+998 90 123 45 67"
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.identifier)}
                aria-describedby={fieldErrors.identifier ? "lg-identifier-error" : undefined}
              />
            </div>
            {fieldErrors.identifier ? (
              <p className="lg-field-error" id="lg-identifier-error">
                {t(fieldErrors.identifier)}
              </p>
            ) : null}
          </div>

          <div className="lg-field">
            <div className="lg-label-row">
              <label htmlFor="lg-password">{t("login.passwordLabel")}</label>
              <button
                type="button"
                className="lg-link"
                aria-expanded={forgotOpen}
                onClick={() => setForgotOpen((value) => !value)}
              >
                {t("login.forgot")}
              </button>
            </div>
            <div className={`lg-input${fieldErrors.password ? " has-error" : ""}`}>
              <img src="/login/ic-lock-field.svg" width="18" height="18" alt="" />
              <input
                id="lg-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }}
                autoComplete="current-password"
                placeholder={t("login.passwordPlaceholder")}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "lg-password-error" : undefined}
              />
              <button
                type="button"
                className={`lg-eye${showPassword ? " is-on" : ""}`}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")}
                aria-pressed={showPassword}
              >
                <img src="/login/ic-eye.svg" width="18" height="18" alt="" />
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="lg-field-error" id="lg-password-error">
                {t(fieldErrors.password)}
              </p>
            ) : null}
            {forgotOpen ? (
              <p className="lg-hint">{t("login.forgotHint")}</p>
            ) : null}
          </div>

          <Checkbox checked={remember} onChange={setRemember}>
            {t("login.rememberLogin")}
          </Checkbox>

          <button type="submit" className="lg-submit" disabled={busy}>
            {busy ? <span className="lg-spinner" aria-hidden="true" /> : null}
            {busy ? t("login.submitting") : t("login.submit")}
            {busy ? null : <img src="/login/ic-arrow-right.svg" width="18" height="18" alt="" />}
          </button>
        </form>

        <div className="lg-note">
          <img src="/login/ic-shield-note.svg" width="20" height="20" alt="" />
          <p>{t("login.note")}</p>
        </div>

        {/* Demo build: no backend, any login works; these buttons pick a cabinet. */}
        {DEMO_ACCOUNTS.length ? (
          <p className="lg-demo">
            {t("login.demoHint")}
            <br />
            {t("login.demo")}{" "}
            {DEMO_ACCOUNTS.map((demo, index) => (
              <span key={demo.identifier}>
                {index ? " · " : null}
                <button
                  type="button"
                  className="lg-link"
                  onClick={() => {
                    onIdentifierChange(demo.identifier);
                    setPassword(demo.password);
                    setError("");
                    setFieldErrors({});
                  }}
                >
                  {t(demo.label)}
                </button>
              </span>
            ))}
            {" · "}
            <button
              type="button"
              className="lg-link"
              onClick={() => {
                resetDemoData();
                setError("");
                setDemoNote(t("login.demoResetDone"));
              }}
            >
              {t("login.demoReset")}
            </button>
            {demoNote ? (
              <>
                <br />
                {demoNote}
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <footer className="lg-foot">
        <span>© {new Date().getFullYear()} Yagona App</span>
        <span>{t("login.footNote")}</span>
      </footer>
    </div>
  );
}
