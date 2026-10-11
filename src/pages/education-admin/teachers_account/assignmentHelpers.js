import { t } from "@/i18n";
import { formatDate, formatTime } from "@/utils/format";

/** Handed-in work waiting for review (rows come from homeworkApi.toHomeworkRow). */
export function pendingReviewCount(row) {
  return Number(row.awaiting_count || 0);
}

export function isPastDue(row) {
  return row.status === "published" && row.due_at && new Date(row.due_at) < new Date();
}

export function isSameLocalDay(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function assignmentDueMeta(dueAt, status) {
  if (!dueAt || status === "draft") return null;
  const due = new Date(dueAt);
  const now = new Date();
  if (due < now && status === "published") {
    return { label: t("tch.due.overdue"), tone: "overdue" };
  }
  if (isSameLocalDay(dueAt)) {
    return { label: t("tch.due.today"), tone: "today" };
  }
  return null;
}

export function assignmentStatusLabel(row) {
  if (row.status === "draft") return { label: t("tch.status.draft"), tone: "muted" };
  const due = assignmentDueMeta(row.due_at, row.status);
  if (due) return due;
  return { label: t("tch.due.active"), tone: "active" };
}

export function formatDueLabel(dueAt) {
  if (!dueAt) return "—";
  return `${formatDate(dueAt)} · ${formatTime(dueAt)}`;
}

export function filterAssignmentTab(tab, row) {
  if (tab === "all") return true;
  if (tab === "active") return row.status === "published";
  if (tab === "review") return row.status === "published" && pendingReviewCount(row) > 0;
  if (tab === "past") return isPastDue(row);
  if (tab === "draft") return row.status === "draft";
  return true;
}

export function sortAssignments(rows = []) {
  return [...rows].sort((a, b) => {
    const reviewA = pendingReviewCount(a);
    const reviewB = pendingReviewCount(b);
    if (reviewB !== reviewA) return reviewB - reviewA;

    const dueA = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const dueB = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    const now = Date.now();
    const urgentA = a.status === "published" && dueA >= now ? dueA : Infinity;
    const urgentB = b.status === "published" && dueB >= now ? dueB : Infinity;
    if (urgentA !== urgentB) return urgentA - urgentB;

    if (isPastDue(a) && !isPastDue(b)) return 1;
    if (isPastDue(b) && !isPastDue(a)) return -1;

    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

export function buildAttentionItems(rows = [], groupMap) {
  const items = [];
  rows.forEach((row) => {
    const pending = pendingReviewCount(row);
    const missing = Number(row.missing_count || 0);
    const due = assignmentDueMeta(row.due_at, row.status);
    const groupName = groupMap.get(String(row.group))?.name || "—";

    if (pending > 0) {
      items.push({
        key: `review-${row.id}`,
        kind: "review",
        title: t("tch.attention.worksWaiting", { count: pending }),
        subtitle: `${groupName} · ${row.title}`,
        action: t("tch.attention.review"),
        assignment: row,
        mode: "review",
      });
    }
    if (missing > 0) {
      items.push({
        key: `missing-${row.id}`,
        kind: "missing",
        title: t("tch.attention.studentsMissing", { count: missing }),
        subtitle: `${groupName} · ${row.title}`,
        action: t("tch.attention.remind"),
        assignment: row,
        mode: "missing",
      });
    }
    if (due?.tone === "today") {
      items.push({
        key: `due-${row.id}`,
        kind: "due",
        title: t("tch.attention.dueToday"),
        subtitle: `${groupName} · ${row.title}`,
        action: t("tch.attention.open"),
        assignment: row,
        mode: "open",
      });
    }
  });
  return items.slice(0, 6);
}

export function submissionStatusLabel(status) {
  return ["missing", "submitted", "late", "returned", "graded"].includes(status)
    ? t(`tch.status.${status}`)
    : status;
}

export function submissionStatusTone(status) {
  if (status === "graded") return "green";
  if (status === "missing" || status === "returned") return "warn";
  if (status === "late") return "warn";
  return "blue";
}
