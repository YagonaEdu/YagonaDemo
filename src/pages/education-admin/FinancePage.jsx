import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Banner, Button, Field, MoneyInput, RowActionsMenu } from "@/components/ui";
import { ROLE_LABELS } from "@/constants";
import { formatDateTime, t } from "@/i18n";
import { api, getSession } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import { hasCapability } from "@/utils/roleAccess";
import { formatDate, money, priceToApi, results, today, localIsoDate } from "@/utils/format";

const PAYMENT_TYPES = [
  { value: "fixed", label: "owFin.typeFixed" },
  { value: "per_lesson", label: "owFin.typePerLesson" },
  { value: "hourly", label: "owFin.typeHourly" },
];

const KPI_DEFS = [
  { key: "wallet", label: "owFin.kWallet", hint: "owFin.kWalletHint" },
  { key: "collected", label: "owFin.kCollected", hint: "owFin.kCollectedHint" },
  { key: "expected", label: "owFin.kExpected", hint: "owFin.kExpectedHint" },
  { key: "debt", label: "owFin.kDebt", hint: "owFin.kDebtHint", tone: "is-red" },
  { key: "payrollDue", label: "owFin.kPayrollDue", hint: "owFin.kPayrollDueHint", tone: "is-amber" },
  { key: "expenses", label: "owFin.kExpenses", hint: "owFin.kExpensesHint" },
];

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function paymentTypeLabel(value) {
  const label = PAYMENT_TYPES.find((item) => item.value === value)?.label;
  return label ? t(label) : "—";
}

function isoDate(value) {
  return localIsoDate(value);
}

function currentMonthValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function periodFirstDay(ym) {
  if (!ym) return today().slice(0, 8) + "01";
  return ym.length === 7 ? `${ym}-01` : ym.slice(0, 10);
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const label = formatDateTime(new Date(y, m - 1, 1), { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Lessons of whole calendar months (payroll counts per-lesson pay by month). */
function monthLessonsPath(firstDay) {
  const [y, m] = firstDay.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59, 999);
  return `/lessons?page_size=500&starts_at_from=${encodeURIComponent(from.toISOString())}&starts_at_to=${encodeURIComponent(to.toISOString())}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function toDatetimeLocal(value) {
  if (!value) return `${today()}T12:00`;
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function monthRange(dateStr = today()) {
  const d = new Date(`${dateStr}T12:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}

function inDateRange(value, from, to) {
  if (!value) return false;
  const day = isoDate(value);
  return day >= from && day <= to;
}

function invoiceBalance(invoice) {
  return Math.max(0, asNumber(invoice.amount) - asNumber(invoice.paid_amount));
}

function isOpenInvoice(invoice) {
  return !["void", "draft", "paid"].includes(invoice.status) && invoiceBalance(invoice) > 0;
}

function computeStaffAccrued(member, lessonCount) {
  const rate = asNumber(member.salary_rate);
  if (!member.payment_type || !rate) return 0;
  if (member.payment_type === "per_lesson") return rate * lessonCount;
  return rate;
}

function computeTenure(hiredOn) {
  if (!hiredOn) {
    return { years: 0, months: 0, totalMonths: 0, label: "—" };
  }
  const start = new Date(`${hiredOn}T12:00:00`);
  const now = new Date();
  let totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years) parts.push(t("owFin.tenureYears", { count: years }));
  if (months) parts.push(t("owFin.tenureMonths", { count: months }));
  if (!parts.length) parts.push(t("owFin.tenureLess"));
  return { years, months, totalMonths, label: parts.join(" ") };
}

function staffDisplayName(row) {
  const user = row.user || {};
  return (
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.email ||
    "—"
  );
}

function buildPayrollRow(item, lessonsForMonth, recordMap, period, payoutCounts) {
  const lessonCount = lessonsForMonth.filter(
    (lesson) => String(lesson.teacher) === String(item.id),
  ).length;
  const accrued = computeStaffAccrued(item, lessonCount);
  const monthRecord = recordMap.get(String(item.id));
  const paid =
    monthRecord?.status === "paid"
      ? asNumber(monthRecord.paid_amount)
      : asNumber(monthRecord?.paid_amount);
  const tenure = computeTenure(item.hired_on);
  return {
    ...item,
    customPosition: item.position || "",
    lessonCount,
    accrued,
    paid,
    remaining: Math.max(0, accrued - paid),
    name: staffDisplayName(item),
    tenure,
    payoutCount: payoutCounts.get(String(item.id)) || 0,
    monthRecord: monthRecord || null,
    monthStatus: monthRecord?.status || "unpaid",
    period,
  };
}

function salaryPatchPayload(data) {
  return {
    position: data.position || "",
    hired_on: data.hired_on || null,
    payment_type: data.payment_type || "",
    salary_rate: priceToApi(data.salary_rate || "0"),
    salary_paid_month: priceToApi(data.salary_paid_month || "0"),
    last_payout_at: data.last_payout_at ? new Date(data.last_payout_at).toISOString() : null,
    last_payout_amount: data.last_payout_amount ? priceToApi(data.last_payout_amount) : null,
  };
}

function buildSalaryForm(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    position: row.customPosition || "",
    hired_on: row.hired_on || "",
    payment_type: row.payment_type || "",
    salary_rate: row.salary_rate ? String(Math.floor(asNumber(row.salary_rate))) : "",
    salary_paid_month: row.paid ? String(Math.floor(row.paid)) : "",
    last_payout_at: toDatetimeLocal(row.monthRecord?.paid_at || row.last_payout_at),
    last_payout_amount: row.monthRecord?.paid_amount
      ? String(Math.floor(asNumber(row.monthRecord.paid_amount)))
      : row.last_payout_amount
        ? String(Math.floor(asNumber(row.last_payout_amount)))
        : "",
  };
}

