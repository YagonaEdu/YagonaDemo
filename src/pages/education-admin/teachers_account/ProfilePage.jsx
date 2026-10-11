import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { YagonaLogo } from "@/components/brand";
import { Avatar, Banner, Button, CloseButton, Field, PhoneInput } from "@/components/ui";
import { api, getSession, setSession } from "@/services/api/client";
import { currentMembership } from "@/services/auth";
import { educationSegmentPath } from "@/utils/routes";
import { formatUzPhone, toApiPhone } from "@/utils/format";
import { t } from "@/i18n";
import { buildScheduleSummary } from "./groupHelpers";
import { asList, membershipName } from "./utils";

function studentsLabel(count) {
  return t("plural.students", { count: Number(count) || 0 });
}

function ProfileSkeleton() {
  return (
    <div className="tp-page" aria-busy="true" aria-live="polite">
      <div className="tp-skeleton tp-skeleton-header" />
      <div className="tp-layout">
        <div className="tp-main">
          <div className="tp-skeleton tp-skeleton-block" />
          <div className="tp-skeleton tp-skeleton-block" />
          <div className="tp-skeleton tp-skeleton-block" />
        </div>
        <aside className="tp-aside">
          <div className="tp-skeleton tp-skeleton-aside" />
          <div className="tp-skeleton tp-skeleton-aside" />
        </aside>
      </div>
    </div>
  );
}

