import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banner, Button, Field, PageHeader } from "@/components/ui";
import { api, getSession } from "@/services/api/client";
import { lessonsWindowPath, getList, attendanceForLessons } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import { hasCapability } from "@/utils/roleAccess";
import { formatTime, formatWhen, money, today, localIsoDate } from "@/utils/format";
import { t, translated } from "@/i18n";

import NotificationsSendSheet from "./NotificationsSendSheet";

const TYPE_OPTIONS = [
  { value: "", label: "t:aNtf.typeAll" },
  { value: "announcement", label: "t:aNtf.typeAnnouncement" },
  { value: "payment", label: "t:aNtf.typePayment" },
  { value: "attendance", label: "t:aNtf.typeAttendance" },
  { value: "crm", label: "CRM" },
  { value: "schedule", label: "t:aNtf.typeSchedule" },
  { value: "students", label: "t:aNtf.typeStudents" },
  { value: "staff", label: "t:aNtf.typeStaff" },
  { value: "system", label: "t:aNtf.typeSystem" },
].map(translated);

/* Nested entries: each one is wrapped so its label follows the language. */
const TYPE_META = Object.fromEntries(Object.entries({
  announcement: { label: "t:aNtf.typeAnnouncement", icon: "✉", tone: "blue" },
  payment: { label: "t:aNtf.typePayment", icon: "t:aNtf.currencyIcon", tone: "green" },
  attendance: { label: "t:aNtf.typeAttendance", icon: "✓", tone: "blue" },
  crm: { label: "CRM", icon: "◎", tone: "purple" },
  schedule: { label: "t:aNtf.typeSchedule", icon: "◷", tone: "blue" },
  students: { label: "t:aNtf.typeStudents", icon: "S", tone: "green" },
  staff: { label: "t:aNtf.typeStaff", icon: "T", tone: "purple" },
  system: { label: "t:aNtf.typeSystem", icon: "!", tone: "orange" },
}).map(([key, meta]) => [key, translated(meta)]));

const PRIORITY_LABELS = translated({
  normal: "t:aNtf.prNormal",
  important: "t:aNtf.prImportant",
  critical: "t:aNtf.prCritical",
});

