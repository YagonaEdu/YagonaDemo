import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton, useToast } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { setSession } from "@/services/api/client";
import {
  changeMyPassword,
  deleteMyPhoto,
  getMe,
  listAttendance,
  listGroups,
  listMyGuardians,
  loadHomework,
  switchStudentTenant,
  updateMe,
  uploadMyPhoto,
} from "@/services/student";
import { formatDate, formatUzPhone } from "@/utils/format";
import { IconBuilding, IconFamily, IconLogout, IconMail, IconPhone, IconUpload } from "./icons";
import { LoadError, attendanceStats, homeworkState, useStudentCabinet, useCabinetHeader } from "./parts";
import { Badge, FxEmpty, initialsOf } from "./fx";

const TABS = [
  ["personal", "Личные данные"],
  ["security", "Безопасность"],
  ["centers", "Учебные центры"],
  ["family", "Родители"],
];
const RELATION_LABELS = { mother: "Мама", father: "Папа", parent: "Родитель", guardian: "Опекун" };
const STATUS = { active: ["teal", "Активен"], inactive: ["grey", "Неактивен"], archived: ["grey", "В архиве"] };
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function phone(value) {
  return value ? formatUzPhone(value) || value : "—";
}

async function loadProfile() {
  const [me, groups, attendance, homework, guardians] = await Promise.all([
    getMe(),
    listGroups().catch(() => []),
    listAttendance().catch(() => []),
    loadHomework().catch(() => []),
    listMyGuardians().catch(() => []),
  ]);
  return { me, groups, attendance, homework, guardians };
}

function Field({ label, children, hint }) {
  return (
    <label className="fpr-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function PersonalForm({ me, student, onSaved, toast }) {
  const initial = {
    first_name: me.first_name || "",
    last_name: me.last_name || "",
    phone: me.phone || "",
    email: me.email || "",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const dirty = Object.keys(initial).some((key) => form[key] !== initial[key]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const changed = Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== initial[key]));
      const user = await updateMe(changed);
      onSaved(user);
      toast("Изменения сохранены");
    } catch (error) {
      const details = error.payload?.details || error.payload || {};
      setErrors(typeof details === "object" ? details : {});
      toast(error.message || "Не удалось сохранить", "error");
    } finally {
      setBusy(false);
    }
  }

  const err = (key) => {
    const value = errors[key];
    return Array.isArray(value) ? value.join(" ") : value;
  };

  return (
    <form className="fpr-form" onSubmit={save} noValidate>
      <div className="fpr-grid">
        <Field label="Имя" hint={err("first_name")}>
          <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoComplete="given-name" />
        </Field>
        <Field label="Фамилия" hint={err("last_name")}>
          <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} autoComplete="family-name" />
        </Field>
        <Field label="Телефон" hint={err("phone") || "Используется для входа"}>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Email" hint={err("email")}>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </Field>
        <Field label="Дата рождения" hint="Меняет администратор центра">
          <input value={student?.birth_date ? formatDate(student.birth_date) : "Не указана"} readOnly disabled />
        </Field>
        <Field label="ФИО в центре" hint="Как записано в карточке ученика">
          <input value={student?.full_name || "—"} readOnly disabled />
        </Field>
      </div>
      <div className="fpr-actions">
        <button type="button" className="sx-btn sx-btn-outline" disabled={!dirty || busy} onClick={() => setForm(initial)}>
          Отмена
        </button>
        <button type="submit" className="sx-btn sx-btn-primary" disabled={!dirty || busy}>
          {busy ? "Сохраняем…" : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}