function EditProfileSheet({
  open,
  form,
  position,
  saving,
  error,
  onClose,
  onChange,
  onPositionChange,
  onSave,
  onRetry,
}) {
  if (!open) return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="tp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tp-sheet-head">
          <div>
            <h2 id="tp-edit-title">{t("tProfile.editTitle")}</h2>
            <p className="muted">{t("tProfile.editLead")}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <form className="tp-sheet-body" onSubmit={onSave}>
          {error ? (
            <Banner>
              {error}
              {onRetry ? (
                <button type="button" className="tp-retry" onClick={onRetry}>
                  {t("common.retry")}
                </button>
              ) : null}
            </Banner>
          ) : null}
          <div className="tp-form-grid">
            <Field label={t("tProfile.firstName")}>
              <input
                name="first_name"
                autoComplete="given-name"
                value={form.first_name}
                onChange={(e) => onChange({ ...form, first_name: e.target.value })}
                required
              />
            </Field>
            <Field label={t("tProfile.lastName")}>
              <input
                name="last_name"
                autoComplete="family-name"
                value={form.last_name}
                onChange={(e) => onChange({ ...form, last_name: e.target.value })}
                required
              />
            </Field>
            <Field label={t("tProfile.phone")}>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => onChange({ ...form, phone })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t("tProfile.position")}>
              <input
                name="position"
                value={position}
                onChange={(e) => onPositionChange(e.target.value)}
                placeholder={t("tProfile.positionPlaceholder")}
              />
            </Field>
          </div>
          <div className="tp-sheet-foot">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t(saving ? "common.saving" : "common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function TeacherProfilePage() {
  const { tenantSlug = "" } = useParams();
  const session = getSession();
  const membership = currentMembership(session);
  const roleLabel = t(`roles.${membership?.role || "teacher"}`);

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [rules, setRules] = useState([]);
  const [position, setPosition] = useState(membership?.position || "");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });
  const [editPosition, setEditPosition] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");

  const path = useCallback(
    (segment) => educationSegmentPath(tenantSlug, segment),
    [tenantSlug],
  );

  const displayName = membershipName(membership, session.user);
  const centerName =
    tenant?.short_name ||
    tenant?.name ||
    membership?.tenant_name ||
    t("tProfile.centreFallback");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [me, settings, groupRows, courseRows, ruleRows] = await Promise.all([
        api.get("/me", { tenant: false }).catch(() => session.user),
        api.get("/tenant/settings").catch(() => null),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
        asList("/schedule-rules?page_size=200").catch(() => []),
      ]);
      if (me) {
        setSession({
          user: {
            ...(getSession().user || {}),
            ...me,
            name: me.name || [me.first_name, me.last_name].filter(Boolean).join(" "),
          },
        });
      }
      setTenant(settings);
      setGroups(groupRows);
      setCourses(courseRows);
      setRules(ruleRows);
      setPosition(membership?.position || "");
    } catch (err) {
      setLoadError(err.message || t("tProfile.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [membership?.position, session.user]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const courseNames = useMemo(() => {
    const ids = new Set(groups.map((row) => String(row.course)).filter(Boolean));
    return courses.filter((row) => ids.has(String(row.id))).map((row) => row.name);
  }, [groups, courses]);

  const groupCards = useMemo(() => {
    return groups.slice(0, 4).map((group) => {
      const groupRules = rules.filter(
        (row) => String(row.group) === String(group.id) && row.is_active !== false,
      );
      const schedule = buildScheduleSummary(groupRules);
      return {
        id: group.id,
        name: group.name,
        students: group.active_students ?? 0,
        scheduleDays: schedule.days,
      };
    });
  }, [groups, rules]);

  function openEdit() {
    const user = getSession().user || session.user || {};
    setEditForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: formatUzPhone(user.phone || ""),
      email: user.email || "",
    });
    setEditPosition(position || membership?.position || "");
    setProfileError("");
    setEditOpen(true);
  }

  async function saveProfile(event) {
    event?.preventDefault?.();
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      setProfileError(t("tProfile.needName"));
      return;
    }
    setSavingProfile(true);
    setProfileError("");
    try {
      const me = await api.patch(
        "/me",
        {
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          phone: toApiPhone(editForm.phone) || "",
          email: editForm.email.trim() || "",
        },
        { tenant: false },
      );

      let nextPosition = editPosition.trim();
      if (membership?.id && nextPosition !== (membership.position || "")) {
        try {
          const staff = await api.patch(`/staff/${membership.id}`, {
            position: nextPosition,
          });
          nextPosition = staff.position || nextPosition;
          const nextMemberships = (getSession().memberships || []).map((item) =>
            String(item.id) === String(membership.id)
              ? { ...item, position: nextPosition }
              : item,
          );
          setSession({ memberships: nextMemberships });
        } catch {
          /* position is best-effort */
        }
      }

      setSession({
        user: {
          ...(getSession().user || {}),
          ...me,
          name: me.name || [me.first_name, me.last_name].filter(Boolean).join(" "),
        },
      });
      setPosition(nextPosition);
      setEditOpen(false);
      setToast(t("tProfile.saved"));
    } catch (err) {
      setProfileError(err.message || t("tProfile.saveFailed"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordError("");
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setPasswordError(t("tProfile.needPasswords"));
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError(t("tProfile.shortPassword"));
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm) {
      setPasswordError(t("tProfile.mismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await api.post(
        "/me/password",
        {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        },
        { tenant: false },
      );
      setPasswordForm({ current_password: "", new_password: "", confirm: "" });
      setToast(t("tProfile.passwordUpdated"));
    } catch (err) {
      setPasswordError(err.message || t("tProfile.saveFailed"));
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) return <ProfileSkeleton />;

  const user = getSession().user || session.user || {};
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || displayName;
  const phoneDisplay = user.phone ? formatUzPhone(user.phone) : "—";
  const cityLine = tenant?.city || "";

  return (
    <div className="tp-page">
      <header className="tp-page-head">
        <div>
          <h1>{t("tProfile.title")}</h1>
          <p className="muted">{t("tProfile.sub")}</p>
        </div>
      </header>

      {loadError ? <Banner>{loadError}</Banner> : null}
      {toast ? (
        <Banner tone="ok" role="status">
          {toast}
        </Banner>
      ) : null}

      <section className="tp-header card">
        <Avatar name={fullName} size="lg" />
        <div className="tp-header-text">
          <h2>{fullName}</h2>
          <p className="tp-role">{roleLabel}</p>
          <p className="tp-center-line">
            <span className="muted">{t("tProfile.centreLabel")}</span> {centerName}
          </p>
          {position ? <p className="muted tp-position">{position}</p> : null}
          <div className="tp-header-actions">
            <Button type="button" onClick={openEdit}>
              {t("tProfile.edit")}
            </Button>
            <Link className="btn btn-ghost" to={path("groups")}>
              {t("tProfile.myGroups")}
            </Link>
            <Link className="btn btn-ghost" to={path("schedule")}>
              {t("tProfile.mySchedule")}
            </Link>
          </div>
        </div>
      </section>

      <div className="tp-layout">
        <div className="tp-main">
          <section className="card tp-section">
            <h3>{t("tProfile.personal")}</h3>
            <dl className="tp-dl">
              <div>
                <dt>{t("tProfile.fullName")}</dt>
                <dd>{fullName}</dd>
              </div>
              <div>
                <dt>{t("tProfile.phone")}</dt>
                <dd>{phoneDisplay}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email || "—"}</dd>
              </div>
            </dl>
            <Button type="button" variant="ghost" onClick={openEdit}>
              {t("common.change")}
            </Button>
          </section>

          <section className="card tp-section">
            <h3>{t("tProfile.work")}</h3>
            <dl className="tp-dl">
              <div>
                <dt>{t("tProfile.role")}</dt>
                <dd>
                  {roleLabel}
                  <span className="tp-readonly-hint">{t("tProfile.readOnly")}</span>
                </dd>
              </div>
              <div>
                <dt>{t("tProfile.position")}</dt>
                <dd>{position || "—"}</dd>
              </div>
              <div>
                <dt>{t("tProfile.courses")}</dt>
                <dd>
                  {courseNames.length ? (
                    <ul className="tp-chip-list">
                      {courseNames.slice(0, 6).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("tProfile.groups")}</dt>
                <dd>
                  {groups.length ? groups.map((row) => row.name).join(", ") : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card tp-section tp-groups-mobile">
            <div className="tp-section-row">
              <h3>{t("tProfile.myGroups")}</h3>
              <Link to={path("groups")} className="tp-link">
                {t("tProfile.allGroups")}
              </Link>
            </div>
            {groupCards.length ? (
              <ul className="tp-group-list">
                {groupCards.map((group) => (
                  <li key={group.id}>
                    <strong>{group.name}</strong>
                    <span className="muted">{studentsLabel(group.students)}</span>
                    <span className="muted">{group.scheduleDays}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("tProfile.noGroups")}</p>
            )}
            {courseNames.length ? (
              <div className="tp-courses-block">
                <p className="tp-card-label">{t("tProfile.myCourses")}</p>
                <ul className="tp-chip-list">
                  {courseNames.slice(0, 4).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="card tp-section">
            <h3>{t("tProfile.account")}</h3>
            <dl className="tp-dl">
              <div>
                <dt>{t("tProfile.login")}</dt>
                <dd>{user.email || phoneDisplay}</dd>
              </div>
              <div>
                <dt>{t("tProfile.role")}</dt>
                <dd>{roleLabel}</dd>
              </div>
              <div>
                <dt>{t("tProfile.centre")}</dt>
                <dd>{centerName}</dd>
              </div>
              <div>
                <dt>{t("tProfile.accountStatus")}</dt>
                <dd>
                  <span className="tp-status-ok">{t("tProfile.active")}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="card tp-section" id="security">
            <h3>{t("tProfile.security")}</h3>
            <p className="muted tp-section-hint">{t("tProfile.securityHint")}</p>
            <form className="tp-password-form" onSubmit={savePassword}>
              {passwordError ? <Banner>{passwordError}</Banner> : null}
              <Field label={t("tProfile.currentPassword")}>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current_password: e.target.value })
                  }
                />
              </Field>
              <Field label={t("tProfile.newPassword")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password: e.target.value })
                  }
                />
              </Field>
              <Field label={t("tProfile.confirmPassword")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirm: e.target.value })
                  }
                />
              </Field>
              <Button type="submit" disabled={savingPassword}>
                {t(savingPassword ? "common.saving" : "tProfile.changePassword")}
              </Button>
            </form>
          </section>
        </div>

        <aside className="tp-aside">
          <section className="card tp-center-card">
            <p className="tp-card-label">{t("tProfile.centre")}</p>
            {tenant?.logo_url ? (
              <img
                className="tp-center-logo"
                src={tenant.logo_url}
                alt={t("tProfile.logoAlt", { name: centerName })}
              />
            ) : null}
            <h3>{centerName}</h3>
            <p className="tp-role">{roleLabel}</p>
            <dl className="tp-dl tp-dl-compact">
              {tenant?.contact_phone ? (
                <div>
                  <dt>{t("tProfile.phone")}</dt>
                  <dd>
                    <a href={`tel:${tenant.contact_phone}`}>
                      {formatUzPhone(tenant.contact_phone)}
                    </a>
                  </dd>
                </div>
              ) : null}
              {tenant?.contact_email ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${tenant.contact_email}`}>{tenant.contact_email}</a>
                  </dd>
                </div>
              ) : null}
              {cityLine ? (
                <div>
                  <dt>{t("tProfile.city")}</dt>
                  <dd>{cityLine}</dd>
                </div>
              ) : null}
              {tenant?.website ? (
                <div>
                  <dt>{t("tProfile.site")}</dt>
                  <dd>
                    <a href={tenant.website} target="_blank" rel="noreferrer">
                      {tenant.website.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="tp-center-foot">
              <YagonaLogo size={20} mark alt="" />
              <span>{t("tProfile.worksWith", { name: centerName })}</span>
            </div>
          </section>

          <section className="card tp-section tp-groups-desktop">
            <div className="tp-section-row">
              <h3>{t("tProfile.myGroups")}</h3>
              <Link to={path("groups")} className="tp-link">
                {t("tProfile.allGroups")}
              </Link>
            </div>
            {groupCards.length ? (
              <ul className="tp-group-list">
                {groupCards.map((group) => (
                  <li key={group.id}>
                    <strong>{group.name}</strong>
                    <span className="muted">{studentsLabel(group.students)}</span>
                    <span className="muted">{group.scheduleDays}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("tProfile.noGroups")}</p>
            )}
            {courseNames.length ? (
              <div className="tp-courses-block">
                <p className="tp-card-label">{t("tProfile.myCourses")}</p>
                <ul className="tp-chip-list">
                  {courseNames.slice(0, 4).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="tp-brand-card" aria-label="Yagona">
            <YagonaLogo size={36} alt="Yagona" />
            <p className="tp-brand-quote">
              {t("tProfile.brandQuote")}
            </p>
            <p className="tp-brand-sub">{t("tProfile.brandSub")}</p>
          </section>
        </aside>
      </div>

      <EditProfileSheet
        open={editOpen}
        form={editForm}
        position={editPosition}
        saving={savingProfile}
        error={profileError}
        onClose={() => setEditOpen(false)}
        onChange={setEditForm}
        onPositionChange={setEditPosition}
        onSave={saveProfile}
        onRetry={() => saveProfile()}
      />
    </div>
  );
}
