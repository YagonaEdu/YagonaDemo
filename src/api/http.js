/* Helpers that make mock handlers answer like the Django REST API:
   DRF pagination, filterset/search/ordering query params and error payloads. */

export class MockHttpError extends Error {
  constructor(status, payload) {
    super(payload?.detail || payload?.message || `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export const notFound = () => new MockHttpError(404, { detail: "Не найдено.", code: "not_found" });
export const forbidden = (detail = "У вас нет прав на это действие.") =>
  new MockHttpError(403, { detail });
export const invalid = (details) => new MockHttpError(400, details);

const RESERVED = new Set(["page", "page_size", "ordering", "search", "starts_at_from", "starts_at_to", "mine"]);

function matches(rowValue, expected) {
  if (Array.isArray(rowValue)) return rowValue.map(String).includes(expected);
  if (typeof rowValue === "boolean") return String(rowValue) === expected;
  if (rowValue == null) return expected === "" || expected === "null";
  return String(rowValue) === expected;
}

/**
 * Applies `field=value`, `field__in=a,b`, `search=` and `ordering=` to serialized rows.
 * Unknown params (UI-only ones) are ignored, like DRF ignores them.
 */
export function filterRows(rows, query, { search = [], aliases = {} } = {}) {
  let out = rows;
  for (const [rawKey, value] of query.entries()) {
    if (RESERVED.has(rawKey) || value === "") continue;
    const key = aliases[rawKey] || rawKey;
    if (key.endsWith("__in")) {
      const field = aliases[key.slice(0, -4)] || key.slice(0, -4);
      const wanted = new Set(value.split(",").map((item) => item.trim()));
      out = out.filter((row) => field in row && wanted.has(String(row[field])));
      continue;
    }
    if (out.length && !(key in out[0])) continue;
    out = out.filter((row) => matches(row[key], value));
  }
  const term = (query.get("search") || "").trim().toLowerCase();
  if (term && search.length) {
    out = out.filter((row) =>
      search.some((field) => String(row[field] ?? "").toLowerCase().includes(term)),
    );
  }
  const from = query.get("starts_at_from");
  const to = query.get("starts_at_to");
  if (from) out = out.filter((row) => !row.starts_at || row.starts_at >= new Date(from).toISOString());
  if (to) out = out.filter((row) => !row.starts_at || row.starts_at <= new Date(to).toISOString());
  return out;
}

export function orderRows(rows, ordering, aliases = {}) {
  if (!ordering) return rows;
  const keys = ordering
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const desc = item.startsWith("-");
      const name = item.replace(/^-/, "");
      return { desc, name: aliases[name] || name.replace(/__/g, "_") };
    });
  return [...rows].sort((a, b) => {
    for (const { desc, name } of keys) {
      const left = a[name];
      const right = b[name];
      if (left === right) continue;
      if (left == null) return 1;
      if (right == null) return -1;
      const numeric =
        left !== "" && right !== "" && !Number.isNaN(Number(left)) && !Number.isNaN(Number(right));
      const cmp = numeric
        ? Number(left) - Number(right)
        : String(left).localeCompare(String(right), "ru");
      if (cmp) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

/** DRF PageNumberPagination: page_size defaults to 25 and is capped at 500. */
export function paginate(rows, path, query) {
  const size = Math.min(Math.max(Number(query.get("page_size")) || 25, 1), 500);
  const page = Math.max(Number(query.get("page")) || 1, 1);
  const start = (page - 1) * size;
  const pageUrl = (number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(number));
    return `/api/v1${path}?${next.toString()}`;
  };
  return {
    count: rows.length,
    next: start + size < rows.length ? pageUrl(page + 1) : null,
    previous: page > 1 ? pageUrl(page - 1) : null,
    results: rows.slice(start, start + size),
  };
}

export function listResponse(rows, ctx, options = {}) {
  const filtered = filterRows(rows, ctx.query, options);
  const ordered = orderRows(filtered, ctx.query.get("ordering") || options.ordering, options.orderAliases);
  return paginate(ordered, ctx.path, ctx.query);
}

function readFile(file) {
  return new Promise((resolve) => {
    // Small files become data: URLs so they survive a reload; large ones live for the session.
    if (file.size > 400 * 1024 || typeof FileReader === "undefined") {
      resolve(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

/** FormData → plain object; File values become { name, size, type, url }. */
export async function normalizeBody(body) {
  if (typeof FormData === "undefined" || !(body instanceof FormData)) return body ?? {};
  const out = {};
  for (const [key, value] of body.entries()) {
    if (typeof File !== "undefined" && value instanceof File) {
      out[key] = { name: value.name, size: value.size, type: value.type, url: await readFile(value) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function money(value) {
  return Number(value || 0).toFixed(2);
}
