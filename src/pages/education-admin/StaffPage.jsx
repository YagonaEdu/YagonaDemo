import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Banner, Button, Field, MoneyInput, RowActionsMenu } from "@/components/ui";
import { ROLE_LABELS } from "@/constants";
import { t } from "@/i18n";
import { api, getSession } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import { hasCapability } from "@/utils/roleAccess";
import { formatDate, formatUzPhone, money, priceToApi, today, localIsoDate } from "@/utils/format";

const PAYMENT_TYPES = [
  { value: "fixed", label: "owFin.typeFixed" },
  { value: "per_lesson", label: "owFin.typePerLesson" },
  { value: "hourly", label: "owFin.typeHourly" },
];

const ROLE_OPTIONS = ["owner", "admin", "teacher", "accountant"];

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function paymentTypeLabel(value) {
  const label = PAYMENT_TYPES.find((item) => item.value === value)?.label;
  return label ? t(label) : "—";
}

function computeAccrued(row) {
  const rate = asNumber(row.salary_rate);
  if (!row.payment_type || !rate) return 0;
  if (row.payment_type === "per_lesson") return rate * (row.lessonCount || 0);
  return rate;
}

function staffPatchPayload(data) {
  return {
    role: data.role,
    is_active: data.is_active,
    position: data.position || "",
    hired_on: data.hired_on || null,
    payment_type: data.payment_type || "",
    salary_rate: priceToApi(data.salary_rate || "0"),
  };
}

function staffName(row) {
  const user = row.user || {};
  return user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—";
}

/** This calendar month: lesson window and the salary-record period (first day). */
function thisMonth() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to, period: localIsoDate(from) };
}

/** Whole list (shared pagination helper; large pages keep it to few requests). */
function fetchAll(path) {
  return getList(path.includes("page_size=") ? path : `${path}${path.includes("?") ? "&" : "?"}page_size=500`);
}

function RoleBadge({ role }) {
  const tone = { owner: "is-blue", admin: "is-teal", teacher: "", accountant: "is-amber" }[role] || "";
  return <span className={`rx-pill ${tone}`.trim()}>{ROLE_LABELS[role] || role}</span>;
}

function StatusBadge({ active }) {
  return (
    <span className={`rx-pill ${active ? "is-teal" : "is-red"}`}>
      {active ? t("owStaff.active") : t("owStaff.inactive")}
    </span>
  );
}

const EMPTY_FORM = {
  email: "",
  phone: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "teacher",
  is_active: true,
  position: "",
  hired_on: "",
  payment_type: "fixed",
  salary_rate: "",
};