function SecurityForm({ toast }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("Новый пароль должен быть не короче 8 символов.");
    if (form.next !== form.confirm) return setError("Пароли не совпадают.");
    setBusy(true);
    try {
      await changeMyPassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      toast("Пароль обновлён");
    } catch (err) {
      setError(err.message || "Не удалось сменить пароль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="fpr-form" onSubmit={submit} noValidate>
      <p className="sx-muted">После смены пароля используйте новый при следующем входе.</p>
      <div className="fpr-grid is-narrow">
        <Field label="Текущий пароль">
          <input type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" />
        </Field>
        <span />
        <Field label="Новый пароль" hint="Минимум 8 символов">
          <input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" />
        </Field>
        <Field label="Повторите пароль">
          <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
        </Field>
      </div>
      {error ? <p className="fpr-error" role="alert">{error}</p> : null}
      <div className="fpr-actions">
        <button type="submit" className="sx-btn sx-btn-primary" disabled={busy || !form.current || !form.next}>
          {busy ? "Сохраняем…" : "Сменить пароль"}
        </button>
      </div>
    </form>
  );
}

function CentersList({ session }) {
  const navigate = useNavigate();
  return (
    <ul className="fpr-centers" role="radiogroup" aria-label="Учебный центр">
      {session.memberships.map((item) => {
        const active = String(item.tenant_id) === String(session.tenantId);
        return (
          <li key={item.id}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              className={`fpr-center${active ? " is-active" : ""}`}
              onClick={() => {
                if (active) return;
                switchStudentTenant(item.tenant_id);
                navigate("/student", { replace: true });
              }}
            >
              <span className="sx-row-icon">
                <IconBuilding size={20} />
              </span>
              <span className="sx-row-copy">
                <strong>{item.tenant_name}</strong>
                <span>{active ? "Текущий центр" : "Нажмите, чтобы переключиться"}</span>
              </span>
              <span className="sx-radio" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FamilyList({ guardians }) {
  if (!guardians.length) return <FxEmpty icon={IconFamily} title="Контакты родителей не указаны" body="Попросите администратора центра добавить их." />;
  return (
    <ul className="sx-rows">
      {guardians.map((item) => (
        <li key={item.id}>
          <div className="sx-row">
            <span className="fpr-mini-av">{initialsOf(item.full_name)}</span>
            <span className="sx-row-copy">
              <strong>{item.full_name}</strong>
              <span>
                {RELATION_LABELS[item.relationship?.toLowerCase()] || item.relationship || "Контакт"}
                {item.is_primary ? " · основной" : ""}
              </span>
            </span>
            <a className="sx-link" href={`tel:${item.phone}`}>
              {phone(item.phone)}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function StudentProfilePage() {
  const { card, session, centerName, onLogout } = useStudentCabinet();
  const profile = useAsync(loadProfile, [session.tenantId]);
  const [tab, setTab] = useState("personal");
  const [me, setMe] = useState(null);
  const [toast, showToast] = useToast();
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  useCabinetHeader("Профиль", "Личные данные и настройки");

  useEffect(() => {
    if (profile.data?.me) setMe(profile.data.me);
  }, [profile.data]);

  function savedUser(user) {
    setMe(user);
    setSession({ user: { ...session.user, ...user } });
  }

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return showToast("Выберите фото JPG, PNG или WEBP", "error");
    if (file.size > 5 * 1024 * 1024) return showToast("Фото должно быть меньше 5 МБ", "error");
    setPhotoBusy(true);
    try {
      savedUser(await uploadMyPhoto(file));
      showToast("Фото обновлено");
    } catch (error) {
      showToast(error.message || "Не удалось загрузить фото", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      savedUser(await deleteMyPhoto());
      showToast("Фото удалено");
    } catch (error) {
      showToast(error.message || "Не удалось удалить фото", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (profile.error) return <LoadError error={profile.error} onRetry={profile.reload} />;
  const loading = profile.loading || !me;
  const student = card.data;
  const fullName = [me?.first_name, me?.last_name].filter(Boolean).join(" ") || student?.full_name || "Ученик";
  const stats = attendanceStats(profile.data?.attendance);
  const homework = profile.data?.homework || [];
  const done = homework.filter((item) => ["submitted", "late", "graded"].includes(homeworkState(item))).length;
  const primary = (profile.data?.guardians || []).find((item) => item.is_primary) || profile.data?.guardians?.[0];
  const [statusTone, statusLabel] = STATUS[student?.status] || ["teal", "Активен"];

  return (
    <div className="fpr-layout">
      <aside className="sx-card fpr-card">
        <div className="fpr-band" aria-hidden="true" />
        <div className="fpr-avatar-wrap">
          {loading ? (
            <Skeleton width={96} height={96} radius={48} />
          ) : me.photo_url ? (
            <img className="fpr-avatar" src={me.photo_url} alt="" width="96" height="96" />
          ) : (
            <span className="fpr-avatar">{initialsOf(fullName)}</span>
          )}
          <button
            type="button"
            className="fpr-photo-btn"
            aria-label="Загрузить фото"
            disabled={photoBusy || loading}
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload size={16} />
          </button>
          <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(",")} hidden onChange={pickPhoto} />
        </div>
        <div className="fpr-name">
          <h2>{loading ? <Skeleton width={180} height={22} /> : fullName}</h2>
          <p>Студент · {centerName}</p>
          <div className="fpr-badges">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {me?.photo_url ? (
              <button type="button" className="fpr-text-btn" onClick={removePhoto} disabled={photoBusy}>
                Удалить фото
              </button>
            ) : null}
          </div>
        </div>
        <dl className="fpr-stats">
          <div>
            <dd>{loading ? "—" : profile.data.groups.length}</dd>
            <dt>курсов</dt>
          </div>
          <div>
            <dd>{stats.rate == null ? "—" : `${stats.rate}%`}</dd>
            <dt>посещ.</dt>
          </div>
          <div>
            <dd>{loading ? "—" : done}</dd>
            <dt>заданий</dt>
          </div>
        </dl>
        <ul className="fpr-contacts">
          <li>
            <IconPhone size={16} />
            <span>Телефон</span>
            <b>{phone(me?.phone || student?.phone)}</b>
          </li>
          <li>
            <IconMail size={16} />
            <span>Email</span>
            <b>{me?.email || student?.email || "—"}</b>
          </li>
          <li>
            <IconBuilding size={16} />
            <span>Центр</span>
            <b>{centerName}</b>
          </li>
          <li>
            <IconFamily size={16} />
            <span>Родитель</span>
            <b>{primary ? phone(primary.phone) : "—"}</b>
          </li>
        </ul>
        <button type="button" className="sx-btn sx-btn-outline fpr-logout" onClick={onLogout}>
          <IconLogout size={18} />
          Выйти из аккаунта
        </button>
      </aside>

      <section className="sx-card fpr-main">
        <div className="sx-tabs" role="tablist" aria-label="Разделы профиля">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`sx-tab${tab === key ? " is-active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <Skeleton lines={6} height={40} />
        ) : tab === "personal" ? (
          <PersonalForm key={me.id + (me.first_name || "") + (me.email || "")} me={me} student={student} onSaved={savedUser} toast={showToast} />
        ) : tab === "security" ? (
          <SecurityForm toast={showToast} />
        ) : tab === "centers" ? (
          <CentersList session={session} />
        ) : (
          <FamilyList guardians={profile.data.guardians} />
        )}
      </section>
      {toast}
    </div>
  );
}
