import { translated } from "@/i18n";

export const APP_MODES = {
  SUPER_ADMIN: "yagona_super_admin",
  EDUCATION_ADMIN: "yagona_education_admin",
  STUDENT: "yagona_student",
};

export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  TEACHER: "teacher",
  ACCOUNTANT: "accountant",
  STUDENT: "student",
};

export const ROLE_LABELS = translated({
  owner: "t:roles.owner",
  admin: "t:roles.admin",
  teacher: "t:roles.teacher",
  accountant: "t:roles.accountant",
  student: "t:roles.student",
});

/* Default staff positions are stored in Russian; these are shown as the translated role. */
const DEFAULT_POSITION_ROLES = {
  Владелец: "owner",
  Администратор: "admin",
  Преподаватель: "teacher",
  Бухгалтер: "accountant",
};

/** A staff member's position in the current language (custom positions as typed). */
export function positionLabel(position) {
  const role = DEFAULT_POSITION_ROLES[position];
  return role ? ROLE_LABELS[role] : position || "";
}

export const PLAN_LABELS = {
  trial: "Пробный",
  start: "Старт",
  business: "Бизнес",
};

export const CYCLE_LABELS = {
  monthly: "месяц",
  yearly: "год",
};

export const LICENSE_LABELS = {
  active: "оплачен",
  trial: "пробный",
  expired: "истёк",
  suspended: "отключён",
};

export const STUDENT_STATUS_LABELS = translated({
  active: "t:status.active",
  inactive: "t:status.inactive",
  archived: "t:status.archived",
});

/** Human labels for every status value rendered in badges. */
export const STATUS_LABELS = translated({
  active: "t:status.active",
  inactive: "t:status.inactive",
  archived: "t:status.archived",
  draft: "t:status.draft",
  issued: "t:status.issued",
  paid: "t:status.paid",
  partially_paid: "t:status.partially_paid",
  overdue: "t:status.overdue",
  canceled: "t:status.canceled",
  cancelled: "t:status.cancelled",
  refunded: "t:status.refunded",
  present: "t:status.present",
  absent: "t:status.absent",
  late: "t:status.late",
  excused: "t:status.excused",
  planned: "t:status.planned",
  scheduled: "t:status.scheduled",
  ongoing: "t:status.ongoing",
  completed: "t:status.completed",
  queued: "t:status.queued",
  sending: "t:status.sending",
  sent: "t:status.sent",
  delivered: "t:status.delivered",
  failed: "t:status.failed",
  succeeded: "t:status.succeeded",
  pending: "t:status.pending",
  new: "t:status.new",
  contacted: "t:status.contacted",
  won: "t:status.won",
  lost: "t:status.lost",
  trial: "t:status.trial",
  expired: "t:status.expired",
  suspended: "t:status.suspended",
});

/** Navigation for education center by role (segment after /education/:slug/) */
export const SUPER_ADMIN_NAV = [
  { to: "/super", label: "Обзор", end: true, group: "Платформа" },
  { to: "/super/centers", label: "Центры", group: "Платформа" },
  { to: "/super/students", label: "Ученики", group: "Платформа" },
  { to: "/super/plans", label: "Тарифы", group: "Биллинг" },
  { to: "/super/licenses", label: "Лицензии", group: "Биллинг" },
  { to: "/super/wallet", label: "Кошелёк", group: "Биллинг" },
  { to: "/super/analytics", label: "Аналитика", group: "Аналитика" },
];