export default function StaffPage() {
  const role = currentMembership()?.role || "";
  const canWrite = hasCapability(role, "staff.manage");
  const canSeePay = hasCapability(role, "staff.salary");
  const slug = getSession().tenantSlug;
  const financePath = slug ? `/education/${slug}/finance` : "../finance";
  const month = useMemo(() => thisMonth(), []);
  const [staff, setStaff] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState("");
  const [detailId, setDetailId] = useState("");
  const [detailTab, setDetailTab] = useState("info");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const courseMap = useMemo(() => Object.fromEntries(courses.map((item) => [String(item.id), item])), [courses]);
  const paidThisMonth = useMemo(() => {
    const map = new Map();
    salaryRecords
      .filter((record) => record.period === month.period && record.status === "paid")
      .forEach((record) => map.set(String(record.membership), record));
    return map;
  }, [salaryRecords, month.period]);

  const enrichedStaff = useMemo(() => {
    return staff.map((row) => {
      const teacherGroups = groups.filter((item) => String(item.teacher) === String(row.id));
      const lessonCount = lessons.filter((item) => String(item.teacher) === String(row.id)).length;
      const accrued = computeAccrued({ ...row, lessonCount });
      const record = paidThisMonth.get(String(row.id));
      const paid = asNumber(record?.paid_amount);
      return {
        ...row,
        displayName: staffName(row),
        customPosition: row.position || "",
        position: row.position || ROLE_LABELS[row.role] || row.role,
        groupCount: teacherGroups.length,
        lessonCount,
        groups: teacherGroups,
        accrued,
        paid,
        paidAt: record?.paid_at || null,
        remaining: Math.max(0, accrued - paid),
      };
    });
  }, [staff, groups, lessons, paidThisMonth]);

  const filteredStaff = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return enrichedStaff.filter((row) => {
      if (filterRole && row.role !== filterRole) return false;
      if (filterStatus === "active" && !row.is_active) return false;
      if (filterStatus === "inactive" && row.is_active) return false;
      if (filterPaymentType && row.payment_type !== filterPaymentType) return false;
      if (q) {
        const phone = (row.user?.phone || "").replace(/\D/g, "");
        const hay = `${row.displayName} ${row.position} ${row.user?.email || ""} ${phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedStaff, filterRole, filterStatus, filterPaymentType, filterSearch]);

  const kpi = useMemo(() => {
    const active = enrichedStaff.filter((item) => item.is_active);
    return {
      total: staff.length,
      teachers: staff.filter((item) => item.role === "teacher").length,
      admins: staff.filter((item) => item.role === "admin" || item.role === "owner").length,
      active: active.length,
      payroll: active.reduce((sum, item) => sum + item.accrued, 0),
      due: active.reduce((sum, item) => sum + item.remaining, 0),
    };
  }, [staff, enrichedStaff]);

  const detailRow = useMemo(
    () => enrichedStaff.find((item) => String(item.id) === String(detailId)) || null,
    [enrichedStaff, detailId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const monthWindow = `starts_at_from=${encodeURIComponent(month.from.toISOString())}&starts_at_to=${encodeURIComponent(month.to.toISOString())}`;
      const [staffData, groupData, courseData, lessonData, salaryData] = await Promise.all([
        fetchAll("/staff"),
        fetchAll("/groups"),
        fetchAll("/courses"),
        fetchAll(`/lessons?${monthWindow}`),
        canSeePay ? fetchAll("/salary-records").catch(() => []) : [],
      ]);
      setStaff(staffData);
      setGroups(groupData);
      setCourses(courseData);
      setLessons(lessonData.filter((item) => item.status !== "cancelled"));
      setSalaryRecords(salaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, canSeePay]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!info) return undefined;
    const timer = window.setTimeout(() => setInfo(""), 3200);
    return () => window.clearTimeout(timer);
  }, [info]);

  function openCreateModal() {
    setFormMode("create");
    setForm({ ...EMPTY_FORM, hired_on: today() });
    setFormOpen(true);
  }

  function openEditModal(row) {
    setFormMode("edit");
    setForm({
      id: row.id,
      email: row.user?.email || "",
      phone: row.user?.phone || "",
      password: "",
      first_name: row.user?.first_name || "",
      last_name: row.user?.last_name || "",
      role: row.role,
      is_active: row.is_active,
      position: row.customPosition || "",
      hired_on: row.hired_on || "",
      payment_type: row.payment_type || "",
      salary_rate: row.salary_rate ? String(Math.floor(asNumber(row.salary_rate))) : "",
    });
    setFormOpen(true);
  }

  async function submitForm(event) {
    event.preventDefault();
    setFormSaving(true);
    setError("");
    try {
      if (formMode === "create") {
        await api.post("/staff", {
          email: form.email,
          phone: form.phone,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          position: form.position,
          hired_on: form.hired_on || null,
          payment_type: form.payment_type,
          salary_rate: priceToApi(form.salary_rate || "0"),
        });
        setInfo(t("owStaff.infoAdded"));
      } else {
        await api.patch(`/staff/${form.id}`, staffPatchPayload(form));
        setInfo(t("owStaff.infoUpdated"));
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setFormSaving(false);
    }
  }

  async function exportExcel() {
    const { downloadExcel, excelStamp } = await import("@/utils/exportExcel");
    const columns = [
      { key: "name", title: t("owStaff.colStaff"), value: (row) => row.displayName },
      { key: "position", title: t("owStaff.colPosition"), value: (row) => row.position },
      { key: "role", title: t("owStaff.colRole"), value: (row) => ROLE_LABELS[row.role] || row.role },
      { key: "phone", title: t("owStaff.colPhone"), value: (row) => row.user?.phone || "" },
      { key: "email", title: "Email", value: (row) => row.user?.email || "" },
      {
        key: "load",
        title: t("owStaff.colLoad"),
        value: (row) =>
          row.role === "teacher"
            ? `${t("owStaff.groupsCount", { count: row.groupCount })} / ${t("owStaff.lessonsMonth", { count: row.lessonCount })}`
            : "—",
      },
      { key: "status", title: t("owStaff.colStatus"), value: (row) => (row.is_active ? t("owStaff.active") : t("owStaff.inactive")) },
    ];
    if (canSeePay) {
      columns.push(
        { key: "type", title: t("owFin.fType"), value: (row) => paymentTypeLabel(row.payment_type) },
        { key: "rate", title: t("owFin.xRate"), value: (row) => asNumber(row.salary_rate) },
        { key: "accrued", title: t("owFin.colAccrued"), value: (row) => row.accrued },
        { key: "paid", title: t("owFin.colPaid"), value: (row) => row.paid },
      );
    }
    downloadExcel(`staff_${excelStamp()}`, filteredStaff, columns);
  }

  function resetFilters() {
    setFilterSearch("");
    setFilterRole("");
    setFilterStatus("");
    setFilterPaymentType("");
  }

  function openStaffDetail(row, tab = "info") {
    setDetailId(row.id);
    setDetailTab(tab);
  }

  const filtersOn = filterSearch || filterRole || filterStatus || filterPaymentType;
  const detailTabs = [
    ["info", t("owStaff.tabInfo")],
    ["work", t("owStaff.tabWork")],
    ...(canSeePay ? [["salary", t("owStaff.tabSalary")]] : []),
  ];

  return (
    <div className="reception-page staff-page ow-staff">
      <header className="rx-hero">
        <div>
          <p className="rx-hero-date">{t("owStaff.subtitle")}</p>
          <h1>{t("owStaff.title")}</h1>
        </div>
        <div className="rx-hero-actions">
          <button type="button" className="rx-btn is-outline" onClick={exportExcel}>
            {t("owStaff.excel")}
          </button>
          {canWrite ? (
            <button type="button" className="rx-btn is-primary" onClick={openCreateModal}>
              {t("owStaff.add")}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}
      {loading ? <p className="rx-loading">{t("owStaff.loading")}</p> : null}

      <section className="rx-stats" aria-label={t("owStaff.title")}>
        <article className="rx-stat">
          <span>{t("owStaff.kTotal")}</span>
          <strong>{kpi.total}</strong>
          <small>{t("owStaff.kActive", { count: kpi.active })}</small>
        </article>
        <article className="rx-stat">
          <span>{t("owStaff.kTeachers")}</span>
          <strong>{kpi.teachers}</strong>
          <small>{t("owStaff.kTeachersHint")}</small>
        </article>
        <article className="rx-stat">
          <span>{t("owStaff.kAdmins")}</span>
          <strong>{kpi.admins}</strong>
          <small>{t("owStaff.kAdminsHint")}</small>
        </article>
        {canSeePay ? (
          <>
            <article className="rx-stat">
              <span>{t("owStaff.kPayroll")}</span>
              <strong>{money(kpi.payroll, "UZS")}</strong>
              <small>{t("owStaff.kPayrollHint")}</small>
            </article>
            <article className="rx-stat">
              <span>{t("owStaff.kDue")}</span>
              <strong className={kpi.due > 0 ? "is-amber" : ""}>{money(kpi.due, "UZS")}</strong>
              <small>
                <Link className="rx-link" to={financePath}>
                  {t("owStaff.openPayroll")}
                </Link>
              </small>
            </article>
          </>
        ) : null}
      </section>

      <section className="rx-card">
        <div className="staff-filters ow-filters">
          <Field label={t("owStaff.fSearch")}>
            <input
              placeholder={t("owStaff.fSearchPh")}
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </Field>
          <Field label={t("owStaff.colRole")}>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">{t("owFin.all")}</option>
              {ROLE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("owStaff.colStatus")}>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t("owFin.all")}</option>
              <option value="active">{t("owStaff.active")}</option>
              <option value="inactive">{t("owStaff.inactive")}</option>
            </select>
          </Field>
          {canSeePay ? (
            <Field label={t("owFin.fType")}>
              <select value={filterPaymentType} onChange={(e) => setFilterPaymentType(e.target.value)}>
                <option value="">{t("owFin.all")}</option>
                {PAYMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {filtersOn ? (
            <button type="button" className="rx-link ow-filter-reset" onClick={resetFilters}>
              {t("owStaff.reset")}
            </button>
          ) : null}
        </div>

        <div className="rx-card-head">
          <h2>
            {t("owStaff.list")} <span className="rx-count">{filteredStaff.length}</span>
          </h2>
        </div>

        {!filteredStaff.length ? (
          <p className="rx-empty">{t("owStaff.empty")}</p>
        ) : (
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>{t("owStaff.colStaff")}</th>
                  <th>{t("owStaff.colPosition")}</th>
                  <th>{t("owStaff.colRole")}</th>
                  <th>{t("owStaff.colPhone")}</th>
                  <th>{t("owStaff.colLoad")}</th>
                  {canSeePay ? <th>{t("owStaff.colSalary")}</th> : null}
                  <th>{t("owStaff.colStatus")}</th>
                  <th aria-label={t("owFin.colAction")} />
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((row) => (
                  <tr key={row.id} className="is-clickable" onClick={() => openStaffDetail(row)}>
                    <td>
                      <div className="staff-person-cell">
                        <Avatar name={row.displayName} />
                        <div>
                          <strong>{row.displayName}</strong>
                          <span className="muted">{row.user?.email || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.position}</td>
                    <td>
                      <RoleBadge role={row.role} />
                    </td>
                    <td>{formatUzPhone(row.user?.phone) || "—"}</td>
                    <td>
                      {row.role === "teacher" ? (
                        <>
                          <strong>{t("owStaff.groupsCount", { count: row.groupCount })}</strong>
                          <span className="muted">{t("owStaff.lessonsMonth", { count: row.lessonCount })}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canSeePay ? (
                      <td>
                        {row.payment_type ? (
                          <>
                            <strong>{money(row.accrued, "UZS")}</strong>
                            <span className="muted">
                              {row.payment_type === "per_lesson"
                                ? t("owStaff.perLesson", { amount: money(row.salary_rate, "UZS") })
                                : paymentTypeLabel(row.payment_type)}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                    <td>
                      <StatusBadge active={row.is_active} />
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <RowActionsMenu
                        items={[
                          { label: t("owStaff.details"), onClick: () => openStaffDetail(row) },
                          { label: t("owStaff.tabSalary"), onClick: () => openStaffDetail(row, "salary"), hidden: !canSeePay },
                          { label: t("owFin.edit"), onClick: () => openEditModal(row), hidden: !canWrite },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailRow ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={detailRow.displayName}>
          <button type="button" className="overlay-backdrop" aria-label={t("common.close")} onClick={() => setDetailId("")} />
          <aside className="sheet sheet-detail sheet-wide">
            <div className="sheet-head">
              <div className="staff-detail-head">
                <Avatar name={detailRow.displayName} size="lg" />
                <div>
                  <h2>{detailRow.displayName}</h2>
                  <p className="muted">
                    {formatUzPhone(detailRow.user?.phone) || "—"} · {detailRow.user?.email || "—"}
                  </p>
                  <RoleBadge role={detailRow.role} />
                </div>
              </div>
              <div className="sheet-head-actions">
                {canWrite ? (
                  <button type="button" className="rx-btn is-outline is-sm" onClick={() => openEditModal(detailRow)}>
                    {t("owFin.edit")}
                  </button>
                ) : null}
                <button type="button" className="sheet-close" aria-label={t("common.close")} onClick={() => setDetailId("")}>
                  ×
                </button>
              </div>
            </div>

            <div className="ow-sheet-tabs">
              <div className="rx-seg" role="tablist">
                {detailTabs.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === value}
                    className={detailTab === value ? "is-active" : ""}
                    onClick={() => setDetailTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-body">
              {detailTab === "info" ? (
                <dl className="rx-dl">
                  <div>
                    <dt>{t("owStaff.fullName")}</dt>
                    <dd>{detailRow.displayName}</dd>
                  </div>
                  <div>
                    <dt>{t("owStaff.colPhone")}</dt>
                    <dd>{formatUzPhone(detailRow.user?.phone) || "—"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{detailRow.user?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("owStaff.colPosition")}</dt>
                    <dd>{detailRow.position}</dd>
                  </div>
                  <div>
                    <dt>{t("owStaff.colStatus")}</dt>
                    <dd>
                      <StatusBadge active={detailRow.is_active} />
                    </dd>
                  </div>
                  <div>
                    <dt>{t("owFin.fHired")}</dt>
                    <dd>{detailRow.hired_on ? formatDate(detailRow.hired_on) : "—"}</dd>
                  </div>
                </dl>
              ) : null}

              {detailTab === "work" ? (
                detailRow.role === "teacher" ? (
                  <div className="ow-work">
                    <p>{t("owStaff.workLine", { groups: detailRow.groupCount, lessons: detailRow.lessonCount })}</p>
                    {detailRow.groups.length ? (
                      <ul className="ow-meter">
                        {detailRow.groups.map((group) => (
                          <li key={group.id}>
                            <span>{group.name}</span>
                            <small>{courseMap[String(group.course)]?.name || "—"}</small>
                            <b>{group.active_students ?? 0}{group.capacity ? `/${group.capacity}` : ""}</b>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rx-empty">{t("owStaff.noGroups")}</p>
                    )}
                  </div>
                ) : (
                  <p className="rx-empty">{t("owStaff.workOnlyTeachers")}</p>
                )
              ) : null}

              {detailTab === "salary" && canSeePay ? (
                <div className="ow-work">
                  <dl className="ow-sums">
                    <div>
                      <dt>{t("owFin.mAccrued")}</dt>
                      <dd>{money(detailRow.accrued, "UZS")}</dd>
                    </div>
                    <div>
                      <dt>{t("owFin.colPaid")}</dt>
                      <dd>{money(detailRow.paid, "UZS")}</dd>
                    </div>
                    <div>
                      <dt>{t("owStaff.left")}</dt>
                      <dd className={detailRow.remaining > 0 ? "is-red" : ""}>{money(detailRow.remaining, "UZS")}</dd>
                    </div>
                  </dl>
                  <dl className="rx-dl">
                    <div>
                      <dt>{t("owFin.fType")}</dt>
                      <dd>{paymentTypeLabel(detailRow.payment_type)}</dd>
                    </div>
                    <div>
                      <dt>{t("owFin.xRate")}</dt>
                      <dd>
                        {detailRow.payment_type === "per_lesson"
                          ? t("owStaff.perLesson", { amount: money(detailRow.salary_rate, "UZS") })
                          : money(detailRow.salary_rate, "UZS")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("owFin.colPaidOn")}</dt>
                      <dd>{detailRow.paidAt ? formatDate(detailRow.paidAt) : "—"}</dd>
                    </div>
                  </dl>
                  <p className="ow-note">{t("owStaff.salaryNote")}</p>
                  <div className="rx-next-actions">
                    {canWrite ? (
                      <button type="button" className="rx-btn is-outline" onClick={() => openEditModal(detailRow)}>
                        {t("owStaff.changeRate")}
                      </button>
                    ) : null}
                    <Link className="rx-btn is-primary" to={financePath}>
                      {t("owStaff.openPayroll")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {formOpen ? (
        <div className="overlay overlay-nested" role="dialog" aria-modal="true" aria-label={formMode === "create" ? t("owStaff.addTitle") : t("owStaff.editTitle")}>
          <button type="button" className="overlay-backdrop" aria-label={t("common.close")} onClick={() => !formSaving && setFormOpen(false)} />
          <div className="sheet billing-payment-sheet">
            <div className="sheet-head">
              <div>
                <h2>{formMode === "create" ? t("owStaff.addTitle") : t("owStaff.editTitle")}</h2>
                <p className="muted">{formMode === "create" ? t("owStaff.addHint") : t("owStaff.editHint")}</p>
              </div>
              <button type="button" className="sheet-close" aria-label={t("common.close")} onClick={() => !formSaving && setFormOpen(false)}>
                ×
              </button>
            </div>
            <form className="billing-payment-form-wrap" onSubmit={submitForm}>
              <div className="sheet-body billing-payment-form">
                {formMode === "create" ? (
                  <>
                    <Field label={t("owStaff.firstName")}>
                      <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                    </Field>
                    <Field label={t("owStaff.lastName")}>
                      <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                    </Field>
                    <Field label={t("owStaff.colPhone")}>
                      <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </Field>
                    <div className="billing-payment-span-2">
                      <Field label={t("owStaff.password")}>
                        <input
                          type="text"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <div className="billing-payment-span-2 staff-form-readonly">
                    <strong>{[form.first_name, form.last_name].filter(Boolean).join(" ") || form.email || "—"}</strong>
                    <span className="muted">{form.email || form.phone || "—"}</span>
                  </div>
                )}
                <Field label={t("owStaff.colRole")}>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLE_OPTIONS.filter((value) => !(formMode === "create" && value === "owner")).map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("owStaff.colPosition")}>
                  <input
                    placeholder={t("owStaff.positionPh")}
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </Field>
                <Field label={t("owFin.fHired")}>
                  <input type="date" value={form.hired_on || ""} onChange={(e) => setForm({ ...form, hired_on: e.target.value })} />
                </Field>
                <Field label={t("owFin.fType")}>
                  <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
                    <option value="">{t("owFin.typeNone")}</option>
                    {PAYMENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {t(item.label)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("owFin.fRate", { currency: "UZS" })}>
                  <MoneyInput value={form.salary_rate} onChange={(value) => setForm({ ...form, salary_rate: value })} />
                </Field>
                {formMode === "edit" ? (
                  <Field label={t("owStaff.colStatus")}>
                    <select
                      value={form.is_active ? "active" : "inactive"}
                      onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                    >
                      <option value="active">{t("owStaff.active")}</option>
                      <option value="inactive">{t("owStaff.inactive")}</option>
                    </select>
                  </Field>
                ) : null}
              </div>
              <div className="sheet-foot billing-payment-foot">
                <Button type="submit" disabled={formSaving}>
                  {formSaving ? t("owFin.saving") : formMode === "create" ? t("owStaff.addSubmit") : t("owFin.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
