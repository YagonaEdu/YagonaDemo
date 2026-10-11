import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  RowActionsMenu,
} from "@/components/ui";
import { api } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import {
  formatDate,
  formatTime,
  formatUzPhone,
  formatWhen,
  money,
  priceToApi,
  today,
  localIsoDate,
} from "@/utils/format";
import { formatDateTime, t, translated } from "@/i18n";

const PAYMENT_METHODS = [
  { value: "cash", label: "t:aBill.cash" },
  { value: "card", label: "t:aBill.card" },
  { value: "bank_transfer", label: "t:aBill.bankTransfer" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
].map(translated);

const PAYMENT_STATUS_LABELS = translated({
  paid: "t:aBill.stPaid",
  partially_paid: "t:aBill.stPartial",
  debt: "t:aBill.stDebt",
  overdue: "t:aBill.stOverdue",
});

const KPI_DEFS = [
  { key: "collected", label: "t:aBill.kpiCollected", tone: "green", icon: "↓" },
  { key: "debt", label: "t:aBill.kpiDebt", tone: "red", icon: "!" },
  { key: "expected", label: "t:aBill.kpiExpected", tone: "orange", icon: "◷" },
  { key: "today", label: "t:aBill.kpiToday", tone: "blue", icon: "✓" },
  { key: "debtors", label: "t:aBill.kpiDebtors", tone: "red", icon: "∑" },
  { key: "avg", label: "t:aBill.kpiAvg", tone: "blue", icon: "Ø" },
].map(translated);

function methodLabel(value) {
  return PAYMENT_METHODS.find((item) => item.value === value)?.label || value || "—";
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function invoiceBalance(invoice) {
  return Math.max(0, asNumber(invoice.amount) - asNumber(invoice.paid_amount));
}

function isOpenInvoice(invoice) {
  return !["void", "draft", "paid"].includes(invoice.status) && invoiceBalance(invoice) > 0;
}

function isOverdueInvoice(invoice, now = new Date()) {
  if (!isOpenInvoice(invoice)) return false;
  if (invoice.status === "overdue") return true;
  return new Date(invoice.due_at) < now;
}

function isoDate(value) {
  return localIsoDate(value);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function computeRange(preset, anchorDate, customFrom, customTo) {
  if (preset === "custom") {
    return { from: customFrom || anchorDate, to: customTo || anchorDate };
  }
  if (preset === "today") {
    const d = anchorDate || today();
    return { from: d, to: d };
  }
  const anchor = new Date(`${anchorDate || today()}T12:00:00`);
  if (preset === "week") {
    const day = anchor.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(anchor);
    mon.setDate(anchor.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}

function inDateRange(value, from, to) {
  if (!value) return false;
  const day = isoDate(value);
  return day >= from && day <= to;
}

function paymentDayKey(value) {
  return isoDate(value);
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Whole list (shared pagination helper; large pages keep it to few requests). */
function fetchAll(path) {
  return getList(path.includes("page_size=") ? path : `${path}${path.includes("?") ? "&" : "?"}page_size=500`);
}

function deriveStudentStatus(invoices, now = new Date()) {
  const open = invoices.filter(isOpenInvoice);
  if (!open.length) return invoices.length ? "paid" : "none";
  if (open.some((item) => isOverdueInvoice(item, now))) return "overdue";
  if (open.some((item) => asNumber(item.paid_amount) > 0)) return "partially_paid";
  return "debt";
}

function formatShortMoney(value, currency = "UZS") {
  const amount = asNumber(value);
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const text = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(/\.0$/, "");
    return `${text} mln ${currency}`;
  }
  if (amount >= 1_000) {
    const thousands = Math.round(amount / 1_000);
    return `${thousands}k ${currency}`;
  }
  return money(amount, currency);
}

function RevenueTrendChart({ points, currency, view }) {
  const total = points.reduce((sum, item) => sum + item.amount, 0);
  const max = Math.max(...points.map((item) => item.amount), 1);
  const peak = points.reduce(
    (best, item) => (item.amount > best.amount ? item : best),
    points[0] || { amount: 0, label: "—" },
  );

  return (
    <div className="billing-trend">
      <div className="billing-trend-summary">
        <div>
          <span className="muted">{t("aBill.totalForPeriod")}</span>
          <strong>{money(total, currency)}</strong>
        </div>
        <div>
          <span className="muted">{t("aBill.bestDay")}</span>
          <strong>{peak.amount ? `${peak.label} · ${money(peak.amount, currency)}` : "—"}</strong>
        </div>
        <div>
          <span className="muted">{t("aBill.maximum")}</span>
          <strong>{formatShortMoney(max, currency)}</strong>
        </div>
      </div>

      {!total ? (
        <p className="billing-trend-empty muted">{t("aBill.noIncomeInThe")}</p>
      ) : null}

      <div
        className={`billing-trend-bars${view === "30d" ? " is-scroll" : ""}`}
        style={
          view !== "30d"
            ? { gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {points.map((item) => {
          const height = item.amount > 0 ? Math.max(8, Math.round((item.amount / max) * 100)) : 0;
          return (
            <div
              key={item.key}
              className={`billing-trend-bar${item.amount > 0 ? " has-value" : ""}`}
              title={`${item.label}: ${money(item.amount, currency)}`}
            >
              <div className="billing-trend-bar-track">
                {item.amount > 0 ? (
                  <div className="billing-trend-bar-fill" style={{ height: `${height}%` }}>
                    <span className="billing-trend-bar-value">
                      {formatShortMoney(item.amount, currency)}
                    </span>
                  </div>
                ) : null}
              </div>
              {item.shortLabel ? (
                <span className="billing-trend-bar-label">{item.shortLabel}</span>
              ) : (
                <span className="billing-trend-bar-label is-empty" aria-hidden="true">
                  ·
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const label = PAYMENT_STATUS_LABELS[status] || status;
  const cls =
    status === "paid"
      ? "paid"
      : status === "partially_paid"
        ? "partially_paid"
        : status === "overdue"
          ? "overdue"
          : "issued";
  return <span className={`status ${cls}`}>{label}</span>;
}

function StudentSearchSelect({ students, value, onChange, disabled, required }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = students.find((item) => String(item.id) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? students.filter((item) => {
          const phone = (item.phone || "").replace(/\D/g, "");
          const hay = `${item.full_name} ${item.phone || ""} ${phone}`.toLowerCase();
          return hay.includes(q);
        })
      : students;
    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
  }, [students, query]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function pickStudent(studentId) {
    onChange(studentId);
    setOpen(false);
    setQuery("");
  }

  const displayValue = open
    ? query
    : selected
      ? `${selected.full_name}${selected.phone ? ` · ${formatUzPhone(selected.phone)}` : ""}`
      : "";

  return (
    <div className={`search-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`} ref={rootRef}>
      <input type="hidden" value={value || ""} required={required} readOnly tabIndex={-1} aria-hidden="true" />
      <div className="search-select-control">
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          disabled={disabled}
          placeholder={t("aBill.startTypingAName")}
          value={displayValue}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="search-select-clear"
            aria-label={t("aBill.clear")}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {open && !disabled ? (
        <ul className="search-select-list" role="listbox">
          {filtered.length ? (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  className={`search-select-option${String(item.id) === String(value) ? " is-active" : ""}`}
                  onClick={() => pickStudent(String(item.id))}
                >
                  <strong>{item.full_name}</strong>
                  <span className="muted">{formatUzPhone(item.phone) || "—"}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="search-select-empty muted">{t("aBill.nothingFound")}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default function BillingPage() {
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [periodPreset, setPeriodPreset] = useState("month");
  const [anchorDate, setAnchorDate] = useState(today());
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());
  const [trendView, setTrendView] = useState("7d");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [detailStudentId, setDetailStudentId] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [returnToPayment, setReturnToPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    student: "",
    invoice: "",
    amount: "",
    paid_at: `${today()}T12:00`,
    method: "cash",
    note: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    student: "",
    amount: "500000",
    due_at: `${today()}T18:00`,
    description: t("aBill.membership"),
  });
  // A drawer starts without the previous page error.
  useEffect(() => {
    if (paymentOpen || invoiceOpen) setError("");
  }, [paymentOpen, invoiceOpen]);

  const range = useMemo(
    () => computeRange(periodPreset, anchorDate, customFrom, customTo),
    [periodPreset, anchorDate, customFrom, customTo],
  );

  const studentMap = useMemo(
    () => Object.fromEntries(students.map((item) => [String(item.id), item])),
    [students],
  );
  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((item) => [String(item.id), item])),
    [groups],
  );
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((item) => [String(item.id), item])),
    [courses],
  );

  const studentGroupInfo = useMemo(() => {
    const map = {};
    enrollments
      .filter((item) => item.status === "active")
      .forEach((item) => {
        const sid = String(item.student);
        if (map[sid]) return;
        const group = groupMap[String(item.group)];
        const course = group ? courseMap[String(group.course)] : null;
        map[sid] = {
          groupId: item.group,
          groupName: group?.name || "—",
          courseId: group?.course || "",
          courseName: course?.name || "—",
        };
      });
    return map;
  }, [enrollments, groupMap, courseMap]);

  const invoicesByStudent = useMemo(() => {
    const map = {};
    invoices.forEach((invoice) => {
      const key = String(invoice.student);
      if (!map[key]) map[key] = [];
      map[key].push(invoice);
    });
    return map;
  }, [invoices]);

  const paymentsByInvoice = useMemo(() => {
    const map = {};
    payments
      .filter((item) => item.status === "succeeded")
      .forEach((payment) => {
        const key = String(payment.invoice);
        if (!map[key]) map[key] = [];
        map[key].push(payment);
      });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)),
    );
    return map;
  }, [payments]);

  const studentRows = useMemo(() => {
    const now = new Date();
    const ids = new Set([
      ...Object.keys(invoicesByStudent),
      ...students.map((item) => String(item.id)),
    ]);
    return [...ids]
      .map((studentId) => {
        const student = studentMap[studentId];
        if (!student) return null;
        const studentInvoices = invoicesByStudent[studentId] || [];
        if (!studentInvoices.length) return null;
        const charged = studentInvoices
          .filter((item) => !["void", "draft"].includes(item.status))
          .reduce((sum, item) => sum + asNumber(item.amount), 0);
        const paid = studentInvoices.reduce((sum, item) => sum + asNumber(item.paid_amount), 0);
        const debt = studentInvoices.reduce((sum, item) => sum + invoiceBalance(item), 0);
        const studentPayments = studentInvoices.flatMap(
          (invoice) => paymentsByInvoice[String(invoice.id)] || [],
        );
        studentPayments.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
        const lastPayment = studentPayments[0] || null;
        const status = deriveStudentStatus(studentInvoices, now);
        const studentInfo = studentGroupInfo[studentId] || {};
        return {
          id: studentId,
          student,
          groupId: studentInfo.groupId || "",
          groupName: studentInfo.groupName || "—",
          courseId: studentInfo.courseId || "",
          courseName: studentInfo.courseName || "—",
          charged,
          paid,
          debt,
          status,
          lastPayment,
          invoices: studentInvoices,
          currency: studentInvoices[0]?.currency || "UZS",
        };
      })
      .filter(Boolean);
  }, [invoicesByStudent, studentMap, students, paymentsByInvoice, studentGroupInfo]);

  const filteredRows = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return studentRows.filter((row) => {
      if (filterGroup && String(row.groupId) !== String(filterGroup)) return false;
      if (filterCourse && String(row.courseId) !== String(filterCourse)) return false;
      if (filterStatus === "paid" && row.status !== "paid") return false;
      if (filterStatus === "partially_paid" && row.status !== "partially_paid") return false;
      if (filterStatus === "debt" && row.status !== "debt") return false;
      if (filterStatus === "overdue" && row.status !== "overdue") return false;
      if (filterMethod) {
        const hasMethod = row.invoices.some((invoice) =>
          (paymentsByInvoice[String(invoice.id)] || []).some(
            (payment) => payment.method === filterMethod,
          ),
        );
        if (!hasMethod) return false;
      }
      if (q) {
        const phone = (row.student.phone || "").replace(/\D/g, "");
        const hay = `${row.student.full_name} ${row.student.phone || ""} ${phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studentRows, filterGroup, filterCourse, filterStatus, filterMethod, filterSearch, paymentsByInvoice]);

  const succeededPayments = useMemo(
    () => payments.filter((item) => item.status === "succeeded"),
    [payments],
  );

  const kpi = useMemo(() => {
    const periodPayments = succeededPayments.filter((item) =>
      inDateRange(item.paid_at, range.from, range.to),
    );
    const collected = periodPayments.reduce((sum, item) => sum + asNumber(item.amount), 0);
    const totalDebt = invoices
      .filter(isOpenInvoice)
      .reduce((sum, item) => sum + invoiceBalance(item), 0);
    const expected = invoices
      .filter(
        (item) =>
          isOpenInvoice(item) &&
          inDateRange(item.due_at, range.from, range.to),
      )
      .reduce((sum, item) => sum + invoiceBalance(item), 0);
    const todayStr = today();
    const paidToday = succeededPayments
      .filter((item) => paymentDayKey(item.paid_at) === todayStr)
      .reduce((sum, item) => sum + asNumber(item.amount), 0);
    const debtors = studentRows.filter((row) => row.debt > 0).length;
    // Whole sums: «818 214,29 сум» reads as noise on a KPI card.
    const avg = periodPayments.length ? Math.round(collected / periodPayments.length) : 0;
    return { collected, totalDebt, expected, paidToday, debtors, avg };
  }, [succeededPayments, invoices, range, studentRows]);

  const debtors = useMemo(() => {
    const now = new Date();
    return studentRows
      .filter((row) => row.debt > 0)
      .map((row) => {
        const overdueInvoices = row.invoices.filter((item) => isOverdueInvoice(item, now));
        const oldestDue = overdueInvoices
          .map((item) => new Date(item.due_at))
          .sort((a, b) => a - b)[0];
        const overdueDays = oldestDue
          ? Math.max(0, Math.floor((now - oldestDue) / (1000 * 60 * 60 * 24)))
          : 0;
        return { ...row, overdueDays };
      })
      .sort((a, b) => b.debt - a.debt || b.overdueDays - a.overdueDays)
      .slice(0, 5);
  }, [studentRows]);

  const recentPayments = useMemo(() => {
    return succeededPayments
      .slice()
      .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
      .slice(0, 8)
      .map((payment) => {
        const invoice = invoices.find((item) => String(item.id) === String(payment.invoice));
        const student = invoice ? studentMap[String(invoice.student)] : null;
        return { payment, student, invoice };
      })
      .filter((item) => item.student);
  }, [succeededPayments, invoices, studentMap]);

  const groupStats = useMemo(() => {
    return groups
      .map((group) => {
        const studentIds = new Set(
          enrollments
            .filter((item) => String(item.group) === String(group.id) && item.status === "active")
            .map((item) => String(item.student)),
        );
        const rows = studentRows.filter((row) => studentIds.has(String(row.id)));
        const expected = rows.reduce((sum, row) => sum + row.charged, 0);
        const paid = rows.reduce((sum, row) => sum + row.paid, 0);
        const debt = rows.reduce((sum, row) => sum + row.debt, 0);
        const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0;
        return {
          id: group.id,
          name: group.name,
          students: studentIds.size,
          expected,
          paid,
          debt,
          pct,
          currency: rows[0]?.currency || "UZS",
        };
      })
      .filter((item) => item.expected > 0 || item.debt > 0)
      .sort((a, b) => b.expected - a.expected);
  }, [groups, enrollments, studentRows]);

  const attentionItems = useMemo(() => {
    const todayStr = today();
    const items = [];
    // Debts and overdue invoices are already listed in «Должники»; here only what is due today.
    invoices
      .filter(
        (item) =>
          isOpenInvoice(item) &&
          isoDate(item.due_at) === todayStr,
      )
      .slice(0, 4)
      .forEach((invoice) => {
        const student = studentMap[String(invoice.student)];
        items.push({
          key: `due-${invoice.id}`,
          tone: "blue",
          title: student?.full_name || t("aBill.student"),
          text: t("aBill.paymentToday", { amount: money(invoiceBalance(invoice), invoice.currency) }),
          studentId: String(invoice.student),
        });
      });
    return items.slice(0, 8);
  }, [invoices, studentMap]);

  const trendPoints = useMemo(() => {
    const end = new Date(`${today()}T12:00:00`);
    if (trendView === "7d") {
      return Array.from({ length: 7 }, (_, index) => {
        const day = addDays(today(), -(6 - index));
        const amount = succeededPayments
          .filter((item) => paymentDayKey(item.paid_at) === day)
          .reduce((sum, item) => sum + asNumber(item.amount), 0);
        const date = new Date(`${day}T12:00:00`);
        return {
          key: day,
          label: formatDate(day),
          shortLabel: formatDateTime(date, { weekday: "short", day: "numeric" }),
          amount,
        };
      });
    }
    if (trendView === "30d") {
      return Array.from({ length: 30 }, (_, index) => {
        const day = addDays(today(), -(29 - index));
        const amount = succeededPayments
          .filter((item) => paymentDayKey(item.paid_at) === day)
          .reduce((sum, item) => sum + asNumber(item.amount), 0);
        return {
          key: day,
          label: formatDate(day),
          shortLabel: index % 5 === 0 || index === 29 ? formatDate(day).slice(0, 5) : "",
          amount,
        };
      });
    }
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(end.getFullYear(), end.getMonth() - (5 - index), 1);
      const from = isoDate(d);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const to = isoDate(last);
      const amount = succeededPayments
        .filter((item) => inDateRange(item.paid_at, from, to))
        .reduce((sum, item) => sum + asNumber(item.amount), 0);
      return {
        key: from,
        label: formatDateTime(d, { month: "long", year: "numeric" }),
        shortLabel: formatDateTime(d, { month: "short" }),
        amount,
      };
    });
  }, [succeededPayments, trendView]);

  const detailRow = useMemo(
    () => studentRows.find((row) => String(row.id) === String(detailStudentId)) || null,
    [studentRows, detailStudentId],
  );

  const openInvoicesForPayment = useMemo(() => {
    if (!paymentForm.student) return [];
    return (invoicesByStudent[String(paymentForm.student)] || []).filter(isOpenInvoice);
  }, [paymentForm.student, invoicesByStudent]);

  const canSubmitPayment =
    Boolean(paymentForm.student) &&
    openInvoicesForPayment.length > 0 &&
    Boolean(paymentForm.invoice);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [studentData, invoiceData, paymentData, groupData, courseData, enrollmentData] =
        await Promise.all([
          fetchAll("/students"),
          fetchAll("/invoices"),
          fetchAll("/payments"),
          fetchAll("/groups"),
          fetchAll("/courses"),
          fetchAll("/enrollments"),
        ]);
      setStudents(studentData);
      setInvoices(invoiceData);
      setPayments(paymentData);
      setGroups(groupData);
      setCourses(courseData);
      setEnrollments(enrollmentData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!info) return undefined;
    const timer = window.setTimeout(() => setInfo(""), 3200);
    return () => window.clearTimeout(timer);
  }, [info]);

  useEffect(() => {
    if (!paymentForm.invoice) return;
    const invoice = invoices.find((item) => String(item.id) === String(paymentForm.invoice));
    if (!invoice) return;
    setPaymentForm((prev) => ({
      ...prev,
      amount: prev.amount || String(Math.floor(invoiceBalance(invoice))),
    }));
  }, [paymentForm.invoice, invoices]);

  useEffect(() => {
    if (!paymentOpen || !paymentForm.student || paymentForm.invoice) return;
    if (openInvoicesForPayment.length === 1) {
      const invoice = openInvoicesForPayment[0];
      setPaymentForm((prev) => ({
        ...prev,
        invoice: String(invoice.id),
        amount: String(Math.floor(invoiceBalance(invoice))),
      }));
    }
  }, [paymentOpen, paymentForm.student, paymentForm.invoice, openInvoicesForPayment]);

  function openPaymentModal(studentId = "", invoiceId = "") {
    setPaymentForm({
      student: studentId || "",
      invoice: invoiceId || "",
      amount: "",
      paid_at: `${today()}T12:00`,
      method: "cash",
      note: "",
    });
    setPaymentOpen(true);
  }

  function openInvoiceModal(studentId = "", backToPayment = false) {
    setInvoiceForm({
      student: studentId || "",
      amount: "500000",
      due_at: `${today()}T18:00`,
      description: t("aBill.membership"),
    });
    setReturnToPayment(backToPayment);
    setInvoiceOpen(true);
  }

  async function submitInvoice(event) {
    event.preventDefault();
    setInvoiceSaving(true);
    setError("");
    try {
      const amount = priceToApi(invoiceForm.amount);
      if (!invoiceForm.student) throw new Error(t("aBill.chooseAStudent"));
      if (!amount || Number(amount) <= 0) throw new Error(t("aBill.enterAnAmountAbove"));
      const created = await api.post("/invoices", {
        student: invoiceForm.student,
        amount,
        due_at: new Date(invoiceForm.due_at).toISOString(),
        description: invoiceForm.description,
      });
      setInvoiceOpen(false);
      setInfo(t("aBill.invoiceIssued"));
      await load();
      if (returnToPayment) {
        setPaymentForm((prev) => ({
          ...prev,
          student: invoiceForm.student,
          invoice: String(created.id),
          amount: String(Math.floor(asNumber(amount))),
        }));
        setPaymentOpen(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInvoiceSaving(false);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    setPaymentSaving(true);
    setError("");
    try {
      const amount = priceToApi(paymentForm.amount);
      if (!amount || Number(amount) <= 0) {
        throw new Error(t("aBill.enterAnAmountAbove"));
      }
      if (!paymentForm.invoice) {
        throw new Error(t("aBill.chooseAnInvoice"));
      }
      await api.post("/payments", {
        invoice: paymentForm.invoice,
        amount,
        method: paymentForm.method,
        paid_at: new Date(paymentForm.paid_at).toISOString(),
        note: paymentForm.note,
        idempotency_key: newIdempotencyKey(),
      });
      setPaymentOpen(false);
      setInfo(t("aBill.paymentAdded"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentSaving(false);
    }
  }

  async function exportExcel() {
    const { downloadExcel, excelStamp } = await import("@/utils/exportExcel");
    downloadExcel(`billing_${excelStamp()}`, filteredRows, [
      { key: "name", title: t("aBill.student"), value: (row) => row.student.full_name },
      { key: "phone", title: t("aBill.phone"), value: (row) => row.student.phone || "" },
      { key: "group", title: t("aBill.group"), value: (row) => row.groupName },
      { key: "course", title: t("aBill.course"), value: (row) => row.courseName },
      { key: "charged", title: t("aBill.charged"), value: (row) => row.charged },
      { key: "paid", title: t("aBill.stPaid"), value: (row) => row.paid },
      { key: "debt", title: t("aBill.stDebt"), value: (row) => row.debt },
      {
        key: "status",
        title: t("aBill.status"),
        value: (row) => PAYMENT_STATUS_LABELS[row.status] || row.status,
      },
    ]);
  }

  const currency = filteredRows[0]?.currency || invoices[0]?.currency || "UZS";

  return (
    <div className="billing-page">
      <PageHeader
        title={t("aBill.billing")}
        subtitle={t("aBill.theCentresFinancesPayments")}
        actions={
          <div className="billing-topbar">
            <div className="billing-period-tabs">
              {[
                ["today", t("aBill.today")],
                ["week", t("aBill.week")],
                ["month", t("aBill.month")],
                ["custom", t("aBill.period")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`billing-period-tab${periodPreset === value ? " is-active" : ""}`}
                  onClick={() => setPeriodPreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {periodPreset === "custom" ? (
              <>
                <input
                  type="date"
                  className="billing-date-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className="muted">—</span>
                <input
                  type="date"
                  className="billing-date-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </>
            ) : (
              <input
                type="date"
                className="billing-date-input"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            )}
            <Button type="button" className="secondary" onClick={() => openInvoiceModal()}>
              {t("aBill.issueInvoice")}
            </Button>
            <Button type="button" onClick={() => openPaymentModal()}>
              {t("aBill.addPayment")}
            </Button>
            <Button type="button" className="secondary" onClick={exportExcel}>
              {t("aBill.exportToExcel")}
            </Button>
          </div>
        }
      />

      <Banner>{error}</Banner>
      {loading ? <p className="billing-loading-note muted">{t("aBill.loadingFinancialData")}</p> : null}

      <div className="billing-stats billing-owner-stats">
        {KPI_DEFS.map((item) => {
          const value =
            item.key === "collected"
              ? money(kpi.collected, currency)
              : item.key === "debt"
                ? money(kpi.totalDebt, currency)
                : item.key === "expected"
                  ? money(kpi.expected, currency)
                  : item.key === "today"
                    ? money(kpi.paidToday, currency)
                    : item.key === "debtors"
                      ? kpi.debtors
                      : money(kpi.avg, currency);
          return (
            <div key={item.key} className={`billing-kpi tone-${item.tone}`}>
              <div className="billing-kpi-icon">{item.icon}</div>
              <div className="billing-kpi-value">
                <strong>{value}</strong>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="billing-filters billing-dashboard-filters card compact">
        <Field label={t("aBill.period")}>
          <input
            readOnly
            value={`${formatDate(range.from)} — ${formatDate(range.to)}`}
          />
        </Field>
        <Field label={t("aBill.group")}>
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="">{t("aBill.all")}</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("aBill.course")}>
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="">{t("aBill.all")}</option>
            {courses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("aBill.paymentStatus")}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t("aBill.all")}</option>
            <option value="paid">{t("aBill.stPaid")}</option>
            <option value="partially_paid">{t("aBill.stPartial")}</option>
            <option value="debt">{t("aBill.stDebt")}</option>
            <option value="overdue">{t("aBill.stOverdue")}</option>
          </select>
        </Field>
        <Field label={t("aBill.paymentMethod")}>
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
            <option value="">{t("aBill.all")}</option>
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("aBill.search")}>
          <input
            placeholder={t("aBill.nameOrPhone")}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </Field>
      </div>

      <div className="billing-dashboard-grid has-aside">
        <div className="billing-main">
          <section className="card billing-table-card">
            <div className="billing-table-head">
              <h3>{t("aBill.financesByStudent")}</h3>
              <span className="muted billing-table-hint">{t("aBill.recordsCount", { count: filteredRows.length })}</span>
            </div>
            {!filteredRows.length ? (
              <EmptyState title={t("aBill.noDataForThe")} />
            ) : (
              <div className="billing-table-wrap">
                <table className="billing-table">
                  <thead>
                    <tr>
                      <th>{t("aBill.student")}</th>
                      <th>{t("aBill.groupCourse")}</th>
                      <th>{t("aBill.charged")}</th>
                      <th>{t("aBill.stPaid")}</th>
                      <th>{t("aBill.stDebt")}</th>
                      <th>{t("aBill.lastPayment")}</th>
                      <th>{t("aBill.method")}</th>
                      <th>{t("aBill.status")}</th>
                      <th>{t("aBill.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="billing-student-cell">
                            <Avatar name={row.student.full_name} />
                            <div>
                              <strong>{row.student.full_name}</strong>
                              <span className="muted">
                                {formatUzPhone(row.student.phone) || "—"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{row.groupName}</strong>
                          <span className="muted">{row.courseName}</span>
                        </td>
                        <td>{money(row.charged, row.currency)}</td>
                        <td>{money(row.paid, row.currency)}</td>
                        <td className={row.debt > 0 ? "billing-debt" : ""}>
                          {money(row.debt, row.currency)}
                        </td>
                        <td>
                          {row.lastPayment ? (
                            <>
                              <strong>{formatDate(row.lastPayment.paid_at)}</strong>
                              <span className="muted">{formatTime(row.lastPayment.paid_at)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{row.lastPayment ? methodLabel(row.lastPayment.method) : "—"}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          <RowActionsMenu
                            items={[
                              {
                                label: t("aBill.details"),
                                onClick: () => setDetailStudentId(row.id),
                              },
                              {
                                label: t("aBill.addPayment2"),
                                onClick: () => openPaymentModal(row.id),
                              },
                              {
                                label: t("aBill.issueInvoice2"),
                                onClick: () => openInvoiceModal(row.id),
                              },
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

          <section className="card billing-bottom-card">
            <div className="billing-aside-head">
              <h3>{t("aBill.financesByGroup")}</h3>
            </div>
            {!groupStats.length ? (
              <p className="muted">{t("aBill.noGroupData")}</p>
            ) : (
              <div className="billing-table-wrap">
                <table className="billing-table billing-group-table">
                  <thead>
                    <tr>
                      <th>{t("aBill.group")}</th>
                      <th>{t("aBill.students")}</th>
                      <th>{t("aBill.charged")}</th>
                      <th>{t("aBill.stPaid")}</th>
                      <th>{t("aBill.stDebt")}</th>
                      <th>{t("aBill.collected")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStats.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.students}</td>
                        <td>{money(row.expected, row.currency)}</td>
                        <td>{money(row.paid, row.currency)}</td>
                        <td className={row.debt > 0 ? "billing-debt" : ""}>
                          {money(row.debt, row.currency)}
                        </td>
                        <td>{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card billing-bottom-card">
            <div className="billing-aside-head">
              <h3>{t("aBill.income")}</h3>
              <div className="billing-trend-tabs">
                {[
                  ["7d", t("aBill.n7Days")],
                  ["30d", t("aBill.n30Days")],
                  ["months", t("aBill.months")],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`billing-trend-tab${trendView === value ? " is-active" : ""}`}
                    onClick={() => setTrendView(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <RevenueTrendChart points={trendPoints} currency={currency} view={trendView} />
          </section>
        </div>

        <aside className="billing-aside">
          <section className="card billing-aside-card">
            <div className="billing-aside-head">
              <h3>{t("aBill.debtors")}</h3>
              <span className="muted">{debtors.length}</span>
            </div>
            {!debtors.length ? (
              <p className="muted">{t("aBill.noDebtors")}</p>
            ) : (
              <ul className="billing-attention-list">
                {debtors.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => setDetailStudentId(row.id)}>
                      <span className="billing-attention-icon tone-red">!</span>
                      <span className="billing-attention-copy">
                        <strong>{row.student.full_name}</strong>
                        <span className="muted">
                          {row.groupName} · {money(row.debt, row.currency)}
                          {row.overdueDays ? t("aBill.overdueDays", { days: row.overdueDays }) : ""}
                        </span>
                      </span>
                      <StatusBadge status={row.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card billing-aside-card">
            <div className="billing-aside-head">
              <h3>{t("aBill.recentPayments")}</h3>
            </div>
            {!recentPayments.length ? (
              <p className="muted">{t("aBill.noPaymentsYet")}</p>
            ) : (
              <ul className="billing-recent-list">
                {recentPayments.map(({ payment, student }) => {
                  const day = paymentDayKey(payment.paid_at);
                  const when =
                    day === today()
                      ? t("aBill.today2", { time: formatTime(payment.paid_at) })
                      : formatWhen(payment.paid_at);
                  return (
                    <li key={payment.id}>
                      <strong>{student.full_name}</strong>
                      <span>{money(payment.amount, currency)}</span>
                      <span className="muted">{when}</span>
                      <span className="billing-method-tag">{methodLabel(payment.method)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card billing-aside-card">
            <div className="billing-aside-head">
              <h3>{t("aBill.needsAttention")}</h3>
            </div>
            {!attentionItems.length ? (
              <p className="muted">{t("aBill.allGood")}</p>
            ) : (
              <ul className="billing-attention-list">
                {attentionItems.map((item) => (
                  <li key={item.key}>
                    <button type="button" onClick={() => setDetailStudentId(item.studentId)}>
                      <span className={`billing-attention-icon tone-${item.tone}`}>!</span>
                      <span className="billing-attention-copy">
                        <strong>{item.title}</strong>
                        <span className="muted">{item.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {info ? <div className="billing-toast">{info}</div> : null}

      {detailRow ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aBill.billingDetails")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aBill.close")}
            onClick={() => setDetailStudentId("")}
          />
          <div className="sheet sheet-wide">
            <div className="sheet-head">
              <div>
                <h2>{detailRow.student.full_name}</h2>
                <p className="muted">
                  {formatUzPhone(detailRow.student.phone) || "—"} · {detailRow.groupName} ·{" "}
                  {detailRow.courseName}
                </p>
              </div>
              <div className="sheet-head-actions">
                <Button type="button" onClick={() => openPaymentModal(detailRow.id)}>
                  {t("aBill.addPayment")}
                </Button>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label={t("aBill.close")}
                  onClick={() => setDetailStudentId("")}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="sheet-body">
              <div className="billing-detail-summary">
                <div>
                  <span className="muted">{t("aBill.charged")}</span>
                  <strong>{money(detailRow.charged, detailRow.currency)}</strong>
                </div>
                <div>
                  <span className="muted">{t("aBill.stPaid")}</span>
                  <strong>{money(detailRow.paid, detailRow.currency)}</strong>
                </div>
                <div>
                  <span className="muted">{t("aBill.stDebt")}</span>
                  <strong className={detailRow.debt > 0 ? "billing-debt" : ""}>
                    {money(detailRow.debt, detailRow.currency)}
                  </strong>
                </div>
                <div>
                  <span className="muted">{t("aBill.nextPayment")}</span>
                  <strong>
                    {(() => {
                      const next = detailRow.invoices
                        .filter(isOpenInvoice)
                        .map((item) => new Date(item.due_at))
                        .sort((a, b) => a - b)[0];
                      return next ? formatDate(next) : "—";
                    })()}
                  </strong>
                </div>
              </div>

              <h3>{t("aBill.paymentHistory")}</h3>
              {detailRow.invoices.flatMap((invoice) =>
                (paymentsByInvoice[String(invoice.id)] || []).map((payment) => ({
                  payment,
                  invoice,
                })),
              ).length ? (
                <div className="billing-table-wrap">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>{t("aBill.date")}</th>
                        <th>{t("aBill.amount")}</th>
                        <th>{t("aBill.method")}</th>
                        <th>{t("aBill.invoice")}</th>
                        <th>{t("aBill.comment")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRow.invoices
                        .flatMap((invoice) =>
                          (paymentsByInvoice[String(invoice.id)] || []).map((payment) => ({
                            payment,
                            invoice,
                          })),
                        )
                        .sort((a, b) => new Date(b.payment.paid_at) - new Date(a.payment.paid_at))
                        .map(({ payment, invoice }) => (
                          <tr key={payment.id}>
                            <td>{formatWhen(payment.paid_at)}</td>
                            <td>{money(payment.amount, invoice.currency)}</td>
                            <td>{methodLabel(payment.method)}</td>
                            <td>{invoice.number}</td>
                            <td>{payment.note || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">{t("aBill.noPaymentsYet")}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {paymentOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aBill.addPayment2")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aBill.close")}
            onClick={() => !paymentSaving && setPaymentOpen(false)}
          />
          <div className="sheet billing-payment-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("aBill.addPayment2")}</h2>
                <p className="muted">{t("aBill.recordIncomeAgainstA")}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("aBill.close")}
                onClick={() => !paymentSaving && setPaymentOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="billing-payment-form-wrap" onSubmit={submitPayment}>
              <div className="sheet-body billing-payment-form">
                {/* Validation and save errors must be visible inside the drawer, not behind it. */}
                {error ? <p className="field-message error billing-payment-span-2">{error}</p> : null}
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.student")}>
                    <StudentSearchSelect
                      required
                      students={students}
                      value={paymentForm.student}
                      onChange={(studentId) =>
                        setPaymentForm({
                          ...paymentForm,
                          student: studentId,
                          invoice: "",
                          amount: "",
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.invoice")}>
                    {!paymentForm.student ? (
                      <input readOnly disabled placeholder={t("aBill.chooseAStudentFirst")} />
                    ) : openInvoicesForPayment.length ? (
                      <select
                        required
                        value={paymentForm.invoice}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, invoice: e.target.value, amount: "" })
                        }
                      >
                        <option value="">{t("aBill.chooseAnInvoice2")}</option>
                        {openInvoicesForPayment.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.number} · {money(invoiceBalance(item), item.currency)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="billing-payment-empty">
                        <p>{t("aBill.theStudentHasNo")}</p>
                        <Button
                          type="button"
                          onClick={() => openInvoiceModal(paymentForm.student, true)}
                        >
                          {t("aBill.issueInvoice")}
                        </Button>
                      </div>
                    )}
                  </Field>
                </div>
                <Field label={t("aBill.amount")}>
                  <MoneyInput
                    required={canSubmitPayment}
                    disabled={!canSubmitPayment}
                    value={paymentForm.amount}
                    onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })}
                  />
                </Field>
                <Field label={t("aBill.paymentDate")}>
                  <input
                    type="datetime-local"
                    required={canSubmitPayment}
                    disabled={!canSubmitPayment}
                    value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  />
                </Field>
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.paymentMethod")}>
                    <select
                      disabled={!canSubmitPayment}
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    >
                      {PAYMENT_METHODS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.comment")}>
                    <textarea
                      rows={3}
                      disabled={!canSubmitPayment}
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <div className="sheet-foot billing-payment-foot">
                <Button type="submit" disabled={paymentSaving || !canSubmitPayment}>
                  {paymentSaving ? t("aBill.saving") : t("aBill.savePayment")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {invoiceOpen ? (
        <div
          className={`overlay${returnToPayment ? " overlay-nested" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={t("aBill.issueInvoice2")}
        >
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aBill.close")}
            onClick={() => !invoiceSaving && setInvoiceOpen(false)}
          />
          <div className="sheet billing-payment-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("aBill.issueInvoice2")}</h2>
                <p className="muted">{t("aBill.newChargeForA")}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("aBill.close")}
                onClick={() => !invoiceSaving && setInvoiceOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="billing-payment-form-wrap" onSubmit={submitInvoice}>
              <div className="sheet-body billing-payment-form">
                {/* Validation and save errors must be visible inside the drawer, not behind it. */}
                {error ? <p className="field-message error billing-payment-span-2">{error}</p> : null}
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.student")}>
                    <StudentSearchSelect
                      required
                      students={students}
                      value={invoiceForm.student}
                      onChange={(studentId) =>
                        setInvoiceForm({ ...invoiceForm, student: studentId })
                      }
                    />
                  </Field>
                </div>
                <Field label={t("aBill.amount")}>
                  <MoneyInput
                    required
                    value={invoiceForm.amount}
                    onChange={(value) => setInvoiceForm({ ...invoiceForm, amount: value })}
                  />
                </Field>
                <Field label={t("aBill.dueDate")}>
                  <input
                    type="datetime-local"
                    required
                    value={invoiceForm.due_at}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_at: e.target.value })}
                  />
                </Field>
                <div className="billing-payment-span-2">
                  <Field label={t("aBill.description")}>
                    <input
                      value={invoiceForm.description}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, description: e.target.value })
                      }
                      placeholder={t("aBill.membershipLessonPack")}
                    />
                  </Field>
                </div>
              </div>
              <div className="sheet-foot billing-payment-foot">
                <Button type="submit" disabled={invoiceSaving}>
                  {invoiceSaving ? t("aBill.saving") : t("aBill.issueInvoice2")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
