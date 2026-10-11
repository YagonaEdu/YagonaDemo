import { formatDateTime, numberLocaleTag, t } from "@/i18n";

/* Formatters follow the active language (Russian outside translated screens). */
const numberFormatters = new Map();
const dateFormat = (options) => ({ format: (value) => formatDateTime(value, options) });
function numberFormat(options) {
  const key = `${numberLocaleTag()}|${JSON.stringify(options)}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(numberLocaleTag(), options));
  return numberFormatters.get(key);
}

export function results(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.results || [];
}

/** YYYY-MM-DD of the local calendar day (toISOString is UTC: in Tashkent it gives the
    previous day until 05:00 and shifts period boundaries). */
export function localIsoDate(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today() {
  return localIsoDate(new Date());
}

function currencyLabel(currency = "UZS") {
  const code = String(currency || "UZS").toUpperCase();
  if (code === "UZS" || code === "SUM" || code === "SOM") return t("format.currencyUzs");
  return currency || t("format.currencyUzs");
}

export function money(value, currency = "UZS") {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  const label = currencyLabel(currency);
  if (Number.isNaN(amount)) return `${value} ${label}`;
  const fraction = Number.isInteger(amount) ? 0 : 2;
  const formatted = numberFormat({
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
  return `${formatted} ${label}`;
}

export function normalizePriceDigits(value) {
  if (value == null || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d+(\.\d+)?$/.test(str)) {
    const amount = Math.floor(Number(str));
    return amount > 0 ? String(amount) : "";
  }
  const digits = str.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+/, "") || "0";
}

export function formatMoneyInput(value) {
  const raw = normalizePriceDigits(value);
  if (!raw) return "";
  return numberFormat({ maximumFractionDigits: 0 }).format(Number(raw));
}

export function moneyInputSuffix(currency = "UZS") {
  return currencyLabel(currency);
}

export function priceToApi(value) {
  const raw = normalizePriceDigits(value);
  return raw || "0";
}

export function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).includes("T") ? value : `${value}T12:00:00`;
  return dateFormat({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(raw));
}

export function formatWhen(value) {
  if (!value) return "—";
  return dateFormat({
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return "—";
  return dateFormat({ hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function addDays(value, days) {
  const base = value && value >= today() ? value : today();
  const date = new Date(`${base}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

export function toIso(localValue) {
  if (!localValue) return null;
  return new Date(localValue).toISOString();
}

/** Absolute media URL for Django file fields. */
export function mediaUrl(path) {
  if (!path) return "";
  // Demo build: uploaded files are data:/blob: URLs created in the browser; links stay as is.
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/** Looks like email / free text, not a phone number. */
export function looksLikeEmail(value) {
  return /[a-zA-Z@]/.test(String(value || ""));
}

export function uzPhoneLocalDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return (digits.startsWith("998") ? digits.slice(3) : digits).slice(0, 9);
}

export function formatUzPhoneLocal(value) {
  const local = uzPhoneLocalDigits(value);
  const parts = [];
  if (local.length > 0) parts.push(local.slice(0, 2));
  if (local.length > 2) parts.push(local.slice(2, 5));
  if (local.length > 5) parts.push(local.slice(5, 7));
  if (local.length > 7) parts.push(local.slice(7, 9));
  return parts.join(" ");
}

/** Display mask: +998 99 999 99 99 */
export function formatUzPhone(value) {
  const local = formatUzPhoneLocal(value);
  if (!local) return "";
  return `+998 ${local}`;
}

/** API/storage: +998XXXXXXXXX */
export function toApiPhone(value) {
  const local = uzPhoneLocalDigits(value);
  if (!local) return null;
  return `+998${local}`;
}

export function isPhoneLikeQuery(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (looksLikeEmail(trimmed)) return false;
  if (/^[+\d(]/.test(trimmed)) return true;
  if (/\d/.test(trimmed) && !/[a-zA-Zа-яА-ЯёЁ]/.test(trimmed)) return true;
  return false;
}

/** Mixed search fields: format phone queries, keep names/emails as typed. */
export function formatQueryWithPhone(value) {
  const trimmed = String(value || "");
  if (!trimmed) return "";
  if (looksLikeEmail(trimmed)) return trimmed;
  if (isPhoneLikeQuery(trimmed)) return formatUzPhone(trimmed);
  return value;
}

/** Value for API login: +998XXXXXXXXX or email as-is. */
export function toLoginIdentifier(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (looksLikeEmail(trimmed)) return trimmed;

  const apiPhone = toApiPhone(trimmed);
  return apiPhone || "";
}

/** "1500000.00" → "1 500 000 сум" without float arithmetic. */
export function moneyExact(value, currency = "UZS") {
  if (value == null || value === "") return "—";
  const text = String(value).trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return `${text} ${currencyLabel(currency)}`;
  const [, sign, intPart, frac = ""] = match;
  const grouped = numberFormat({}).format(BigInt(intPart));
  const cents = frac.replace(/0+$/, "");
  return `${sign}${grouped}${cents ? `,${frac.padEnd(2, "0").slice(0, 2)}` : ""} ${currencyLabel(currency)}`;
}

/** Compare decimal strings exactly: returns true when value > 0. */
export function isPositiveAmount(value) {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text) || text.startsWith("-")) return false;
  return /[1-9]/.test(text);
}

