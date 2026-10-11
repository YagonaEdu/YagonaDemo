/*
 * Minimal i18n: UZ (Latin) / RU / EN.
 *
 * Messages live in ./messages as `{ key: { ru, uz, en } }`; a plural entry holds
 * `{ one, few, many, other }` per language and is picked with Intl.PluralRules.
 * Translated areas (login and the staff cabinets: owner, reception, accountant, teacher) follow the
 * chosen language; student and platform screens stay Russian until they are translated, so dates
 * never mix with Russian UI (see setTranslatedArea in app/App.jsx).
 */
import { MESSAGES } from "./messages";

export const LANGUAGES = [
  { code: "uz", short: "UZ", label: "O‘zbekcha", tag: "uz-Latn-UZ" },
  { code: "ru", short: "RU", label: "Русский", tag: "ru-RU" },
  { code: "en", short: "EN", label: "English", tag: "en-GB" },
];

export const DEFAULT_LANGUAGE = "ru";
export const LANGUAGE_EVENT = "yagona-language";
const STORAGE_KEY = "yagona-lang";
const BY_CODE = Object.fromEntries(LANGUAGES.map((item) => [item.code, item]));

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return BY_CODE[value] ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/* One state for every copy of this module: a hot update during development loads a second
   copy, and the switch must still change what already-rendered screens read. */
const state = (globalThis.__yagonaI18n ||= { chosen: readStored(), translatedArea: true });

/** The language the user picked (shown in switchers). */
export function getLanguage() {
  return state.chosen;
}

/** The language the current screen renders in. */
export function activeLanguage() {
  return state.translatedArea ? state.chosen : DEFAULT_LANGUAGE;
}

/** BCP 47 tag for Intl formatters of the current screen. */
export function localeTag() {
  return BY_CODE[activeLanguage()].tag;
}

export function setLanguage(code) {
  if (!BY_CODE[code] || code === state.chosen) return;
  state.chosen = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable */
  }
  syncDocumentLanguage();
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

/**
 * Called by App while rendering, before any page renders: screens that are not
 * translated yet keep Russian texts and Russian dates.
 */
export function setTranslatedArea(enabled) {
  state.translatedArea = Boolean(enabled);
  syncDocumentLanguage();
}

function syncDocumentLanguage() {
  if (typeof document !== "undefined") document.documentElement.lang = activeLanguage();
}

// A switch in another tab changes this tab too (registered once, even across hot updates).
if (typeof window !== "undefined" && !state.storageListener) {
  state.storageListener = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !BY_CODE[event.newValue] || event.newValue === state.chosen) return;
    state.chosen = event.newValue;
    syncDocumentLanguage();
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  });
}

function lookup(key) {
  let node = MESSAGES;
  for (const part of key.split(".")) {
    node = node?.[part];
    if (node === undefined) return undefined;
  }
  return node;
}

const pluralRules = new Map();
function pluralForm(lang, count) {
  if (!pluralRules.has(lang)) pluralRules.set(lang, new Intl.PluralRules(BY_CODE[lang].tag));
  return pluralRules.get(lang).select(count);
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null ? match : String(params[name]),
  );
}

/* Browsers ship little or no Uzbek locale data (Chrome prints «M10 7, Wed»), so Uzbek
   dates are assembled here; numbers and times use the Russian pattern, which Uzbek shares
   (space-grouped digits, 24-hour clock). */
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const UZ_WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const UZ_WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

function formatUzbekDate(date, options) {
  const pad = (n) => String(n).padStart(2, "0");
  const parts = [];
  if (options.weekday) parts.push((options.weekday === "long" ? UZ_WEEKDAYS : UZ_WEEKDAYS_SHORT)[date.getDay()]);
  if (options.month === "long" || options.month === "short") {
    const month = (options.month === "long" ? UZ_MONTHS : UZ_MONTHS_SHORT)[date.getMonth()];
    const year = options.year ? ` ${date.getFullYear()}` : "";
    parts.push(options.day ? `${date.getDate()}-${month}${year}` : `${month}${year}`);
  } else if (options.day && !options.month) {
    parts.push(String(date.getDate()));
  } else if (options.day || options.month) {
    const numeric = [pad(date.getDate()), pad(date.getMonth() + 1)];
    if (options.year) numeric.push(date.getFullYear());
    parts.push(numeric.join("."));
  }
  if (options.hour) {
    let time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (options.second) time += `:${pad(date.getSeconds())}`;
    parts.push(time);
  }
  return parts.join(", ");
}

const dateFormatters = new Map();
/** Locale-aware date/time text for the current screen, Uzbek included. */
export function formatDateTime(value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (activeLanguage() === "uz") return formatUzbekDate(date, options);
  const key = `${localeTag()}|${JSON.stringify(options)}`;
  if (!dateFormatters.has(key)) dateFormatters.set(key, new Intl.DateTimeFormat(localeTag(), options));
  return dateFormatters.get(key).format(date);
}

/** Locale for number formatting (Uzbek groups digits like Russian). */
export function numberLocaleTag() {
  return activeLanguage() === "uz" ? "ru-RU" : localeTag();
}

/**
 * For module-level label maps and option lists: values written as "t:some.key" are
 * looked up on every read, so they follow the current language.
 * translated({ draft: "t:status.draft" }).draft → "Черновик" / "Qoralama" / "Draft"
 */
export function translated(map) {
  const out = {};
  for (const [prop, value] of Object.entries(map)) {
    if (typeof value === "string" && value.startsWith("t:")) {
      Object.defineProperty(out, prop, { enumerable: true, get: () => t(value.slice(2)) });
    } else {
      out[prop] = value;
    }
  }
  return out;
}

/** t("home.title"), t("plural.students", { count: 5 }), t("x", { name }) */
export function t(key, params) {
  const lang = activeLanguage();
  const entry = lookup(key);
  if (!entry || typeof entry !== "object") {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  let value = entry[lang] ?? entry[DEFAULT_LANGUAGE];
  if (value && typeof value === "object") {
    const count = Number(params?.count ?? 0);
    const form = pluralForm(lang, count);
    value = value[form] ?? value.other ?? value.many ?? value.one;
  }
  if (typeof value !== "string") {
    if (import.meta.env.DEV) console.warn(`[i18n] no ${lang} text for: ${key}`);
    return key;
  }
  return interpolate(value, params);
}