function isoDate(value) {
  return localIsoDate(value);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function daysAgo(n) {
  return addDays(today(), -n);
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

function expectedStudents(groupId, enrollments) {
  return enrollments.filter(
    (item) => String(item.group) === String(groupId) && item.status === "active",
  ).length;
}

function lessonAttendanceStats(records, expected) {
  const marked = records.length;
  if (expected <= 0) return "marked";
  if (marked >= expected) return "marked";
  if (marked > 0) return "partial";
  return "unmarked";
}

function readStorageKey() {
  const tenantId = getSession().tenantId || "default";
  return `yagona-notifications-read:${tenantId}`;
}

function loadReadIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(readStorageKey()) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadIds(set) {
  localStorage.setItem(readStorageKey(), JSON.stringify([...set]));
}

/** Whole list (shared pagination helper; large pages keep it to few requests). */
function fetchAll(path) {
  return getList(path.includes("page_size=") ? path : `${path}${path.includes("?") ? "&" : "?"}page_size=500`);
}

async function loadAttendanceForLessons(lessons) {
  const byLesson = await attendanceForLessons(lessons.map((lesson) => lesson.id)).catch(() => ({}));
  return new Map(lessons.map((lesson) => [String(lesson.id), byLesson[String(lesson.id)] || []]));
}

function timeGroupLabel(value) {
  const day = isoDate(value);
  const nowDay = today();
  if (day === nowDay) return t("aNtf.today");
  if (day === addDays(nowDay, -1)) return t("aNtf.yesterday");
  const weekStart = addDays(nowDay, -6);
  if (day >= weekStart) return t("aNtf.thisWeek");
  return t("aNtf.earlier");
}

function buildNotifications({
  base,
  invoices,
  payments,
  students,
  leads,
  leadStages,
  lessons,
  groups,
  enrollments,
  outbox,
  staff,
  salaryRecords,
  attendanceCache,
}) {
  const now = new Date();
  const studentMap = Object.fromEntries(students.map((item) => [String(item.id), item]));
  const groupMap = Object.fromEntries(groups.map((item) => [String(item.id), item]));
  const stageMap = Object.fromEntries(leadStages.map((item) => [String(item.id), item]));
  const firstStageId = [...leadStages].sort((a, b) => a.position - b.position)[0]?.id;
  const staffMap = Object.fromEntries(staff.map((item) => [String(item.id), item]));
  const items = [];

  invoices
    .filter((invoice) => isOverdueInvoice(invoice, now))
    .forEach((invoice) => {
      const student = studentMap[String(invoice.student)];
      const balance = invoiceBalance(invoice);
      items.push({
        id: `payment-overdue-${invoice.id}`,
        type: "payment",
        priority: "critical",
        attention: true,
        title: t("aNtf.studentHasADebt"),
        description: t("aNtf.studentDebt", { name: student?.full_name || t("aNtf.student"), amount: money(balance, invoice.currency) }),
        occurredAt: invoice.due_at || invoice.updated_at || invoice.created_at,
        actionLabel: t("aNtf.openBilling"),
        actionTo: `${base}/billing`,
      });
    });

  invoices
    .filter((item) => isOpenInvoice(item) && isoDate(item.due_at) === today())
    .forEach((invoice) => {
      const student = studentMap[String(invoice.student)];
      items.push({
        id: `payment-due-today-${invoice.id}`,
        type: "payment",
        priority: "important",
        attention: true,
        title: t("aNtf.paymentDueToday"),
        description: `${student?.full_name || t("aNtf.student")} — ${money(invoiceBalance(invoice), invoice.currency)}`,
        occurredAt: invoice.due_at || invoice.created_at,
        actionLabel: t("aNtf.openBilling"),
        actionTo: `${base}/billing`,
      });
    });

  payments
    .filter((item) => item.status === "failed" && isoDate(item.paid_at) >= daysAgo(30))
    .forEach((payment) => {
      items.push({
        id: `payment-failed-${payment.id}`,
        type: "payment",
        priority: "critical",
        attention: true,
        title: t("aNtf.failedPayment"),
        description: `${money(payment.amount, payment.currency || "UZS")} · ${formatWhen(payment.paid_at)}`,
        occurredAt: payment.paid_at || payment.created_at,
        actionLabel: t("aNtf.openBilling"),
        actionTo: `${base}/billing`,
      });
    });

  const pastLessons = lessons.filter((lesson) => new Date(lesson.ends_at) < now);
  pastLessons.forEach((lesson) => {
    if (isoDate(lesson.starts_at) < daysAgo(14)) return;
    const expected = expectedStudents(lesson.group, enrollments);
    const records = attendanceCache.get(String(lesson.id)) || [];
    const markStatus = lessonAttendanceStats(records, expected);
    if (markStatus === "marked") return;
    const group = groupMap[String(lesson.group)];
    const time = `${formatTime(lesson.starts_at)}–${formatTime(lesson.ends_at)}`;
    items.push({
      id: `attendance-${lesson.id}`,
      type: "attendance",
      priority: markStatus === "unmarked" ? "important" : "normal",
      attention: markStatus === "unmarked",
      title: t("aNtf.attendanceNotMarked"),
      description: t("aNtf.groupLesson", { name: group?.name || t("aNtf.group"), time }),
      occurredAt: lesson.ends_at || lesson.starts_at,
      actionLabel: t("aNtf.openAttendance"),
      actionTo: `${base}/attendance`,
    });
  });

  leads
    .filter((lead) => !lead.converted_student && isoDate(lead.created_at) >= daysAgo(14))
    .forEach((lead) => {
      const stage = stageMap[String(lead.stage)];
      if (stage?.is_won || stage?.is_lost) return;
      const isNew = firstStageId && String(lead.stage) === String(firstStageId);
      items.push({
        id: `crm-lead-${lead.id}`,
        type: "crm",
        priority: isNew ? "important" : "normal",
        attention: isNew,
        title: isNew ? t("aNtf.newRequestInCrm") : t("aNtf.activeLeadInCrm"),
        description: `${lead.full_name}${lead.phone ? ` · ${lead.phone}` : ""}`,
        occurredAt: lead.created_at,
        actionLabel: t("aNtf.openCrm"),
        actionTo: `${base}/crm`,
      });
    });

  lessons.forEach((lesson) => {
    if (lesson.status === "cancelled" && isoDate(lesson.updated_at || lesson.created_at) >= daysAgo(14)) {
      const group = groupMap[String(lesson.group)];
      items.push({
        id: `schedule-cancel-${lesson.id}`,
        type: "schedule",
        priority: "important",
        attention: true,
        title: t("aNtf.lessonCancelled"),
        description: `${group?.name || t("aNtf.group")} · ${formatWhen(lesson.starts_at)}`,
        occurredAt: lesson.updated_at || lesson.created_at,
        actionLabel: t("aNtf.openSchedule"),
        actionTo: `${base}/schedule`,
      });
      return;
    }
    const created = new Date(lesson.created_at).getTime();
    const updated = new Date(lesson.updated_at || lesson.created_at).getTime();
    if (
      updated - created > 60_000 &&
      isoDate(lesson.updated_at) >= daysAgo(7) &&
      lesson.status !== "cancelled"
    ) {
      const group = groupMap[String(lesson.group)];
      items.push({
        id: `schedule-update-${lesson.id}-${lesson.updated_at}`,
        type: "schedule",
        priority: "normal",
        attention: false,
        title: t("aNtf.scheduleChange"),
        description: `${group?.name || t("aNtf.group")} · ${formatWhen(lesson.starts_at)}`,
        occurredAt: lesson.updated_at,
        actionLabel: t("aNtf.openSchedule"),
        actionTo: `${base}/schedule`,
      });
    }
  });

  students
    .filter((item) => isoDate(item.created_at) >= daysAgo(14))
    .forEach((student) => {
      items.push({
        id: `student-new-${student.id}`,
        type: "students",
        priority: "normal",
        attention: false,
        title: t("aNtf.newStudent"),
        description: student.full_name || t("aNtf.noName"),
        occurredAt: student.created_at,
        actionLabel: t("aNtf.openStudents"),
        actionTo: `${base}/students`,
      });
    });

  salaryRecords
    .filter((record) => record.status === "unpaid" && asNumber(record.accrued_amount) > 0)
    .forEach((record) => {
      const member = staffMap[String(record.membership)];
      const user = member?.user || {};
      const name =
        user.name ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.email ||
        t("aNtf.staffMember");
      items.push({
        id: `staff-salary-${record.id}`,
        type: "staff",
        priority: "important",
        attention: true,
        title: t("aNtf.salaryNotPaid"),
        description: `${name} — ${money(record.accrued_amount, "UZS")}`,
        occurredAt: record.period || record.created_at,
        actionLabel: t("aNtf.openFinance"),
        actionTo: `${base}/finance`,
      });
    });

  staff
    .filter((item) => !item.is_active && isoDate(item.updated_at || item.created_at) >= daysAgo(30))
    .forEach((member) => {
      const user = member.user || {};
      const name =
        user.name ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.email ||
        t("aNtf.staffMember");
      items.push({
        id: `staff-inactive-${member.id}`,
        type: "staff",
        priority: "normal",
        attention: false,
        title: t("aNtf.staffMemberDeactivated"),
        description: name,
        occurredAt: member.updated_at || member.created_at,
        actionLabel: t("aNtf.openTeam"),
        actionTo: `${base}/staff`,
      });
    });

  outbox
    .filter((item) => item.status === "failed")
    .forEach((item) => {
      items.push({
        id: `system-outbox-${item.id}`,
        type: "system",
        priority: "critical",
        attention: true,
        title: t("aNtf.notificationSendingError"),
        description: item.last_error || item.rendered_body?.slice(0, 120) || t("aNtf.deliveryFailure"),
        occurredAt: item.updated_at || item.created_at,
        actionLabel: t("aNtf.settings"),
        actionTo: `${base}/notifications`,
      });
    });

  outbox
    .filter((item) => item.status === "sent" && isoDate(item.sent_at || item.created_at) >= daysAgo(7))
    .slice(0, 20)
    .forEach((item) => {
      items.push({
        id: `system-sent-${item.id}`,
        type: "system",
        priority: "normal",
        attention: false,
        title: t("aNtf.messageSent"),
        description: item.rendered_body?.slice(0, 120) || "Telegram / SMS",
        occurredAt: item.sent_at || item.created_at,
        actionLabel: null,
        actionTo: null,
      });
    });

  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

const RECIPIENT_TYPE_LABELS = translated({
  student: "t:aNtf.rcpStudent",
  students: "t:aNtf.rcpStudents",
  group: "t:aNtf.group",
  course: "t:aNtf.rcpCourse",
  all_students: "t:aNtf.rcpAll",
});

export default function NotificationsPage() {
  const slug = getSession().tenantSlug;
  const session = getSession();
  const tenantName =
    session.memberships?.find((item) => item.tenant_slug === slug)?.tenant_name || slug || "";
  const base = slug ? `/education/${slug}` : "..";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [sentItems, setSentItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [readIds, setReadIds] = useState(() => loadReadIds());
  const [pageTab, setPageTab] = useState("incoming");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedSent, setSelectedSent] = useState(null);

  const canSeePayroll = hasCapability(currentMembership(getSession())?.role || "", "payroll.view");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const period = `${today().slice(0, 8)}01`;
      const [
        invoices,
        payments,
        studentsData,
        leads,
        leadStages,
        lessons,
        groupsData,
        coursesData,
        enrollmentsData,
        outbox,
        staff,
        salaryRecords,
        sentData,
      ] = await Promise.all([
        fetchAll("/invoices"),
        fetchAll("/payments"),
        fetchAll("/students"),
        fetchAll("/leads"),
        fetchAll("/lead-stages"),
        // Events cover the last 14 days and changes to coming lessons, not the whole history.
        fetchAll(lessonsWindowPath(14, 60)),
        fetchAll("/groups"),
        fetchAll("/courses"),
        fetchAll("/enrollments"),
        fetchAll("/notification-outbox").catch(() => []),
        fetchAll("/staff"),
        // Payroll is visible to owner and accountant only; others would just get a 403.
        canSeePayroll ? fetchAll(`/salary-records?period=${period}`).catch(() => []) : Promise.resolve([]),
        fetchAll("/notifications/sent").catch(() => []),
      ]);

      setStudents(studentsData);
      setGroups(groupsData);
      setCourses(coursesData);
      setEnrollments(enrollmentsData);
      setSentItems(sentData);

      const now = new Date();
      const attendanceLessons = lessons
        .filter((lesson) => new Date(lesson.ends_at) < now && isoDate(lesson.starts_at) >= daysAgo(14))
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
        .slice(0, 30);

      const attendanceCache = await loadAttendanceForLessons(attendanceLessons);

      setNotifications(
        buildNotifications({
          base,
          invoices,
          payments,
          students: studentsData,
          leads,
          leadStages,
          lessons,
          groups: groupsData,
          enrollments: enrollmentsData,
          outbox,
          staff,
          salaryRecords,
          attendanceCache,
        }),
      );
    } catch (err) {
      setError(err.message || t("aNtf.couldNotLoadNotifications"));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const enriched = useMemo(
    () =>
      notifications.map((item) => ({
        ...item,
        read: readIds.has(item.id),
      })),
    [notifications, readIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekStart = daysAgo(6);
    let source = enriched;
    if (pageTab === "attention") {
      source = enriched.filter((item) => item.attention);
    }
    return source.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (statusFilter === "unread" && item.read) return false;
      if (statusFilter === "read" && !item.read) return false;
      if (priorityFilter && item.priority !== priorityFilter) return false;
      const day = isoDate(item.occurredAt);
      if (periodFilter === "today" && day !== today()) return false;
      if (periodFilter === "week" && day < weekStart) return false;
      if (periodFilter === "month" && day < daysAgo(29)) return false;
      if (q && !`${item.title} ${item.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, pageTab, typeFilter, statusFilter, priorityFilter, periodFilter, search]);

  const filteredSent = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekStart = daysAgo(6);
    return sentItems.filter((item) => {
      const day = isoDate(item.created_at);
      if (periodFilter === "today" && day !== today()) return false;
      if (periodFilter === "week" && day < weekStart) return false;
      if (periodFilter === "month" && day < daysAgo(29)) return false;
      if (typeFilter && item.category !== typeFilter) return false;
      if (priorityFilter && item.priority !== priorityFilter) return false;
      if (q && !`${item.title} ${item.message}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sentItems, search, periodFilter, typeFilter, priorityFilter]);

  const stats = useMemo(() => {
    const unread = enriched.filter((item) => !item.read).length;
    const attention = enriched.filter((item) => item.attention && !item.read).length;
    const todayCount = enriched.filter((item) => isoDate(item.occurredAt) === today()).length;
    const sentWeekCount = sentItems.filter((item) => isoDate(item.created_at) >= daysAgo(6)).length;
    return { unread, attention, todayCount, sentWeekCount };
  }, [enriched, sentItems]);

  const attentionItems = useMemo(
    () => enriched.filter((item) => item.attention).slice(0, 8),
    [enriched],
  );

  const grouped = useMemo(() => {
    const order = [t("aNtf.today"), t("aNtf.yesterday"), t("aNtf.thisWeek"), t("aNtf.earlier")];
    const map = new Map(order.map((label) => [label, []]));
    filtered.forEach((item) => {
      const label = timeGroupLabel(item.occurredAt);
      map.get(label).push(item);
    });
    return order
      .map((label) => ({ label, items: map.get(label) }))
      .filter((group) => group.items.length);
  }, [filtered]);

  function markRead(id) {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  }

  function markAllRead() {
    const next = new Set(enriched.map((item) => item.id));
    setReadIds(next);
    saveReadIds(next);
  }

  async function openSentDetail(item) {
    setSelectedSent({ ...item, loading: true });
    try {
      const detail = await api.get(`/notifications/sent/${item.id}`);
      setSelectedSent(detail);
    } catch (err) {
      setSelectedSent({ ...item, detailError: err.message || t("aNtf.couldNotLoadThe") });
    }
  }

  function handleSent(count) {
    setInfo(t("aNtf.sentToStudents", { count }));
    load();
    setPageTab("sent");
    window.setTimeout(() => setInfo(""), 4000);
  }

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((item) => [String(item.id), item])),
    [groups],
  );
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((item) => [String(item.id), item])),
    [courses],
  );

  function sentRecipientLabel(item) {
    if (item.recipient_type === "group" && item.group) {
      return groupMap[String(item.group)]?.name || t("aNtf.group");
    }
    if (item.recipient_type === "course" && item.course) {
      return courseMap[String(item.course)]?.name || t("aNtf.rcpCourse");
    }
    return RECIPIENT_TYPE_LABELS[item.recipient_type] || item.recipient_type;
  }

  return (
    <div className="notifications-page">
      <PageHeader
        title={t("aNtf.notifications")}
        subtitle={t("aNtf.importantEventsAndMessages")}
        actions={
          <div className="notifications-topbar">
            <button type="button" className="btn btn-primary" onClick={() => setSendOpen(true)}>
              {t("aNtf.sendNotification")}
            </button>
            {pageTab !== "sent" ? (
              <button type="button" className="btn btn-secondary" onClick={markAllRead}>
                {t("aNtf.markAllAsRead")}
              </button>
            ) : null}
          </div>
        }
      />

      <Banner>{error}</Banner>
      {info ? <p className="notifications-info">{info}</p> : null}
      {loading ? <p className="notifications-loading muted">{t("aNtf.loading")}</p> : null}

      <div className="notifications-stats">
        <div className="notifications-stat tone-blue">
          <strong>{stats.unread}</strong>
          <span>{t("aNtf.new")}</span>
        </div>
        <div className="notifications-stat tone-orange">
          <strong>{stats.attention}</strong>
          <span>{t("aNtf.needAttention")}</span>
        </div>
        <div className="notifications-stat tone-green">
          <strong>{stats.todayCount}</strong>
          <span>{t("aNtf.today")}</span>
        </div>
        <div className="notifications-stat tone-purple">
          <strong>{stats.sentWeekCount}</strong>
          <span>{t("aNtf.sentThisWeek")}</span>
        </div>
      </div>

      <div className="notifications-page-tabs">
        {[
          ["incoming", t("aNtf.inbox")],
          ["attention", t("aNtf.needsAttention")],
          ["sent", t("aNtf.sent")],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`notifications-page-tab${pageTab === value ? " is-active" : ""}`}
            onClick={() => setPageTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="notifications-filters">
        <Field label={t("aNtf.type")}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        {pageTab !== "sent" ? (
          <Field label={t("aNtf.status")}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("aNtf.all")}</option>
              <option value="unread">{t("aNtf.unread")}</option>
              <option value="read">{t("aNtf.read")}</option>
            </select>
          </Field>
        ) : null}
        <Field label={t("aNtf.priority")}>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">{t("aNtf.all")}</option>
            <option value="normal">{t("aNtf.normal")}</option>
            <option value="important">{t("aNtf.important")}</option>
            <option value="critical">{t("aNtf.critical")}</option>
          </select>
        </Field>
        <Field label={t("aNtf.period")}>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option value="">{t("aNtf.allTime")}</option>
            <option value="today">{t("aNtf.today")}</option>
            <option value="week">{t("aNtf.pastWeek")}</option>
            <option value="month">{t("aNtf.pastMonth")}</option>
          </select>
        </Field>
        <Field label={t("aNtf.search")}>
          <input
            placeholder={t("aNtf.titleOrDescription")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>

      {pageTab === "sent" ? (
        <div className="notifications-sent-list">
          {!loading && !filteredSent.length ? (
            <div className="card notifications-empty">
              <strong>{t("aNtf.noSentNotifications")}</strong>
              <p className="muted">{t("aNtf.sendTheFirstMessage")}</p>
            </div>
          ) : null}
          {filteredSent.map((item) => {
            const meta = TYPE_META[item.category] || TYPE_META.system;
            return (
              <button
                key={item.id}
                type="button"
                className="notifications-sent-item"
                onClick={() => openSentDetail(item)}
              >
                <div className={`notifications-icon tone-${meta.tone}`}>{meta.icon}</div>
                <div className="notifications-copy">
                  <div className="notifications-copy-head">
                    <strong>{item.title}</strong>
                    <span className={`notifications-priority priority-${item.priority}`}>
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                  </div>
                  <p>{item.message?.slice(0, 120)}</p>
                  <div className="notifications-meta">
                    <span className="notifications-type">{sentRecipientLabel(item)}</span>
                    <span>{t("aNtf.recipients", { recipients_count: item.recipients_count })}</span>
                    {item.read_count != null ? <span>{t("aNtf.read2", { read_count: item.read_count })}</span> : null}
                    {item.unread_count != null ? <span>{t("aNtf.unread2", { unread_count: item.unread_count })}</span> : null}
                    <span>{formatWhen(item.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="notifications-layout">
        <div className="notifications-main">
          {!loading && !filtered.length ? (
            <div className="card notifications-empty">
              <strong>{t("aNtf.noNotifications")}</strong>
              <p className="muted">{t("aNtf.noEventsMatchThe")}</p>
            </div>
          ) : null}

          {grouped.map((group) => (
            <section key={group.label} className="notifications-group">
              <h3>{group.label}</h3>
              <div className="notifications-list">
                {group.items.map((item) => {
                  const meta = TYPE_META[item.type] || TYPE_META.system;
                  return (
                    <article
                      key={item.id}
                      className={`notifications-item${item.read ? " is-read" : " is-unread"} priority-${item.priority}`}
                    >
                      {!item.read ? <span className="notifications-unread-dot" aria-hidden="true" /> : null}
                      <div className={`notifications-icon tone-${meta.tone}`}>{meta.icon}</div>
                      <div className="notifications-copy">
                        <div className="notifications-copy-head">
                          <strong>{item.title}</strong>
                          <span className={`notifications-priority priority-${item.priority}`}>
                            {PRIORITY_LABELS[item.priority]}
                          </span>
                        </div>
                        <p>{item.description}</p>
                        <div className="notifications-meta">
                          <span className="notifications-type">{meta.label}</span>
                          <span>{formatWhen(item.occurredAt)}</span>
                        </div>
                      </div>
                      <div className="notifications-actions">
                        {!item.read ? (
                          <button type="button" className="text-action" onClick={() => markRead(item.id)}>
                            {t("aNtf.read3")}
                          </button>
                        ) : null}
                        {item.actionTo && item.actionLabel ? (
                          <Link className="btn btn-secondary btn-sm" to={item.actionTo}>
                            {item.actionLabel}
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {pageTab === "incoming" ? (
          <aside className="notifications-aside card">
            <h3>{t("aNtf.needsAttention")}</h3>
            {!attentionItems.length ? (
              <p className="muted notifications-aside-empty">{t("aNtf.allGoodRightNow")}</p>
            ) : (
              <ul className="notifications-attention-list">
                {attentionItems.map((item) => (
                  <li key={item.id} className={`notifications-attention-item priority-${item.priority}`}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    {item.actionTo ? (
                      <Link to={item.actionTo} onClick={() => markRead(item.id)}>
                        {item.actionLabel}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        ) : null}
      </div>
      )}

      <NotificationsSendSheet
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={handleSent}
        tenantName={tenantName}
        students={students}
        groups={groups}
        courses={courses}
        enrollments={enrollments}
      />

      {selectedSent ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aNtf.notificationDetails")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aNtf.close")}
            onClick={() => setSelectedSent(null)}
          />
          <div className="sheet notifications-sent-detail-sheet">
            <div className="sheet-head">
              <div>
                <h2>{selectedSent.title}</h2>
                <p className="muted">{formatWhen(selectedSent.created_at)}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label={t("aNtf.close")}
                onClick={() => setSelectedSent(null)}
              >
                ×
              </button>
            </div>
            <div className="sheet-body notifications-sent-detail-body">
              {selectedSent.detailError ? <Banner>{selectedSent.detailError}</Banner> : null}
              {selectedSent.loading ? <p className="muted">{t("aNtf.loading")}</p> : null}
              {!selectedSent.loading ? (
                <>
                  <p>{selectedSent.message}</p>
                  <dl className="notifications-sent-detail-meta">
                    <div>
                      <dt>{t("aNtf.category")}</dt>
                      <dd>{TYPE_META[selectedSent.category]?.label || selectedSent.category}</dd>
                    </div>
                    <div>
                      <dt>{t("aNtf.priority")}</dt>
                      <dd>{PRIORITY_LABELS[selectedSent.priority]}</dd>
                    </div>
                    <div>
                      <dt>{t("aNtf.sender")}</dt>
                      <dd>{selectedSent.sender_name || t("aNtf.learningCentre")}</dd>
                    </div>
                    <div>
                      <dt>{t("aNtf.recipients2")}</dt>
                      <dd>
                        {sentRecipientLabel(selectedSent)} · {selectedSent.recipients_count}
                      </dd>
                    </div>
                    <div>
                      <dt>Push</dt>
                      <dd>{selectedSent.send_push ? t("aNtf.requested") : t("aNtf.no")}</dd>
                    </div>
                    {selectedSent.read_count != null ? (
                      <div>
                        <dt>{t("aNtf.read4")}</dt>
                        <dd>{selectedSent.read_count}</dd>
                      </div>
                    ) : null}
                    {selectedSent.unread_count != null ? (
                      <div>
                        <dt>{t("aNtf.unread3")}</dt>
                        <dd>{selectedSent.unread_count}</dd>
                      </div>
                    ) : null}
                    {selectedSent.push_sent_count != null ? (
                      <div>
                        <dt>{t("aNtf.pushDelivered")}</dt>
                        <dd>{selectedSent.push_sent_count}</dd>
                      </div>
                    ) : null}
                    {selectedSent.push_failed_count != null && selectedSent.push_failed_count > 0 ? (
                      <div>
                        <dt>{t("aNtf.pushErrors")}</dt>
                        <dd>{selectedSent.push_failed_count}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {selectedSent.recipients?.length ? (
                    <div className="notifications-sent-recipients">
                      <h3>{t("aNtf.recipients2")}</h3>
                      <ul>
                        {selectedSent.recipients.map((row) => (
                          <li key={row.id}>
                            <strong>{row.student_name}</strong>
                            <span>{row.read ? t("aNtf.read3") : t("aNtf.unread4")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="sheet-foot">
              <Button type="button" onClick={() => setSelectedSent(null)}>
                {t("aNtf.close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