export function formatDayLong(value) {
  return value ? dateFormat({ weekday: "long", day: "numeric", month: "long" }).format(new Date(value)) : "—";
}

export function formatDayShort(value) {
  return value ? dateFormat({ weekday: "short", day: "numeric", month: "short" }).format(new Date(value)) : "—";
}

/** Monday 00:00 local of the week containing `date`. */
export function startOfWeek(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const shift = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - shift);
  return result;
}

export function shiftDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

/** Local calendar key YYYY-MM-DD (not UTC). */
export function localDayKey(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toCents(value) {
  const match = String(value ?? "0").trim().match(/^(-?)(\d+)(?:\.(\d{0,2})\d*)?$/);
  if (!match) return 0n;
  const [, sign, intPart, frac = ""] = match;
  const cents = BigInt(intPart) * 100n + BigInt(frac.padEnd(2, "0") || "0");
  return sign ? -cents : cents;
}

/** Exact sum of decimal strings → "123.45". */
export function sumDecimal(values) {
  const total = values.reduce((acc, value) => acc + toCents(value), 0n);
  const negative = total < 0n;
  const abs = negative ? -total : total;
  const text = `${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

const RU_PLURAL = new Intl.PluralRules("ru-RU");

/** pluralRu(3, ["день", "дня", "дней"]) → "3 дня" */
export function pluralRu(count, [one, few, many]) {
  const form = { one, few, many }[RU_PLURAL.select(count)] || many;
  return `${count} ${form}`;
}

/** Absolute local deadline: "пт, 4 октября, 18:00". */
export function formatDeadline(value) {
  if (!value) return t("format.noDeadline");
  return dateFormat({ weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

/** Relative deadline in the user's zone: "сегодня до 18:00", "через 2 дня", "просрочено на 3 ч". */
export function relativeDue(value, now = Date.now()) {
  if (!value) return t("format.noDeadline");
  const due = new Date(value);
  const diff = due.getTime() - now;
  if (diff < 0) {
    const ago = -diff;
    if (ago < 3600000) return t("format.overdueMinutes", { count: Math.max(1, Math.round(ago / 60000)) });
    if (ago < 86400000) return t("format.overdueHours", { count: Math.floor(ago / 3600000) });
    return t("format.overdueDays", { count: Math.floor(ago / 86400000) });
  }
  const time = formatTime(value);
  if (sameDay(due, now)) return t("format.todayUntil", { time });
  if (sameDay(due, shiftDays(new Date(now), 1))) return t("format.tomorrowUntil", { time });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - startToday) / 86400000);
  return t("format.inDays", { count: days });
}

/** "18 ч 05 мин" / "42 мин" — for countdowns under a day. */
export function shortCountdown(target, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((new Date(target).getTime() - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours
    ? t("format.hoursMinutes", { hours, minutes: String(minutes % 60).padStart(2, "0") })
    : t("format.minutes", { count: minutes });
}

export function formatBytes(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return t("format.bytes", { size });
  if (size < 1024 * 1024) return t("format.kilobytes", { size: Math.round(size / 1024) });
  return t("format.megabytes", { size: numberFormat({ maximumFractionDigits: 1 }).format(size / (1024 * 1024)) });
}
