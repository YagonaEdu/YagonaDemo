import { lazy, Suspense } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banner, Button, Field } from "@/components/ui";
import { t } from "@/i18n";
import PageFallback from "@/components/layout/PageFallback";
import { CYCLE_LABELS, LICENSE_LABELS, ROLE_LABELS } from "@/constants";
import { api, getSession } from "@/services/api/client";
import { currentMembership } from "@/services/auth";
import { formatDate, money } from "@/utils/format";
import { isAdminRole } from "@/utils/roleAccess";
import { educationSegmentPath } from "@/utils/routes";

const AdminSettingsPage = lazy(() => import("./resepshen_yagona/AdminSettingsPage"));

const ALL_SECTIONS = [
  { id: "plan", label: "owSet.sPlan" },
  { id: "documents", label: "owSet.sDocuments" },
  { id: "general", label: "owSet.sGeneral" },
  { id: "branding", label: "owSet.sBranding" },
  { id: "contacts", label: "owSet.sContacts" },
  { id: "education", label: "owSet.sEducation" },
  { id: "finance", label: "owSet.sFinance" },
  { id: "notifications", label: "owSet.sNotifications" },
  { id: "roles", label: "owSet.sRoles" },
  { id: "integrations", label: "owSet.sIntegrations" },
  { id: "security", label: "owSet.sSecurity" },
];
/* The accountant reads the centre card and changes only their own password. */
const ACCOUNTANT_SECTIONS = ["general", "contacts", "security"];

const PLAN_STATUS_KEYS = {
  expiring_soon: "owSet.stExpiring",
  active: "owSet.stActive",
  trial: "owSet.stTrial",
  expired: "owSet.stExpired",
  suspended: "owSet.stSuspended",
};

function planStatusLabel(status) {
  if (PLAN_STATUS_KEYS[status]) return t(PLAN_STATUS_KEYS[status]);
  return LICENSE_LABELS[status] || status || "—";
}

