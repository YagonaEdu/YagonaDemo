import { t, translated } from "@/i18n";

/** Marker in lesson.topic for reception trial lessons (no parallel Visitor model). */
export const TRIAL_TOPIC_PREFIX = "ПРОБНЫЙ:";

export const SOURCE_OPTIONS = [
  { value: "manual", label: "t:aRecU.manualFrontDesk" },
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "t:aRecU.website" },
  { value: "other", label: "t:aRecU.other" },
].map(translated);

export const PAYMENT_METHODS = [
  { value: "cash", label: "t:aRecU.cash" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "card", label: "t:aRecU.card" },
  { value: "bank_transfer", label: "t:aRecU.bankTransfer" },
].map(translated);

/* Convenient visit times offered in «Новый посетитель». The Russian words go into the lead
   notes (stored data, shown the same in every cabinet); the chips show t(`rxSheet.time_${code}`). */
export const VISIT_TIMES = ["morning", "day", "evening", "weekend"];
export const VISIT_TIME_NOTE = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
  weekend: "Выходные",
};

/* Trial lesson outcomes. The Russian words are written into the lead history (stored
   data read by every cabinet), so they stay Russian; screens show t(`aRec.outcome_${code}`). */
export const TRIAL_OUTCOME_HISTORY = {
  came: "Пришёл",
  no_show: "Не пришёл",
  rescheduled: "Перенесено",
  enrolled: "Записался",
  cancelled: "Отменено",
};

export function isTrialLesson(lesson) {
  return String(lesson?.topic || "").trim().toUpperCase().startsWith("ПРОБНЫЙ");
}

export function parseTrialTopic(topic = "") {
  const raw = String(topic || "");
  if (!raw.toUpperCase().startsWith("ПРОБНЫЙ")) {
    return { name: "", phone: "", comment: raw };
  }
  const body = raw.replace(/^ПРОБНЫЙ:\s*/i, "");
  const parts = body.split("·").map((p) => p.trim());
  return {
    name: parts[0] || "",
    phone: parts[1] || "",
    comment: parts.slice(2).join(" · "),
  };
}

export function buildTrialTopic({ name, phone, comment = "" }) {
  const bits = [TRIAL_TOPIC_PREFIX, name.trim(), phone.trim()].filter(Boolean);
  const base = bits.join(" · ").replace(`${TRIAL_TOPIC_PREFIX} ·`, `${TRIAL_TOPIC_PREFIX}`);
  return comment.trim() ? `${base} · ${comment.trim()}` : base;
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

export function invoiceBalance(row) {
  if (!row) return 0;
  if (row.balance != null && row.balance !== "") return Number(row.balance);
  return Number(row.amount || 0) - Number(row.paid_amount || 0);
}

export function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function combineDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

export function staffLabel(member) {
  if (!member) return "—";
  const user = member.user || {};
  return (
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.email ||
    member.position ||
    t("aRecU.staffMember")
  );
}