/** Whole list (shared pagination helper; large pages keep it to few requests). */
function fetchAll(path) {
  return getList(path.includes("page_size=") ? path : `${path}${path.includes("?") ? "&" : "?"}page_size=500`);
}

function FinanceBars({ points, currency }) {
  const max = Math.max(...points.map((item) => item.amount), 1);
  return (
    <ol className="ow-bars is-flow">
      {points.map((item) => (
        <li key={item.key} className={item.tone} title={`${item.label}: ${money(item.amount, currency)}`}>
          <b>{item.amount ? money(item.amount, currency) : "—"}</b>
          <span className="ow-bar">
            <i style={{ height: `${Math.max(item.amount > 0 ? 4 : 0, Math.round((item.amount / max) * 100))}%` }} />
          </span>
          <small>{item.label}</small>
        </li>
      ))}
    </ol>
  );
}

function SalaryBadge({ paid }) {
  return (
    <span className={`rx-pill ${paid ? "is-teal" : "is-amber"}`}>
      {paid ? t("owFin.statusPaid") : t("owFin.statusUnpaid")}
    </span>
  );
}

export default function FinancePage() {
  const slug = getSession().tenantSlug;
  const base = slug ? `/education/${slug}` : "..";
  const role = currentMembership()?.role || "";
  const canWrite = hasCapability(role, "finance.manage");
  const [pageTab, setPageTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [lessonsByMonth, setLessonsByMonth] = useState({});
  const lessonsByMonthRef = useRef({});
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [payrollSearch, setPayrollSearch] = useState("");
  const [payrollType, setPayrollType] = useState("");
  const [payrollDueOnly, setPayrollDueOnly] = useState(false);
  const [payrollStatus, setPayrollStatus] = useState("");
  const [salaryForm, setSalaryForm] = useState(null);
  const [salarySaving, setSalarySaving] = useState(false);
  const [payForm, setPayForm] = useState(null);
  const [paySaving, setPaySaving] = useState(false);
  const [actionSaving, setActionSaving] = useState(null);

  const range = useMemo(() => monthRange(), []);
  const payrollRange = useMemo(() => monthRange(periodFirstDay(selectedMonth)), [selectedMonth]);
  const currency = invoices[0]?.currency || payments[0]?.currency || "UZS";
  const lessons = useMemo(() => Object.values(lessonsByMonth).flat(), [lessonsByMonth]);

  const payoutCounts = useMemo(() => {
    const map = new Map();
    salaryRecords.forEach((record) => {
      if (record.status !== "paid") return;
      const key = String(record.membership);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [salaryRecords]);

  const currentPeriodRecords = useMemo(() => {
    return salaryRecords.filter((record) => record.period === range.from);
  }, [salaryRecords, range.from]);

  const selectedPeriodRecords = useMemo(() => {
    const period = periodFirstDay(selectedMonth);
    const map = new Map();
    salaryRecords
      .filter((record) => record.period === period)
      .forEach((record) => map.set(String(record.membership), record));
    return map;
  }, [salaryRecords, selectedMonth]);

  const succeededPayments = useMemo(
    () => payments.filter((item) => item.status === "succeeded"),
    [payments],
  );

  const staffRows = useMemo(() => {
    const period = periodFirstDay(selectedMonth);
    const lessonsForMonth = lessons.filter((item) =>
      inDateRange(item.starts_at, payrollRange.from, payrollRange.to),
    );
    return staff.map((item) => buildPayrollRow(item, lessonsForMonth, selectedPeriodRecords, period, payoutCounts));
  }, [staff, lessons, payrollRange, selectedPeriodRecords, selectedMonth, payoutCounts]);

  const overviewStaffRows = useMemo(() => {
    const recordMap = new Map();
    currentPeriodRecords.forEach((record) => recordMap.set(String(record.membership), record));
    const lessonsForMonth = lessons.filter((item) => inDateRange(item.starts_at, range.from, range.to));
    return staff.map((item) => buildPayrollRow(item, lessonsForMonth, recordMap, range.from, payoutCounts));
  }, [staff, lessons, range, currentPeriodRecords, payoutCounts]);

  const filteredPayrollRows = useMemo(() => {
    const q = payrollSearch.trim().toLowerCase();
    return staffRows
      .filter((row) => {
        if (payrollType && row.payment_type !== payrollType) return false;
        if (payrollDueOnly && row.remaining <= 0) return false;
        if (payrollStatus === "paid" && row.monthStatus !== "paid") return false;
        if (payrollStatus === "unpaid" && row.monthStatus === "paid") return false;
        if (q && !row.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
  }, [staffRows, payrollSearch, payrollType, payrollDueOnly, payrollStatus]);

  const monthRegisterStats = useMemo(() => {
    const baseRows = staffRows.filter((row) => row.is_active);
    const paidRows = baseRows.filter((row) => row.monthStatus === "paid");
    const unpaidRows = baseRows.filter(
      (row) => row.monthStatus !== "paid" && (row.accrued > 0 || row.payment_type),
    );
    return {
      paidCount: paidRows.length,
      unpaidCount: unpaidRows.length,
      totalStaff: baseRows.length,
      paidAmount: paidRows.reduce((sum, row) => sum + row.paid, 0),
      accruedAmount: baseRows.reduce((sum, row) => sum + row.accrued, 0),
    };
  }, [staffRows]);

  const stats = useMemo(() => {
    const collected = succeededPayments
      .filter((item) => inDateRange(item.paid_at, range.from, range.to))
      .reduce((sum, item) => sum + asNumber(item.amount), 0);

    const expected = invoices
      .filter((item) => isOpenInvoice(item) && inDateRange(item.due_at, range.from, range.to))
      .reduce((sum, item) => sum + invoiceBalance(item), 0);

    const debt = invoices.filter(isOpenInvoice).reduce((sum, item) => sum + invoiceBalance(item), 0);

    const currentRows = staff
      .filter((item) => item.is_active)
      .map((item) => {
        const lessonCount = lessons.filter(
          (lesson) =>
            String(lesson.teacher) === String(item.id) &&
            inDateRange(lesson.starts_at, range.from, range.to),
        ).length;
        const accrued = computeStaffAccrued(item, lessonCount);
        const record = currentPeriodRecords.find((r) => String(r.membership) === String(item.id));
        const paid = record?.status === "paid" ? asNumber(record.paid_amount) : 0;
        return { accrued, paid, remaining: Math.max(0, accrued - paid) };
      });

    const payrollAccrued = currentRows.reduce((sum, item) => sum + item.accrued, 0);
    const payrollPaid = currentPeriodRecords
      .filter((record) => record.status === "paid")
      .reduce((sum, record) => sum + asNumber(record.paid_amount), 0);
    const payrollDue = currentRows.reduce((sum, item) => sum + item.remaining, 0);
    const expenses = payrollPaid;
    const wallet = collected - expenses;

    return { collected, expected, debt, payrollAccrued, payrollPaid, payrollDue, expenses, wallet };
  }, [succeededPayments, invoices, staff, lessons, range, currentPeriodRecords]);

  const flowPoints = [
    { key: "in", label: t("owFin.flowIn"), amount: stats.collected, tone: "is-green" },
    { key: "exp", label: t("owFin.flowOut"), amount: stats.expenses, tone: "is-red" },
    { key: "due", label: t("owFin.flowExpected"), amount: stats.expected, tone: "is-amber" },
    { key: "pay", label: t("owFin.flowPayroll"), amount: stats.payrollDue, tone: "is-blue" },
  ];

  const loadMonthLessons = useCallback(async (firstDay, { force = false } = {}) => {
    if (!force && lessonsByMonthRef.current[firstDay]) return;
    const rows = results(await getList(monthLessonsPath(firstDay)));
    lessonsByMonthRef.current = { ...lessonsByMonthRef.current, [firstDay]: rows };
    setLessonsByMonth(lessonsByMonthRef.current);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invoiceData, paymentData, staffData, salaryData] = await Promise.all([
        fetchAll("/invoices"),
        fetchAll("/payments"),
        fetchAll("/staff"),
        fetchAll("/salary-records"),
        loadMonthLessons(range.from, { force: true }),
      ]);
      setInvoices(invoiceData);
      setPayments(paymentData);
      setStaff(staffData);
      setSalaryRecords(salaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadMonthLessons, range.from]);

  useEffect(() => {
    load();
  }, [load]);

  // Payroll of another month counts that month's lessons: fetch them when the month changes.
  useEffect(() => {
    loadMonthLessons(periodFirstDay(selectedMonth)).catch((err) => setError(err.message));
  }, [selectedMonth, loadMonthLessons]);

  useEffect(() => {
    if (!info) return undefined;
    const timer = window.setTimeout(() => setInfo(""), 3200);
    return () => window.clearTimeout(timer);
  }, [info]);

  async function reload() {
    await Promise.all([load(), loadMonthLessons(periodFirstDay(selectedMonth), { force: true })]);
  }

  function openSalaryEdit(row) {
    setSalaryForm(buildSalaryForm(row));
  }

  function openPayModal(row) {
    setPayForm({
      id: row.id,
      name: row.name,
      amount:
        row.remaining > 0
          ? String(Math.floor(row.remaining))
          : row.accrued > 0
            ? String(Math.floor(row.accrued))
            : "",
      paid_at: `${today()}T12:00`,
      accrued: row.accrued,
      recordId: row.monthRecord?.id || null,
    });
  }

  async function upsertSalaryRecord(payload) {
    await api.post("/salary-records", payload);
  }

  async function setMonthSalaryStatus(row, status) {
    if (!canWrite) return;
    const payoutAmount = row.accrued > 0 ? row.accrued : asNumber(row.salary_rate);
    if (status === "paid" && payoutAmount <= 0) {
      setError(t("owFin.errNoRate"));
      openPayModal(row);
      return;
    }
    setActionSaving(row.id);
    setError("");
    try {
      await upsertSalaryRecord({
        membership: row.id,
        period: periodFirstDay(selectedMonth),
        accrued_amount: priceToApi(String(Math.floor(row.accrued > 0 ? row.accrued : payoutAmount))),
        status,
        paid_amount: status === "paid" ? priceToApi(String(Math.floor(payoutAmount))) : priceToApi("0"),
        paid_at: status === "paid" ? new Date().toISOString() : null,
      });
      setInfo(status === "paid" ? t("owFin.infoMarkedPaid") : t("owFin.infoUnmarked"));
      await reload();
    } catch (err) {
      setError(err.message || t("owFin.errSave"));
    } finally {
      setActionSaving(null);
    }
  }

  async function saveSalary(event) {
    event.preventDefault();
    if (!salaryForm || !canWrite) return;
    setSalarySaving(true);
    setError("");
    try {
      await api.patch(`/staff/${salaryForm.id}`, salaryPatchPayload(salaryForm));
      const paidAmount = asNumber(priceToApi(salaryForm.salary_paid_month));
      if (paidAmount > 0) {
        await upsertSalaryRecord({
          membership: salaryForm.id,
          period: periodFirstDay(selectedMonth),
          accrued_amount: priceToApi(salaryForm.salary_rate || "0"),
          paid_amount: priceToApi(salaryForm.salary_paid_month),
          paid_at: salaryForm.last_payout_at
            ? new Date(salaryForm.last_payout_at).toISOString()
            : new Date().toISOString(),
          status: "paid",
          notes: "",
        });
      }
      setSalaryForm(null);
      setInfo(t("owFin.infoSalarySaved"));
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalarySaving(false);
    }
  }

  async function submitPay(event) {
    event.preventDefault();
    if (!payForm || !canWrite) return;
    const amount = asNumber(priceToApi(payForm.amount));
    if (amount <= 0) {
      setError(t("owFin.errAmount"));
      return;
    }
    setPaySaving(true);
    setError("");
    try {
      await upsertSalaryRecord({
        membership: payForm.id,
        period: periodFirstDay(selectedMonth),
        accrued_amount: priceToApi(String(Math.floor(payForm.accrued || amount))),
        paid_amount: priceToApi(payForm.amount),
        paid_at: new Date(payForm.paid_at).toISOString(),
        status: "paid",
      });
      setPayForm(null);
      setInfo(t("owFin.infoPayout"));
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaySaving(false);
    }
  }

  async function exportPayroll() {
    const { downloadExcelBook, excelStamp } = await import("@/utils/exportExcel");
    const periodTitle = monthLabel(selectedMonth);
    const statusLabel = (row) => (row.monthStatus === "paid" ? t("owFin.statusPaid") : t("owFin.statusUnpaid"));
    downloadExcelBook(`payroll_${selectedMonth}_${excelStamp()}`, [
      {
        name: t("owFin.xRegister", { month: selectedMonth }),
        rows: filteredPayrollRows,
        columns: [
          { title: t("owFin.xMonth"), value: () => periodTitle },
          { title: t("owFin.colStaff"), value: (row) => row.name },
          { title: t("owFin.xRole"), value: (row) => ROLE_LABELS[row.role] || row.role },
          { title: t("owFin.fPosition"), value: (row) => row.customPosition || "—" },
          { title: t("owFin.colSince"), value: (row) => (row.hired_on ? formatDate(row.hired_on) : "—") },
          { title: t("owFin.colTenure"), value: (row) => row.tenure.label },
          { title: t("owFin.xYears"), value: (row) => row.tenure.years },
          { title: t("owFin.xMonthsTotal"), value: (row) => row.tenure.totalMonths },
          { title: t("owFin.colPayouts"), value: (row) => row.payoutCount },
          { title: t("owFin.fType"), value: (row) => paymentTypeLabel(row.payment_type) },
          { title: t("owFin.xRate"), value: (row) => row.salary_rate },
          { title: t("owFin.colAccrued"), value: (row) => row.accrued },
          { title: t("owFin.fMonthStatus"), value: statusLabel },
          { title: t("owFin.colPaid"), value: (row) => row.paid },
          {
            title: t("owFin.colPaidOn"),
            value: (row) => (row.monthRecord?.paid_at ? formatDate(row.monthRecord.paid_at) : ""),
          },
        ],
      },
      {
        name: t("owFin.xHistory"),
        rows: salaryRecords
          .filter((record) => record.status === "paid")
          .sort((a, b) => String(b.period).localeCompare(String(a.period))),
        columns: [
          { title: t("owFin.xPeriod"), value: (row) => monthLabel(String(row.period).slice(0, 7)) },
          { title: t("owFin.colStaff"), value: (row) => row.staff_name || row.membership },
          { title: t("owFin.xRole"), value: (row) => ROLE_LABELS[row.staff_role] || row.staff_role || "—" },
          { title: t("owFin.colAccrued"), value: (row) => row.accrued_amount },
          { title: t("owFin.colPaid"), value: (row) => row.paid_amount },
          { title: t("owFin.xDate"), value: (row) => (row.paid_at ? formatDate(row.paid_at) : "") },
          { title: t("owFin.xNote"), value: (row) => row.notes || "" },
        ],
      },
    ]);
  }

  const overviewRows = overviewStaffRows
    .filter((row) => row.is_active)
    .filter((row) => row.accrued > 0 || row.paid > 0 || row.payoutCount > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 6);

  return (
    <div className="reception-page finance-page ow-finance">
      <header className="rx-hero">
        <div>
          <p className="rx-hero-date">
            {pageTab === "payroll"
              ? t("owFin.periodPayroll", {
                  month: monthLabel(selectedMonth),
                  from: formatDate(payrollRange.from),
                  to: formatDate(payrollRange.to),
                })
              : t("owFin.period", { from: formatDate(range.from), to: formatDate(range.to) })}
          </p>
          <h1>{t("owFin.title")}</h1>
        </div>
        <div className="rx-hero-actions">
          <div className="rx-seg" role="tablist" aria-label={t("owFin.title")}>
            {[
              ["overview", t("owFin.tabOverview")],
              ["payroll", t("owFin.tabPayroll")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={pageTab === value}
                className={pageTab === value ? "is-active" : ""}
                onClick={() => setPageTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="rx-btn is-outline" onClick={exportPayroll}>
            {t("owFin.excel")}
          </button>
        </div>
      </header>

      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}
      {loading ? <p className="rx-loading">{t("owFin.loading")}</p> : null}

      <section className="rx-stats ow-stats-3" aria-label={t("owFin.title")}>
        {KPI_DEFS.map((item) => (
          <article key={item.key} className="rx-stat">
            <span>{t(item.label)}</span>
            <strong className={stats[item.key] < 0 ? "is-red" : stats[item.key] > 0 && item.tone ? item.tone : ""}>
              {money(stats[item.key], currency)}
            </strong>
            <small>{t(item.hint)}</small>
          </article>
        ))}
      </section>

      {pageTab === "overview" ? (
        <>
          <div className="rx-grid ow-grid-even">
            <section className="rx-card">
              <div className="rx-card-head">
                <div>
                  <h2>{t("owFin.flow")}</h2>
                  <p>{t("owFin.flowHint")}</p>
                </div>
              </div>
              <FinanceBars points={flowPoints} currency={currency} />
              <dl className="ow-sums">
                <div>
                  <dt>{t("owFin.sumIn")}</dt>
                  <dd>{money(stats.collected, currency)}</dd>
                </div>
                <div>
                  <dt>{t("owFin.sumOut")}</dt>
                  <dd>{money(stats.expenses, currency)}</dd>
                </div>
                <div>
                  <dt>{t("owFin.sumWallet")}</dt>
                  <dd className={stats.wallet < 0 ? "is-red" : ""}>{money(stats.wallet, currency)}</dd>
                </div>
              </dl>
              <p className="ow-note">{t("owFin.walletNote")}</p>
            </section>

            <section className="rx-card">
              <div className="rx-card-head">
                <div>
                  <h2>{t("owFin.expected")}</h2>
                  <p>{t("owFin.expectedHint")}</p>
                </div>
                <Link className="rx-link is-head" to={`${base}/billing`}>
                  {t("owFin.openBilling")}
                </Link>
              </div>
              <dl className="ow-sums is-stacked">
                <div>
                  <dt>{t("owFin.dueThisMonth")}</dt>
                  <dd>{money(stats.expected, currency)}</dd>
                </div>
                <div>
                  <dt>{t("owFin.totalDebt")}</dt>
                  <dd className={stats.debt > 0 ? "is-red" : ""}>{money(stats.debt, currency)}</dd>
                </div>
                <div>
                  <dt>{t("owFin.forecast")}</dt>
                  <dd>{money(stats.collected + stats.expected, currency)}</dd>
                </div>
              </dl>
              <p className="ow-note">{t("owFin.forecastNote")}</p>
            </section>
          </div>

          <section className="rx-card">
            <div className="rx-card-head">
              <div>
                <h2>{t("owFin.payrollShort")}</h2>
                <p>{t("owFin.payrollShortHint")}</p>
              </div>
              <button type="button" className="rx-link is-head" onClick={() => setPageTab("payroll")}>
                {t("owFin.openPayroll")}
              </button>
            </div>
            {overviewRows.length ? (
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>{t("owFin.colStaff")}</th>
                      <th>{t("owFin.colTenure")}</th>
                      <th>{t("owFin.colAccrued")}</th>
                      <th>{t("owFin.colStatus")}</th>
                      <th>{t("owFin.colPaid")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>{row.tenure.label}</td>
                        <td>{money(row.accrued, currency)}</td>
                        <td>
                          <SalaryBadge paid={row.monthStatus === "paid"} />
                        </td>
                        <td>{money(row.paid, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rx-empty">{t("owFin.payrollEmpty")}</p>
            )}
          </section>
        </>
      ) : null}

      {pageTab === "payroll" ? (
        <section className="rx-card">
          <div className="rx-card-head">
            <div>
              <h2>{t("owFin.register")}</h2>
              <p>
                {t("owFin.registerHint", {
                  paid: monthRegisterStats.paidCount,
                  total: monthRegisterStats.totalStaff,
                  amount: money(monthRegisterStats.paidAmount, currency),
                })}
              </p>
            </div>
            <div className="finance-month-bar">
              <button
                type="button"
                className="rx-btn is-outline is-sm"
                aria-label={t("owFin.prevMonth")}
                onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))}
              >
                ←
              </button>
              <div className="finance-month-picker">
                <strong>{monthLabel(selectedMonth)}</strong>
                <input
                  type="month"
                  aria-label={t("owFin.pickMonth")}
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="rx-btn is-outline is-sm"
                aria-label={t("owFin.nextMonth")}
                onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))}
              >
                →
              </button>
            </div>
          </div>

          <div className="rx-stats rx-stats-4">
            <article className="rx-stat">
              <span>{t("owFin.mPaid")}</span>
              <strong>{monthRegisterStats.paidCount}</strong>
            </article>
            <article className="rx-stat">
              <span>{t("owFin.mUnpaid")}</span>
              <strong className={monthRegisterStats.unpaidCount ? "is-amber" : ""}>{monthRegisterStats.unpaidCount}</strong>
            </article>
            <article className="rx-stat">
              <span>{t("owFin.mAccrued")}</span>
              <strong>{money(monthRegisterStats.accruedAmount, currency)}</strong>
            </article>
            <article className="rx-stat">
              <span>{t("owFin.mPaidAmount")}</span>
              <strong>{money(monthRegisterStats.paidAmount, currency)}</strong>
            </article>
          </div>

          <div className="finance-payroll-filters finance-payroll-filters-wide">
            <Field label={t("owFin.fSearch")}>
              <input
                placeholder={t("owFin.fSearchPh")}
                value={payrollSearch}
                onChange={(e) => setPayrollSearch(e.target.value)}
              />
            </Field>
            <Field label={t("owFin.fType")}>
              <select value={payrollType} onChange={(e) => setPayrollType(e.target.value)}>
                <option value="">{t("owFin.all")}</option>
                {PAYMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("owFin.fMonthStatus")}>
              <select value={payrollStatus} onChange={(e) => setPayrollStatus(e.target.value)}>
                <option value="">{t("owFin.all")}</option>
                <option value="paid">{t("owFin.statusPaid")}</option>
                <option value="unpaid">{t("owFin.statusUnpaid")}</option>
              </select>
            </Field>
            <Field label={t("owFin.fFilter")}>
              <label className="finance-check">
                <input
                  type="checkbox"
                  checked={payrollDueOnly}
                  onChange={(e) => setPayrollDueOnly(e.target.checked)}
                />
                {t("owFin.fDueOnly")}
              </label>
            </Field>
          </div>

          {filteredPayrollRows.length ? (
            <div className="finance-table-wrap">
              <table className="finance-table finance-payroll-table">
                <thead>
                  <tr>
                    <th>{t("owFin.colStaff")}</th>
                    <th>{t("owFin.colSince")}</th>
                    <th>{t("owFin.colTenure")}</th>
                    <th>{t("owFin.colPayouts")}</th>
                    <th>{t("owFin.colAccrued")}</th>
                    <th>{t("owFin.colStatus")}</th>
                    <th>{t("owFin.colPaid")}</th>
                    <th>{t("owFin.colPaidOn")}</th>
                    {canWrite ? <th>{t("owFin.colAction")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrollRows.map((row) => (
                    <tr key={row.id} className={row.monthStatus === "paid" ? "finance-row-paid" : "finance-row-unpaid"}>
                      <td>
                        <strong>{row.name}</strong>
                        <span className="muted">
                          {ROLE_LABELS[row.role] || row.role}
                          {!row.is_active ? ` · ${t("owFin.inactive")}` : ""}
                        </span>
                      </td>
                      <td>{row.hired_on ? formatDate(row.hired_on) : "—"}</td>
                      <td>{row.tenure.label}</td>
                      <td>
                        <span className="finance-payout-count">{row.payoutCount}</span>
                      </td>
                      <td>{money(row.accrued, currency)}</td>
                      <td>
                        <SalaryBadge paid={row.monthStatus === "paid"} />
                      </td>
                      <td>{money(row.paid, currency)}</td>
                      <td>{row.monthRecord?.paid_at ? formatDate(row.monthRecord.paid_at) : "—"}</td>
                      {canWrite ? (
                        <td>
                          <div className="finance-row-actions">
                            {row.monthStatus !== "paid" ? (
                              <button
                                type="button"
                                className="rx-btn is-primary is-sm"
                                disabled={actionSaving === row.id}
                                onClick={() => setMonthSalaryStatus(row, "paid")}
                              >
                                {t("owFin.markPaid")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rx-btn is-outline is-sm"
                                disabled={actionSaving === row.id}
                                onClick={() => setMonthSalaryStatus(row, "unpaid")}
                              >
                                {t("owFin.undo")}
                              </button>
                            )}
                            <RowActionsMenu
                              items={[
                                { label: t("owFin.edit"), onClick: () => openSalaryEdit(row) },
                                { label: t("owFin.payWithAmount"), onClick: () => openPayModal(row) },
                              ]}
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rx-empty">{t("owFin.registerEmpty")}</p>
          )}
        </section>
      ) : null}

      {salaryForm ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("owFin.salaryTitle", { name: salaryForm.name })}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("common.close")}
            onClick={() => !salarySaving && setSalaryForm(null)}
          />
          <div className="sheet billing-payment-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("owFin.salaryTitle", { name: salaryForm.name })}</h2>
                <p className="muted">
                  {ROLE_LABELS[salaryForm.role] || salaryForm.role} · {monthLabel(selectedMonth)}
                </p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("common.close")}
                onClick={() => !salarySaving && setSalaryForm(null)}
              >
                ×
              </button>
            </div>
            <form className="billing-payment-form-wrap" onSubmit={saveSalary}>
              <div className="sheet-body billing-payment-form">
                <div className="billing-payment-span-2">
                  <Field label={t("owFin.fPosition")}>
                    <input
                      value={salaryForm.position}
                      onChange={(e) => setSalaryForm({ ...salaryForm, position: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label={t("owFin.fHired")}>
                  <input
                    type="date"
                    value={salaryForm.hired_on || ""}
                    onChange={(e) => setSalaryForm({ ...salaryForm, hired_on: e.target.value })}
                  />
                </Field>
                <Field label={t("owFin.fType")}>
                  <select
                    value={salaryForm.payment_type}
                    onChange={(e) => setSalaryForm({ ...salaryForm, payment_type: e.target.value })}
                  >
                    <option value="">{t("owFin.typeNone")}</option>
                    {PAYMENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {t(item.label)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("owFin.fRate", { currency })}>
                  <MoneyInput
                    value={salaryForm.salary_rate}
                    onChange={(value) => setSalaryForm({ ...salaryForm, salary_rate: value })}
                  />
                </Field>
                <Field label={t("owFin.fPaidMonth", { currency })}>
                  <MoneyInput
                    value={salaryForm.salary_paid_month}
                    onChange={(value) => setSalaryForm({ ...salaryForm, salary_paid_month: value })}
                  />
                </Field>
                <Field label={t("owFin.colPaidOn")}>
                  <input
                    type="datetime-local"
                    value={salaryForm.last_payout_at}
                    onChange={(e) => setSalaryForm({ ...salaryForm, last_payout_at: e.target.value })}
                  />
                </Field>
                <Field label={t("owFin.fPayAmount", { currency })}>
                  <MoneyInput
                    value={salaryForm.last_payout_amount}
                    onChange={(value) => setSalaryForm({ ...salaryForm, last_payout_amount: value })}
                  />
                </Field>
              </div>
              <div className="sheet-foot billing-payment-foot">
                <Button type="submit" disabled={salarySaving}>
                  {salarySaving ? t("owFin.saving") : t("owFin.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {payForm ? (
        <div className="overlay overlay-nested" role="dialog" aria-modal="true" aria-label={t("owFin.payTitle", { name: payForm.name })}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("common.close")}
            onClick={() => !paySaving && setPayForm(null)}
          />
          <div className="sheet billing-payment-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("owFin.payTitle", { name: payForm.name })}</h2>
                <p className="muted">{t("owFin.payHint", { month: monthLabel(selectedMonth) })}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("common.close")}
                onClick={() => !paySaving && setPayForm(null)}
              >
                ×
              </button>
            </div>
            <form className="billing-payment-form-wrap" onSubmit={submitPay}>
              <div className="sheet-body billing-payment-form">
                <Field label={t("owFin.fPayAmount", { currency })}>
                  <MoneyInput
                    required
                    value={payForm.amount}
                    onChange={(value) => setPayForm({ ...payForm, amount: value })}
                  />
                </Field>
                <Field label={t("owFin.colPaidOn")}>
                  <input
                    type="datetime-local"
                    required
                    value={payForm.paid_at}
                    onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                  />
                </Field>
              </div>
              <div className="sheet-foot billing-payment-foot">
                <Button type="submit" disabled={paySaving}>
                  {paySaving ? t("owFin.saving") : t("owFin.registerPayout")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