/* Stored as ISO weekdays (1 = Monday); labels come from the shared "week.days" list (0 = Monday). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const NOTIF_CATEGORIES = [
  ["payment", "owSet.nPayment"],
  ["debt", "owSet.nDebt"],
  ["attendance", "owSet.nAttendance"],
  ["schedule", "owSet.nSchedule"],
  ["crm", "owSet.nCrm"],
  ["students", "owSet.nStudents"],
  ["staff", "owSet.nStaff"],
  ["system", "owSet.nSystem"],
];

const ROLE_CAPS = [
  ["can_manage_students", "owSet.nStudents"],
  ["can_manage_crm", "owSet.nCrm"],
  ["can_manage_billing", "owSet.cBilling"],
  ["can_edit_attendance", "owSet.nAttendance"],
  ["can_send_notifications", "owSet.sNotifications"],
  ["can_manage_staff", "owSet.nStaff"],
  ["can_manage_settings", "owSet.cSettings"],
];

const EMPTY_SETTINGS = {
  education: {
    default_lesson_duration_minutes: 90,
    default_group_capacity: 12,
    working_days: [1, 2, 3, 4, 5, 6],
    working_hours_start: "09:00",
    working_hours_end: "21:00",
  },
  finance: {
    payment_due_day: 10,
    grace_period_days: 5,
    debt_warning_threshold: 0,
    default_payment_method: "cash",
    payment_reminder_days: 3,
  },
  notifications: {
    payment: true,
    debt: true,
    attendance: true,
    schedule: true,
    crm: true,
    students: true,
    staff: true,
    system: true,
    channel_in_app: true,
    channel_push: true,
    channel_email: false,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function SettingsPage() {
  const session = getSession();
  const membership = currentMembership(session);
  if (isAdminRole(membership?.role)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <AdminSettingsPage />
      </Suspense>
    );
  }
  return <OwnerSettingsPage />;
}

function OwnerSettingsPage() {
  const session = getSession();
  const membership = currentMembership(session);
  const canEdit = membership?.role === "owner";
  const SECTIONS =
    membership?.role === "accountant"
      ? ALL_SECTIONS.filter((item) => ACCOUNTANT_SECTIONS.includes(item.id))
      : ALL_SECTIONS;
  const navigate = useNavigate();
  const { slug } = useParams();

  const [section, setSection] = useState(() => SECTIONS[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.get("/tenant/settings");
      setData(payload);
      setForm({
        name: payload.name || "",
        short_name: payload.short_name || "",
        description: payload.description || "",
        language: payload.language || "ru",
        timezone: payload.timezone || "Asia/Tashkent",
        currency: payload.currency || "UZS",
        primary_color: payload.primary_color || "#2563eb",
        secondary_color: payload.secondary_color || "#0d9488",
        contact_phone: payload.contact_phone || "",
        contact_phone_secondary: payload.contact_phone_secondary || "",
        contact_email: payload.contact_email || "",
        telegram: payload.telegram || "",
        website: payload.website || "",
        legal_name: payload.legal_name || "",
        legal_address: payload.legal_address || "",
        city: payload.city || "",
        stir: payload.stir || "",
        director_name: payload.director_name || "",
        contract_number: payload.contract_number || "",
        contract_signed_on: payload.contract_signed_on || "",
        center_settings: clone(payload.center_settings || EMPTY_SETTINGS),
      });
      setLogoFile(null);
    } catch (err) {
      setError(err.message || t("owSet.errLoad"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toast(message) {
    setInfo(message);
    window.setTimeout(() => setInfo(""), 3500);
  }

  function patchForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function patchSettings(sectionKey, patch) {
    setForm((prev) => ({
      ...prev,
      center_settings: {
        ...prev.center_settings,
        [sectionKey]: {
          ...prev.center_settings[sectionKey],
          ...patch,
        },
      },
    }));
  }

  async function saveSection(keys, settingsSection) {
    if (!canEdit || !form) return;
    setSaving(true);
    setError("");
    try {
      let payload;
      if (section === "branding" && logoFile) {
        payload = new FormData();
        keys.forEach((key) => {
          if (form[key] != null) payload.append(key, form[key]);
        });
        payload.append("logo", logoFile);
      } else if (settingsSection) {
        payload = {
          center_settings: {
            [settingsSection]: form.center_settings[settingsSection],
          },
        };
      } else {
        payload = {};
        keys.forEach((key) => {
          payload[key] = form[key];
        });
      }
      const updated = await api.patch("/tenant/settings", payload);
      setData(updated);
      setForm((prev) => ({
        ...prev,
        name: updated.name || "",
        short_name: updated.short_name || "",
        description: updated.description || "",
        language: updated.language || "ru",
        timezone: updated.timezone || "Asia/Tashkent",
        currency: updated.currency || "UZS",
        primary_color: updated.primary_color || "#2563eb",
        secondary_color: updated.secondary_color || "#0d9488",
        contact_phone: updated.contact_phone || "",
        contact_phone_secondary: updated.contact_phone_secondary || "",
        contact_email: updated.contact_email || "",
        telegram: updated.telegram || "",
        website: updated.website || "",
        legal_name: updated.legal_name || "",
        legal_address: updated.legal_address || "",
        city: updated.city || "",
        stir: updated.stir || "",
        director_name: updated.director_name || "",
        contract_number: updated.contract_number || "",
        contract_signed_on: updated.contract_signed_on || "",
        center_settings: clone(updated.center_settings || EMPTY_SETTINGS),
      }));
      setLogoFile(null);
      toast(t("owSet.infoSaved"));
    } catch (err) {
      setError(err.message || t("owSet.errSave"));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) {
      setError(t("owSet.errMismatch"));
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setError(t("owSet.errShort"));
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
      toast(t("owSet.infoPassword"));
    } catch (err) {
      setError(err.message || t("owSet.errPassword"));
    } finally {
      setSaving(false);
    }
  }

  async function resetBranding() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.post("/tenant/settings/reset-branding", {});
      setData(updated);
      patchForm({
        primary_color: updated.primary_color || "#2563eb",
        secondary_color: updated.secondary_color || "#0d9488",
      });
      setLogoFile(null);
      setResetOpen(false);
      toast(t("owSet.infoBrandReset"));
    } catch (err) {
      setError(err.message || t("owSet.errBrandReset"));
    } finally {
      setSaving(false);
    }
  }

  const previewName = form?.short_name || form?.name || t("owSet.centre");
  const logoPreview = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    return data?.logo_url || null;
  }, [logoFile, data?.logo_url]);

  useEffect(() => {
    if (!logoFile || !logoPreview) return undefined;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoFile, logoPreview]);

  function SaveBar({ onSave }) {
    if (!canEdit) {
      return <p className="muted settings-readonly">{t("owSet.readOnly")}</p>;
    }
    return (
      <div className="settings-save-bar">
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? t("owFin.saving") : t("owSet.saveChanges")}
        </Button>
      </div>
    );
  }

  function renderSection() {
    if (!form) return null;
    const edu = form.center_settings.education;
    const fin = form.center_settings.finance;
    const notif = form.center_settings.notifications;
    const sub = data?.subscription;
    const docs = data?.documents || [];

    if (section === "plan") {
      const cycleLabel =
        sub?.billing_cycle === "monthly"
          ? t("owSet.cycleMonth")
          : sub?.billing_cycle === "yearly"
            ? t("owSet.cycleYear")
            : CYCLE_LABELS[sub?.billing_cycle] || sub?.billing_cycle;
      const statusClass = `settings-plan-status status-${sub?.status || "active"}`;
      return (
        <section className="settings-panel settings-plan-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sPlan")}</h2>
            <p className="muted">{t("owSet.planHint")}</p>
          </header>

          {sub?.status === "expiring_soon" && sub?.days_left != null ? (
            <div className="settings-plan-banner is-warn">
              {t("owSet.licenseEnds", { days: sub.days_left, date: formatDate(sub.licensed_until) })}
            </div>
          ) : null}
          {sub?.status === "expired" ? (
            <div className="settings-plan-banner is-danger">
              {t("owSet.licenseExpired", { date: sub.licensed_until ? formatDate(sub.licensed_until) : "—" })}
            </div>
          ) : null}
          {sub?.status === "suspended" ? (
            <div className="settings-plan-banner is-danger">{t("owSet.suspended")}</div>
          ) : null}

          <div className="settings-plan-card">
            <div className="settings-plan-card-top">
              <div>
                <p className="settings-plan-eyebrow">{t("owSet.planCurrent")}</p>
                <h3>{sub?.plan_name || "—"}</h3>
                {sub?.plan_description ? <p className="muted">{sub.plan_description}</p> : null}
              </div>
              <span className={statusClass}>{planStatusLabel(sub?.status)}</span>
            </div>
            <div className="settings-plan-price">
              <strong>{money(sub?.monthly_price, "UZS")}</strong>
              <span>/ {cycleLabel || t("owSet.cyclePeriod")}</span>
            </div>
            <dl className="settings-plan-meta">
              <div>
                <dt>{t("owSet.planStart")}</dt>
                <dd>{sub?.licensed_from ? formatDate(sub.licensed_from) : "—"}</dd>
              </div>
              <div>
                <dt>{t("owSet.planNext")}</dt>
                <dd>{sub?.next_payment_date ? formatDate(sub.next_payment_date) : "—"}</dd>
              </div>
              <div>
                <dt>{t("owSet.planEnd")}</dt>
                <dd>{sub?.licensed_until ? formatDate(sub.licensed_until) : "—"}</dd>
              </div>
              <div>
                <dt>{t("owSet.planLicense")}</dt>
                <dd>{planStatusLabel(sub?.license_status)}</dd>
              </div>
            </dl>
            <div className="settings-plan-actions">
              <Button type="button" variant="secondary" onClick={() => setSection("documents")}>
                {t("owSet.viewContract")}
              </Button>
              <a className="btn btn-primary" href="mailto:support@yagona.uz">
                {t("owSet.contactYagona")}
              </a>
            </div>
          </div>

          <div className="settings-plan-grid">
            <div className="settings-plan-block">
              <h3>{t("owSet.usage")}</h3>
              <div className="settings-usage-list">
                <div className="settings-usage-row">
                  <div>
                    <strong>{t("owSet.nStudents")}</strong>
                    <span className="muted">{t("owSet.usageActive")}</span>
                  </div>
                  <strong>{data?.usage?.students?.count ?? "—"}</strong>
                </div>
                <div className="settings-usage-row">
                  <div>
                    <strong>{t("owSet.nStaff")}</strong>
                    <span className="muted">{t("owSet.usageStaffHint")}</span>
                  </div>
                  <strong>{data?.usage?.staff?.count ?? "—"}</strong>
                </div>
              </div>
              <p className="muted settings-usage-note">{t("owSet.usageNote")}</p>
            </div>
            <div className="settings-plan-block">
              <h3>{t("owSet.features")}</h3>
              <ul className="settings-feature-list">
                {(sub?.features || []).map((item) => (
                  <li key={item.key} className={item.included ? "is-on" : "is-off"}>
                    <span>{item.included ? "✓" : "—"}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="settings-plan-block">
            <h3>{t("owSet.historyTitle")}</h3>
            <p className="muted">{t("owSet.historyNote")}</p>
          </div>
        </section>
      );
    }

    if (section === "documents") {
      const contractDoc = docs.find((item) => item.kind === "contract");
      const daysLeft = sub?.days_left;
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sDocuments")}</h2>
            <p className="muted">{t("owSet.docsHint")}</p>
          </header>

          {sub?.licensed_until ? (
            <div
              className={`settings-plan-banner${
                sub.status === "expired" || sub.status === "expiring_soon" ? " is-warn" : ""
              }`}
            >
              {sub.status === "expired"
                ? t("owSet.contractExpired", { date: formatDate(sub.licensed_until) })
                : daysLeft != null && daysLeft <= 14
                  ? t("owSet.contractEnds", { days: daysLeft, date: formatDate(sub.licensed_until) })
                  : t("owSet.contractValid", { date: formatDate(sub.licensed_until) })}
            </div>
          ) : null}

          <div className="settings-contract-summary">
            <div>
              <span className="muted">{t("owSet.contractNo")}</span>
              <strong>{form.contract_number || "—"}</strong>
            </div>
            <div>
              <span className="muted">{t("owSet.contractDate")}</span>
              <strong>{form.contract_signed_on ? formatDate(form.contract_signed_on) : "—"}</strong>
            </div>
            <div>
              <span className="muted">{t("owSet.legalEntity")}</span>
              <strong>{form.legal_name || "—"}</strong>
            </div>
            <div>
              <span className="muted">{t("owSet.inn")}</span>
              <strong>{form.stir || "—"}</strong>
            </div>
            <div>
              <span className="muted">{t("owSet.responsible")}</span>
              <strong>{form.director_name || "—"}</strong>
            </div>
            <div>
              <span className="muted">{t("owSet.licensePeriod")}</span>
              <strong>
                {sub?.licensed_from ? formatDate(sub.licensed_from) : "—"}
                {" — "}
                {sub?.licensed_until ? formatDate(sub.licensed_until) : "—"}
              </strong>
            </div>
          </div>

          <div className="settings-doc-actions">
            {contractDoc?.file_url ? (
              <a className="btn btn-primary" href={contractDoc.file_url} target="_blank" rel="noreferrer">
                {t("owSet.openContract")}
              </a>
            ) : (
              <p className="muted">{t("owSet.noContract")}</p>
            )}
          </div>

          <h3 className="settings-subhead">{t("owSet.docs")}</h3>
          {!docs.length ? (
            <p className="muted">{t("owSet.noDocs")}</p>
          ) : (
            <div className="settings-doc-table-wrap">
              <table className="settings-doc-table">
                <thead>
                  <tr>
                    <th>{t("owSet.doc")}</th>
                    <th>{t("owSet.docType")}</th>
                    <th>{t("owSet.docDate")}</th>
                    <th>{t("owSet.docAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.title}</td>
                      <td>{doc.kind_label}</td>
                      <td>{doc.created_at ? formatDate(doc.created_at) : "—"}</td>
                      <td>
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            {t("owSet.download")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit ? (
            <>
              <h3 className="settings-subhead">{t("owSet.contractDetails")}</h3>
              <div className="settings-form-grid">
                <Field label={t("owSet.contractNo")}>
                  <input
                    value={form.contract_number}
                    onChange={(e) => patchForm({ contract_number: e.target.value })}
                  />
                </Field>
                <Field label={t("owSet.contractDate")}>
                  <input
                    type="date"
                    value={form.contract_signed_on || ""}
                    onChange={(e) => patchForm({ contract_signed_on: e.target.value })}
                  />
                </Field>
              </div>
              <SaveBar onSave={() => saveSection(["contract_number", "contract_signed_on"])} />
            </>
          ) : null}
        </section>
      );
    }

    if (section === "general") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sGeneral")}</h2>
            <p className="muted">{t("owSet.generalHint")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("owSet.name")}>
              <input
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => patchForm({ name: e.target.value })}
              />
            </Field>
            <Field label={t("owSet.shortName")}>
              <input
                value={form.short_name}
                disabled={!canEdit}
                onChange={(e) => patchForm({ short_name: e.target.value })}
              />
            </Field>
            <div className="settings-span-2">
              <Field label={t("owSet.description")}>
                <textarea
                  rows={3}
                  value={form.description}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ description: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("owSet.language")}>
              <select
                value={form.language}
                disabled={!canEdit}
                onChange={(e) => patchForm({ language: e.target.value })}
              >
                <option value="ru">Русский</option>
                <option value="uz">Oʻzbekcha</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={t("owSet.timezone")}>
              <select
                value={form.timezone}
                disabled={!canEdit}
                onChange={(e) => patchForm({ timezone: e.target.value })}
              >
                <option value="Asia/Tashkent">Asia/Tashkent</option>
                <option value="Asia/Samarkand">Asia/Samarkand</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label={t("owSet.currency")}>
              <select
                value={form.currency}
                disabled={!canEdit}
                onChange={(e) => patchForm({ currency: e.target.value })}
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
          </div>

          <h3 className="settings-subhead">{t("owSet.legalInfo")}</h3>
          <div className="settings-form-grid">
            <Field label={t("owSet.legalName")}>
              <input
                value={form.legal_name}
                disabled={!canEdit}
                onChange={(e) => patchForm({ legal_name: e.target.value })}
              />
            </Field>
            <Field label={t("owSet.stir")}>
              <input
                value={form.stir}
                disabled={!canEdit}
                onChange={(e) => patchForm({ stir: e.target.value })}
              />
            </Field>
            <div className="settings-span-2">
              <Field label={t("owSet.legalAddress")}>
                <input
                  value={form.legal_address}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ legal_address: e.target.value })}
                />
              </Field>
            </div>
            <div className="settings-span-2">
              <Field label={t("owSet.director")}>
                <input
                  value={form.director_name}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ director_name: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {data?.owner ? (
            <div className="settings-owner-card">
              <h3>{t("owSet.ownerCard")}</h3>
              <dl>
                <div>
                  <dt>{t("owSet.ownerName")}</dt>
                  <dd>{data.owner.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{data.owner.email || "—"}</dd>
                </div>
                <div>
                  <dt>{t("owSet.phone")}</dt>
                  <dd>{data.owner.phone || "—"}</dd>
                </div>
                <div>
                  <dt>{t("owSet.role")}</dt>
                  <dd>{ROLE_LABELS[data.owner.role] || data.owner.role}</dd>
                </div>
                <div>
                  <dt>{t("owSet.status")}</dt>
                  <dd>{data.owner.is_active ? t("owStaff.active") : t("owStaff.inactive")}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <SaveBar
            onSave={() =>
              saveSection([
                "name",
                "short_name",
                "description",
                "language",
                "timezone",
                "currency",
                "legal_name",
                "stir",
                "legal_address",
                "director_name",
              ])
            }
          />
        </section>
      );
    }

    if (section === "branding") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sBranding")}</h2>
            <p className="muted">{t("owSet.brandingHint")}</p>
          </header>
          <div className="settings-branding-layout">
            <div className="settings-form-grid">
              <div className="settings-span-2">
                <Field label={t("owSet.logo")}>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canEdit}
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </Field>
              </div>
              <Field label={t("owSet.primary")}>
                <div className="settings-color-row">
                  <input
                    type="color"
                    value={form.primary_color || "#2563eb"}
                    disabled={!canEdit}
                    onChange={(e) => patchForm({ primary_color: e.target.value })}
                  />
                  <input
                    value={form.primary_color}
                    disabled={!canEdit}
                    onChange={(e) => patchForm({ primary_color: e.target.value })}
                  />
                </div>
              </Field>
              <Field label={t("owSet.secondary")}>
                <div className="settings-color-row">
                  <input
                    type="color"
                    value={form.secondary_color || "#0d9488"}
                    disabled={!canEdit}
                    onChange={(e) => patchForm({ secondary_color: e.target.value })}
                  />
                  <input
                    value={form.secondary_color}
                    disabled={!canEdit}
                    onChange={(e) => patchForm({ secondary_color: e.target.value })}
                  />
                </div>
              </Field>
            </div>
            <div
              className="settings-brand-preview"
              style={{
                "--preview-primary": form.primary_color || "#2563eb",
                "--preview-secondary": form.secondary_color || "#0d9488",
              }}
            >
              <div className="settings-brand-preview-bar">
                {logoPreview ? <img src={logoPreview} alt="" /> : <span className="settings-brand-mark">Y</span>}
                <strong>{previewName}</strong>
              </div>
              <p>{t("owSet.preview")}</p>
              <button type="button" className="settings-brand-preview-cta">
                {t("owSet.previewButton")}
              </button>
            </div>
          </div>
          <SaveBar onSave={() => saveSection(["primary_color", "secondary_color"])} />
          {canEdit ? (
            <div className="settings-danger">
              <h3>{t("owSet.resetTitle")}</h3>
              <p className="muted">{t("owSet.resetHint")}</p>
              <Button type="button" variant="secondary" onClick={() => setResetOpen(true)}>
                {t("owSet.resetBrand")}
              </Button>
            </div>
          ) : null}
        </section>
      );
    }

    if (section === "contacts") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sContacts")}</h2>
            <p className="muted">{t("owSet.contactsHint")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("owSet.phoneMain")}>
              <input
                value={form.contact_phone}
                disabled={!canEdit}
                onChange={(e) => patchForm({ contact_phone: e.target.value })}
              />
            </Field>
            <Field label={t("owSet.phoneExtra")}>
              <input
                value={form.contact_phone_secondary}
                disabled={!canEdit}
                onChange={(e) => patchForm({ contact_phone_secondary: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.contact_email}
                disabled={!canEdit}
                onChange={(e) => patchForm({ contact_email: e.target.value })}
              />
            </Field>
            <Field label="Telegram">
              <input
                placeholder="@username"
                value={form.telegram}
                disabled={!canEdit}
                onChange={(e) => patchForm({ telegram: e.target.value })}
              />
            </Field>
            <div className="settings-span-2">
              <Field label={t("owSet.website")}>
                <input
                  placeholder="https://"
                  value={form.website}
                  disabled={!canEdit}
                  onChange={(e) => patchForm({ website: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("owSet.city")}>
              <input
                value={form.city}
                disabled={!canEdit}
                onChange={(e) => patchForm({ city: e.target.value })}
              />
            </Field>
          </div>
          <SaveBar
            onSave={() =>
              saveSection([
                "contact_phone",
                "contact_phone_secondary",
                "contact_email",
                "telegram",
                "website",
                "city",
              ])
            }
          />
        </section>
      );
    }

    if (section === "education") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sEducation")}</h2>
            <p className="muted">{t("owSet.educationHint")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("owSet.lessonMinutes")}>
              <input
                type="number"
                min={15}
                max={300}
                value={edu.default_lesson_duration_minutes}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("education", {
                    default_lesson_duration_minutes: Number(e.target.value) || 90,
                  })
                }
              />
            </Field>
            <Field label={t("owSet.groupCapacity")}>
              <input
                type="number"
                min={1}
                max={100}
                value={edu.default_group_capacity}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("education", {
                    default_group_capacity: Number(e.target.value) || 12,
                  })
                }
              />
            </Field>
            <Field label={t("owSet.dayStart")}>
              <input
                type="time"
                value={edu.working_hours_start}
                disabled={!canEdit}
                onChange={(e) => patchSettings("education", { working_hours_start: e.target.value })}
              />
            </Field>
            <Field label={t("owSet.dayEnd")}>
              <input
                type="time"
                value={edu.working_hours_end}
                disabled={!canEdit}
                onChange={(e) => patchSettings("education", { working_hours_end: e.target.value })}
              />
            </Field>
            <div className="settings-span-2">
              <p className="settings-field-label">{t("owSet.workDays")}</p>
              <div className="settings-weekday-row">
                {WEEKDAYS.map((day) => {
                  const active = (edu.working_days || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!canEdit}
                      className={`settings-weekday${active ? " is-active" : ""}`}
                      onClick={() => {
                        const set = new Set(edu.working_days || []);
                        if (set.has(day)) set.delete(day);
                        else set.add(day);
                        patchSettings("education", {
                          working_days: [...set].sort((a, b) => a - b),
                        });
                      }}
                    >
                      {t("week.days").split(",")[day - 1]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <SaveBar onSave={() => saveSection([], "education")} />
        </section>
      );
    }

    if (section === "finance") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sFinance")}</h2>
            <p className="muted">{t("owSet.financeHint")}</p>
          </header>
          <div className="settings-form-grid">
            <Field label={t("owSet.centreCurrency")}>
              <input value={form.currency} disabled />
            </Field>
            <Field label={t("owSet.dueDay")}>
              <input
                type="number"
                min={1}
                max={28}
                value={fin.payment_due_day}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("finance", { payment_due_day: Number(e.target.value) || 10 })
                }
              />
            </Field>
            <Field label={t("owSet.graceDays")}>
              <input
                type="number"
                min={0}
                max={60}
                value={fin.grace_period_days}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("finance", { grace_period_days: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label={t("owSet.debtThreshold")}>
              <input
                type="number"
                min={0}
                value={fin.debt_warning_threshold}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("finance", {
                    debt_warning_threshold: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
            <Field label={t("owSet.defaultMethod")}>
              <select
                value={fin.default_payment_method}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("finance", { default_payment_method: e.target.value })
                }
              >
                <option value="cash">{t("owSet.mCash")}</option>
                <option value="card">{t("owSet.mCard")}</option>
                <option value="transfer">{t("owSet.mTransfer")}</option>
              </select>
            </Field>
            <Field label={t("owSet.reminderDays")}>
              <input
                type="number"
                min={0}
                max={30}
                value={fin.payment_reminder_days ?? 3}
                disabled={!canEdit}
                onChange={(e) =>
                  patchSettings("finance", {
                    payment_reminder_days: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
          </div>
          <SaveBar onSave={() => saveSection([], "finance")} />
        </section>
      );
    }

    if (section === "notifications") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sNotifications")}</h2>
            <p className="muted">{t("owSet.notifHint")}</p>
          </header>
          <div className="settings-toggle-list">
            {NOTIF_CATEGORIES.map(([key, label]) => (
              <label key={key} className="settings-toggle-row">
                <span>{t(label)}</span>
                <input
                  type="checkbox"
                  checked={Boolean(notif[key])}
                  disabled={!canEdit}
                  onChange={(e) => patchSettings("notifications", { [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
          <h3 className="settings-subhead">{t("owSet.channels")}</h3>
          <div className="settings-toggle-list">
            {[
              ["channel_in_app", t("owSet.chInApp")],
              ["channel_push", "Push"],
              ["channel_email", "Email"],
            ].map(([key, label]) => (
              <label key={key} className="settings-toggle-row">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(notif[key])}
                  disabled={!canEdit}
                  onChange={(e) => patchSettings("notifications", { [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
          <SaveBar onSave={() => saveSection([], "notifications")} />
        </section>
      );
    }

    if (section === "roles") {
      const overview = data?.role_overview || [];
      const staffPath = educationSegmentPath(slug, "staff");
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sRoles")}</h2>
            <p className="muted">{t("owSet.rolesIntro")}</p>
          </header>

          <div className="settings-roles-current">
            <div className="settings-roles-you">
              <span>{t("owSet.yourRole")}</span>
              <strong>{ROLE_LABELS[membership?.role] || membership?.role || "—"}</strong>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(staffPath)}
            >
              {t("owSet.manageTeam")}
            </Button>
          </div>

          <div className="settings-role-table-wrap">
            <table className="settings-role-table">
              <thead>
                <tr>
                  <th>{t("owSet.role")}</th>
                  {ROLE_CAPS.map(([key, label]) => (
                    <th key={key}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.map((row) => (
                  <tr key={row.role}>
                    <td>
                      <strong>{ROLE_LABELS[row.role] || row.label}</strong>
                    </td>
                    {ROLE_CAPS.map(([key]) => (
                      <td key={key} className={row[key] ? "role-cap-yes" : "role-cap-no"}>
                        {row[key] ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="settings-roles-hint">
            <p>{t("owSet.rolesHint")}</p>
          </div>
        </section>
      );
    }

    if (section === "integrations") {
      const integrations = Object.values(data?.integrations || {});
      const connectedCount = integrations.filter((i) => i.configured).length;
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sIntegrations")}</h2>
            <p className="muted">{t("owSet.intHint")}</p>
          </header>

          <div className="settings-integrations-summary">
            <div className="settings-integrations-stat">
              <strong>{connectedCount}</strong>
              <span>{t("owSet.connectedOf", { total: integrations.length })}</span>
            </div>
            <a
              className="btn btn-primary"
              href={`mailto:support@yagona.uz?subject=${encodeURIComponent(`Integration request — ${data?.name || ""}`)}&body=${encodeURIComponent(`Centre: ${data?.name || ""}\nID: ${data?.slug || ""}`)}`}
            >
              {t("owSet.intRequest")}
            </a>
          </div>

          <ul className="settings-integration-list">
            {integrations.map((item) => (
              <li key={item.key}>
                <div className="settings-integration-icon">
                  {item.key === "telegram" ? "✈" : item.key === "fcm" ? "🔔" : "✉"}
                </div>
                <div className="settings-integration-body">
                  <strong>{item.label}</strong>
                  <span className="muted">
                    {item.configured ? t("owSet.intOnHint") : t("owSet.intOffHint")}
                  </span>
                </div>
                <span className={`settings-integration-badge${item.configured ? " is-on" : ""}`}>
                  {item.configured ? t("owSet.intOn") : t("owSet.intOff")}
                </span>
              </li>
            ))}
          </ul>

          <div className="settings-integrations-note">
            <p>
              {t("owSet.intNote")} <a href="mailto:support@yagona.uz">support@yagona.uz</a>
            </p>
          </div>
        </section>
      );
    }

    if (section === "security") {
      return (
        <section className="settings-panel">
          <header className="settings-panel-head">
            <h2>{t("owSet.sSecurity")}</h2>
            <p className="muted">{t("owSet.securityHint")}</p>
          </header>
          <form className="settings-form-grid" onSubmit={changePassword}>
            <Field label={t("owSet.pwCurrent")}>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current_password: e.target.value })
                }
              />
            </Field>
            <Field label={t("owSet.pwNew")}>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new_password: e.target.value })
                }
              />
            </Field>
            <div className="settings-span-2">
              <Field label={t("owSet.pwConfirm")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                />
              </Field>
            </div>
            <div className="settings-save-bar settings-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("owFin.saving") : t("owSet.updatePassword")}
              </Button>
            </div>
          </form>
        </section>
      );
    }

    return null;
  }

  return (
    <div className="reception-page settings-page ow-settings">
      <header className="rx-hero">
        <div>
          <p className="rx-hero-date">{t("owSet.subtitle")}</p>
          <h1>{t("owSet.title")}</h1>
        </div>
      </header>
      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}
      {loading ? <p className="rx-loading">{t("owSet.loading")}</p> : null}

      {!loading && form ? (
        <div className="settings-layout">
          <nav className="settings-nav" aria-label={t("owSet.sections")}>
            <select
              className="settings-nav-select"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.label)}
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
                    {t(item.label)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="settings-content">{renderSection()}</div>
        </div>
      ) : null}

      {resetOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("owSet.resetAsk")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("common.close")}
            onClick={() => setResetOpen(false)}
          />
          <div className="sheet settings-confirm-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("owSet.resetAsk")}</h2>
                <p className="muted">{t("owSet.resetAskHint")}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("common.close")}
                onClick={() => setResetOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="sheet-foot">
              <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>
                {t("owSet.cancel")}
              </Button>
              <Button type="button" disabled={saving} onClick={resetBranding}>
                {saving ? t("owSet.resetting") : t("owSet.reset")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
