import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, Field, PageHeader, PhoneInput } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, getSession, invalidateApiCache, setSession } from "@/services/api/client";
import { currentMembership } from "@/services/auth";
import { formatUzPhone, toApiPhone } from "@/utils/format";
import { t, translated } from "@/i18n";

/* Only settings that change how the reception works. The interface language is switched in
   the sidebar; lesson calendars and notification rules belong to the owner's settings. */
const SECTIONS = [
  { id: "profile", label: "t:aSet.secProfile" },
  { id: "work", label: "t:rxSet.secWork" },
  { id: "center", label: "t:aSet.secCenter" },
  { id: "security", label: "t:aSet.secSecurity" },
].map(translated);

const PAYMENT_METHODS = [
  { value: "cash", label: "t:aSet.cash" },
  { value: "card", label: "t:aSet.card" },
  { value: "bank_transfer", label: "t:aSet.bankTransfer" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
].map(translated);

/* Quick actions of the «Сегодня» screen; ids are the stored keys («find_student» = mark arrival). */
const QUICK_ACTIONS = [
  { id: "visitor", label: "t:aSet.newVisitor" },
  { id: "find_student", label: "t:rxDash.markArrival" },
  { id: "payment", label: "t:aSet.takePayment" },
  { id: "trial", label: "t:aSet.trialLesson" },
  { id: "student", label: "t:rxDash.newStudent" },
].map(translated);

const LEAD_SOURCES = [
  { value: "manual", label: "t:aSet.manualFrontDesk" },
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "t:aSet.website" },
  { value: "other", label: "t:aSet.other" },
].map(translated);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function SaveBar({ saving, disabled, onSave }) {
  return (
    <div className="settings-save-bar">
      <Button type="button" disabled={saving || disabled} onClick={onSave}>
        {saving ? t("aSet.saving") : t("aSet.saveChanges")}
      </Button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const session = useAuth();
  const membership = useMemo(() => currentMembership(session), [session]);
  const tenantId = session.tenantId || "";
  const membershipKey = membership?.id || "";
  const [section, setSection] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [centerForm, setCenterForm] = useState(null);
  const [settings, setSettings] = useState(null);

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    position: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [membershipId, setMembershipId] = useState("");

  const toast = useCallback((message) => {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const liveSession = getSession();
      const live = currentMembership(liveSession);
      const [settingsPayload, me] = await Promise.all([
        api.get("/tenant/settings", { cache: true }),
        api.get("/me", { cache: true }),
      ]);

      setMembershipId(live?.id || "");
      setCenterForm({
        name: settingsPayload.name || "",
        contact_phone: formatUzPhone(settingsPayload.contact_phone || ""),
        contact_phone_secondary: formatUzPhone(settingsPayload.contact_phone_secondary || ""),
        contact_email: settingsPayload.contact_email || "",
        legal_address: settingsPayload.legal_address || "",
        city: settingsPayload.city || "",
        telegram: settingsPayload.telegram || "",
        website: settingsPayload.website || "",
        currency: settingsPayload.currency || "UZS",
        language: settingsPayload.language || "ru",
        timezone: settingsPayload.timezone || "Asia/Tashkent",
      });
      setSettings(clone(settingsPayload.center_settings || {}));
      setProfile({
        first_name: me.first_name || "",
        last_name: me.last_name || "",
        phone: formatUzPhone(me.phone || ""),
        email: me.email || "",
        position: live?.position || t("aSet.administrator"),
      });
    } catch (err) {
      setError(err.message || t("aSet.couldNotLoadSettings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tenantId, membershipKey]);

  function patchSettings(sectionKey, patch) {
    setSettings((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev?.[sectionKey] || {}),
        ...patch,
      },
    }));
  }

  async function saveCenter(fields) {
    setSaving(true);
    setError("");
    try {
      const payload = {};
      fields.forEach((key) => {
        if (String(key).includes("phone")) {
          payload[key] = toApiPhone(centerForm[key]) || null;
        } else {
          payload[key] = centerForm[key];
        }
      });
      await api.patch("/tenant/settings", payload);
      toast(t("aSet.changesSaved"));
    } catch (err) {
      setError(err.message || t("aSet.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function saveWork() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch("/tenant/settings", {
        center_settings: {
          reception: settings.reception,
          education: settings.education,
          finance: settings.finance,
        },
      });
      setSettings(clone(updated.center_settings || {}));
      invalidateApiCache(tenantId);
      toast(t("aSet.changesSaved"));
    } catch (err) {
      setError(err.message || t("aSet.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    try {
      const me = await api.patch("/me", {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        phone: toApiPhone(profile.phone),
        email: profile.email.trim() || "",
      });
      if (membershipId && profile.position.trim()) {
        try {
          await api.patch(`/staff/${membershipId}`, {
            position: profile.position.trim(),
          });
        } catch {
          // position update is best-effort if staff write is restricted
        }
      }
      setSession({
        user: {
          ...(session.user || {}),
          ...me,
          name: me.name || [me.first_name, me.last_name].filter(Boolean).join(" "),
        },
      });
      toast(t("aSet.profileSaved"));
    } catch (err) {
      setError(err.message || t("aSet.couldNotSaveThe"));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) {
      setError(t("aSet.theNewPasswordAnd"));
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setError(t("aSet.theNewPasswordMust"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/me/password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm: "" });
      toast(t("aSet.passwordUpdated"));
    } catch (err) {
      setError(err.message || t("aSet.couldNotChangeThe"));
    } finally {
      setSaving(false);
    }
  }

  const edu = settings?.education || {};
  const fin = settings?.finance || {};
  const reception = settings?.reception || {};

  const content = useMemo(() => {
    if (!centerForm || !settings) return null;

    if (section === "profile") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("aSet.secProfile")}</h2>
            <p className="muted">{t("aSet.yourDetailsForFront")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("aSet.firstName")}>
              <input
                value={profile.first_name}
                onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.lastName")}>
              <input
                value={profile.last_name}
                onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.phone")}>
              <PhoneInput
                value={profile.phone}
                onChange={(phone) => setProfile((p) => ({ ...p, phone }))}
              />
            </Field>
            <Field label="Email">
              <input
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.position")}>
              <input
                value={profile.position}
                onChange={(e) => setProfile((p) => ({ ...p, position: e.target.value }))}
              />
            </Field>
          </div>
          <SaveBar saving={saving} onSave={saveProfile} />
        </section>
      );
    }

    if (section === "center") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("aSet.secCenter")}</h2>
            <p className="muted">{t("aSet.contactsAndAddressFor")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("aSet.name")}>
              <input
                value={centerForm.name}
                onChange={(e) => setCenterForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.city")}>
              <input
                value={centerForm.city}
                onChange={(e) => setCenterForm((p) => ({ ...p, city: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.mainPhone")}>
              <PhoneInput
                value={centerForm.contact_phone}
                onChange={(phone) => setCenterForm((p) => ({ ...p, contact_phone: phone }))}
              />
            </Field>
            <Field label={t("aSet.additionalPhone")}>
              <PhoneInput
                value={centerForm.contact_phone_secondary}
                onChange={(phone) =>
                  setCenterForm((p) => ({ ...p, contact_phone_secondary: phone }))
                }
              />
            </Field>
            <Field label="Email">
              <input
                value={centerForm.contact_email}
                onChange={(e) => setCenterForm((p) => ({ ...p, contact_email: e.target.value }))}
              />
            </Field>
            <Field label="Telegram">
              <input
                value={centerForm.telegram}
                onChange={(e) => setCenterForm((p) => ({ ...p, telegram: e.target.value }))}
              />
            </Field>
            <Field label="Website">
              <input
                value={centerForm.website}
                onChange={(e) => setCenterForm((p) => ({ ...p, website: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.address")}>
              <input
                value={centerForm.legal_address}
                onChange={(e) => setCenterForm((p) => ({ ...p, legal_address: e.target.value }))}
              />
            </Field>
            <Field label={t("aSet.timeZone")}>
              <input readOnly value={centerForm.timezone} />
            </Field>
          </div>
          <SaveBar
            saving={saving}
            onSave={() =>
              saveCenter([
                "name",
                "city",
                "contact_phone",
                "contact_phone_secondary",
                "contact_email",
                "telegram",
                "website",
                "legal_address",
              ])
            }
          />
        </section>
      );
    }

    if (section === "work") {
      const actions = new Set(reception.quick_actions || []);
      const allowed = new Set(fin.allowed_payment_methods || []);
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("rxSet.secWork")}</h2>
            <p className="muted">{t("rxSet.workSub")}</p>
          </header>

          <h3 className="settings-subhead">{t("aSet.newVisitor")}</h3>
          <div className="settings-form-grid">
            <Field label={t("aSet.defaultSource")}>
              <select
                value={reception.default_lead_source || "manual"}
                onChange={(e) => patchSettings("reception", { default_lead_source: e.target.value })}
              >
                {LEAD_SOURCES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("rxSet.noShowCallback")}>
              <select
                value={reception.default_followup_days ?? 1}
                onChange={(e) => patchSettings("reception", { default_followup_days: Number(e.target.value) })}
              >
                <option value={1}>{t("aSet.n1Day")}</option>
                <option value={3}>{t("aSet.n3Days")}</option>
                <option value={7}>{t("aSet.n7Days")}</option>
              </select>
            </Field>
          </div>
          <div className="settings-check-list">
            <label>
              <input
                type="checkbox"
                checked={reception.warn_duplicate_phone !== false}
                onChange={(e) => patchSettings("reception", { warn_duplicate_phone: e.target.checked })}
              />
              {t("aSet.warnWhenThePhone")}
            </label>
          </div>

          <h3 className="settings-subhead">{t("aSet.trialLesson")}</h3>
          <div className="settings-form-grid">
            <Field label={t("aSet.trialLessonLengthMin")}>
              <input
                type="number"
                min={15}
                step={15}
                value={edu.trial_lesson_duration_minutes ?? 60}
                onChange={(e) =>
                  patchSettings("education", { trial_lesson_duration_minutes: Number(e.target.value) || 60 })
                }
              />
            </Field>
          </div>

          <h3 className="settings-subhead">{t("aSet.secPayments")}</h3>
          <div className="settings-form-grid">
            <Field label={t("aSet.defaultPaymentMethod")}>
              <select
                value={fin.default_payment_method || "cash"}
                onChange={(e) => patchSettings("finance", { default_payment_method: e.target.value })}
              >
                {PAYMENT_METHODS.filter((item) => allowed.has(item.value)).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <span className="field-label">{t("aSet.allowedPaymentMethods")}</span>
          <div className="settings-check-list">
            {PAYMENT_METHODS.map((item) => (
              <label key={item.value}>
                <input
                  type="checkbox"
                  checked={allowed.has(item.value)}
                  disabled={allowed.size === 1 && allowed.has(item.value)}
                  onChange={(e) => {
                    const next = new Set(allowed);
                    if (e.target.checked) next.add(item.value);
                    else next.delete(item.value);
                    const patch = { allowed_payment_methods: [...next] };
                    if (!next.has(fin.default_payment_method)) patch.default_payment_method = [...next][0];
                    patchSettings("finance", patch);
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>

          <h3 className="settings-subhead">{t("aSet.quickActionsOnThe")}</h3>
          <div className="settings-check-list">
            {QUICK_ACTIONS.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={actions.has(item.id)}
                  onChange={(e) => {
                    const next = new Set(actions);
                    if (e.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    patchSettings("reception", { quick_actions: [...next] });
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>

          <SaveBar saving={saving} onSave={saveWork} />
        </section>
      );
    }

    if (section === "security") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("aSet.secSecurity")}</h2>
            <p className="muted">{t("aSet.onlyYourAccount")}</p>
          </header>
          <div className="settings-readonly-box">
            <p>
              {t("aSet.login")} <strong>{profile.email || profile.phone || "—"}</strong>
            </p>
            <p className="muted">{t("aSet.sessionsOnOtherDevices")}</p>
          </div>
          <form className="settings-form-grid" onSubmit={changePassword}>
            <Field label={t("aSet.currentPassword")}>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, current_password: e.target.value }))
                }
                required
              />
            </Field>
            <Field label={t("aSet.newPassword")}>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, new_password: e.target.value }))
                }
                required
              />
            </Field>
            <Field label={t("aSet.confirmation")}>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </Field>
            <div className="settings-save-bar settings-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("aSet.saving") : t("aSet.changePassword")}
              </Button>
            </div>
          </form>
        </section>
      );
    }

    return null;
  }, [
    section,
    centerForm,
    settings,
    profile,
    passwordForm,
    saving,
    membership,
    edu,
    fin,
    reception,
  ]);

  return (
    <div className="settings-page admin-settings-page">
      <PageHeader
        title={t("aSet.settings")}
        subtitle={t("aSet.frontDeskAndProfile")}
      />
      {error ? <Banner>{error}</Banner> : null}
      {info ? <div className="settings-toast">{info}</div> : null}
      {loading ? <p className="muted">{t("aSet.loading")}</p> : null}

      {!loading && centerForm && settings ? (
        <div className="settings-layout">
          <nav className="settings-nav" aria-label={t("aSet.settingsSections")}>
            <select
              className="settings-nav-select"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ul className="settings-nav-list">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`settings-nav-item${section === item.id ? " is-active" : ""}`}
                    onClick={() => setSection(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="settings-content">{content}</div>
        </div>
      ) : null}
    </div>
  );
}
