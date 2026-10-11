import { STATUS_LABELS } from "@/constants";
import { t, translated } from "@/i18n";
import { ApiError } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { today, localIsoDate } from "@/utils/format";

export const ASSIGNMENT_STATUS_LABELS = translated({
  draft: "t:tch.status.draft",
  published: "t:tch.status.published",
  closed: "t:tch.status.closed",
  not_submitted: "t:tch.status.not_submitted",
  submitted: "t:tch.status.submitted",
  late: "t:tch.status.late",
  returned: "t:tch.status.returned",
  graded: "t:tch.status.graded",
});

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

export function lessonStatus(lesson, attendanceCount = 0, expectedCount = 0) {
  const now = Date.now();
  const start = new Date(lesson.starts_at).getTime();
  const end = new Date(lesson.ends_at).getTime();
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "ongoing";
  if (expectedCount > 0 && attendanceCount < expectedCount) return "unmarked";
  return "completed";
}

export function lessonStatusLabel(status) {
  return ["upcoming", "ongoing", "completed", "unmarked"].includes(status)
    ? t(`tch.lessonStatus.${status}`)
    : status;
}

export async function asList(path) {
  try {
    return await getList(path, { cache: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
    return [];
  }
}

export function staffLabel(user) {
  if (!user) return "—";
  return user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—";
}

export function membershipName(membership, sessionUser) {
  if (sessionUser) return staffLabel(sessionUser);
  if (!membership?.user) return t("tch.teacher");
  return staffLabel(membership.user);
}

export function isoDate(value) {
  return localIsoDate(value);
}

const OPEN_INVOICE_STATUSES = new Set(["issued", "partially_paid", "overdue"]);

export function invoiceBalance(invoice) {
  if (!invoice) return 0;
  if (invoice.balance != null && invoice.balance !== "") return Number(invoice.balance);
  return Number(invoice.amount || 0) - Number(invoice.paid_amount || 0);
}

export function computeStudentDebt(studentId, invoices = []) {
  return invoices
    .filter(
      (row) =>
        String(row.student) === String(studentId) && OPEN_INVOICE_STATUSES.has(row.status),
    )
    .reduce((sum, row) => sum + invoiceBalance(row), 0);
}

export async function optionalList(path) {
  try {
    return await getList(path, { cache: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return [];
    return [];
  }
}

export function attachGuardiansToStudents(students = [], guardians = [], links = []) {
  const guardianMap = new Map(guardians.map((row) => [String(row.id), row]));
  const byStudent = new Map();
  for (const link of links) {
    const guardian = guardianMap.get(String(link.guardian));
    if (!guardian) continue;
    const key = String(link.student);
    const list = byStudent.get(key) || [];
    list.push({
      ...guardian,
      relationship: link.relationship,
      is_primary: link.is_primary,
      link_id: link.id,
    });
    byStudent.set(key, list);
  }
  return students.map((student) => {
    const list = [...(byStudent.get(String(student.id)) || [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    );
    return {
      ...student,
      guardians: list,
      guardian: list[0] || null,
    };
  });
}

export { STATUS_LABELS, today };
