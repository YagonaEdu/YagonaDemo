import { mockRequest } from "@/api";

/* DEMO BUILD: there is no backend. Every request is answered by the in-browser mock API
   (src/api, data from src/mocks) with the same payloads as the Django REST API. */
const GET_CACHE_TTL_MS = 15000;
const getCache = new Map();
let refreshPromise = null;

function apiUrl(path) {
  return `/${String(path || "").replace(/^\/+/, "")}`;
}

function cacheKey(path, tenantId) {
  return `${tenantId || "no-tenant"}:${path}`;
}

function readCache(key) {
  const hit = getCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > GET_CACHE_TTL_MS) {
    getCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key, data) {
  getCache.set(key, { at: Date.now(), data });
}

export function invalidateApiCache(prefix = "") {
  if (!prefix) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.includes(prefix)) getCache.delete(key);
  }
}

function notifyAuthExpired() {
  window.dispatchEvent(new Event("yagona-auth-expired"));
}

export class ApiError extends Error {
  constructor(status, payload) {
    super(formatMessage(status, payload));
    this.status = status;
    this.payload = payload;
  }
}

function formatMessage(status, payload) {
  if (!payload) return `Ошибка ${status}`;
  const top = payload.message || payload.detail;
  if (top && !String(top).includes("ErrorDetail")) return String(top);
  // Surface DRF field-level validation errors (e.g. {"field": ["msg"]})
  const details = flattenDetails(payload.details ?? payload);
  return details || `Ошибка ${status}`;
}

function flattenDetails(details) {
  if (!details) return "";
  if (typeof details === "string") return details;
  if (Array.isArray(details)) {
    return details.map((item) => flattenDetails(item)).filter(Boolean).join(", ");
  }
  if (typeof details === "object") {
    return Object.entries(details)
      .map(([key, value]) => {
        const text = flattenDetails(value);
        if (!text) return "";
        return key === "detail" || key === "non_field_errors" ? text : `${fieldLabel(key)}: ${text}`;
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(details);
}

function fieldLabel(key) {
  const labels = {
    paid_amount: "Сумма выплаты",
    accrued_amount: "Начисление",
    membership: "Сотрудник",
    period: "Период",
    status: "Статус",
    tenant: "Учебный центр",
    current_password: "Текущий пароль",
    new_password: "Новый пароль",
    confirm: "Подтверждение",
    primary_color: "Основной цвет",
    secondary_color: "Доп. цвет",
    name: "Название",
    email: "Email",
    phone: "Телефон",
  };
  return labels[key] || key;
}

async function refreshAccess() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refresh } = getSession();
    if (!refresh) return false;

    try {
      const { data } = await mockRequest(apiUrl("/auth/refresh"), {
        method: "POST",
        body: { refresh },
        tenant: false,
      });
      setSessionSilent({
        access: data.access,
        refresh: data.refresh || refresh,
      });
      return true;
    } catch {
      clearSession();
      notifyAuthExpired();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function getSession() {
  return {
    access: localStorage.getItem("access") || "",
    refresh: localStorage.getItem("refresh") || "",
    tenantId: localStorage.getItem("tenantId") || "",
    tenantSlug: localStorage.getItem("tenantSlug") || "",
    mode: localStorage.getItem("mode") || "",
    user: safeJsonParse(localStorage.getItem("user"), null),
    memberships: safeJsonParse(localStorage.getItem("memberships"), []),
  };
}

function serializeSessionValue(value) {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function writeSession(partial, { emit = true } = {}) {
  let changed = false;
  for (const [key, value] of Object.entries(partial)) {
    const next = serializeSessionValue(value);
    const prev = localStorage.getItem(key);
    if (next == null) {
      if (prev != null) {
        localStorage.removeItem(key);
        changed = true;
      }
      continue;
    }
    if (prev !== next) {
      localStorage.setItem(key, next);
      changed = true;
    }
  }
  if (changed && emit) window.dispatchEvent(new Event("yagona-session"));
  return changed;
}

export function setSession(partial) {
  writeSession(partial, { emit: true });
}

/** Write session keys without notifying React (used mid-login). */
export function setSessionSilent(partial) {
  writeSession(partial, { emit: false });
}

export function clearSession() {
  ["access", "refresh", "tenantId", "tenantSlug", "mode", "user", "memberships"].forEach((key) =>
    localStorage.removeItem(key),
  );
  getCache.clear();
  refreshPromise = null;
  window.dispatchEvent(new Event("yagona-session"));
}

export async function request(
  path,
  { method = "GET", body, tenant = true, retry = true, cache = false } = {},
) {
  const session = getSession();

  if (tenant && !session.tenantId) {
    throw new ApiError(400, {
      message: "Учебный центр не выбран. Войдите снова.",
      details: { tenant: "X-Tenant-ID header is required." },
    });
  }

  const isGet = method === "GET";
  const key = cacheKey(path, tenant ? session.tenantId : "");
  if (isGet && cache) {
    const cached = readCache(key);
    if (cached !== null) return cached;
  }

  // The mock API reads the token and centre from the same localStorage session keys
  // the real client sends as Authorization / X-Tenant-ID headers.
  let response;
  try {
    response = await mockRequest(apiUrl(path), { method, body, tenant });
  } catch (err) {
    response = { status: err?.status || 500, data: err?.payload || { message: err?.message }, failed: true };
  }

  if (response.status === 401 && retry) {
    const live = getSession();
    if (live.refresh) {
      const ok = await refreshAccess();
      if (ok) {
        return request(path, { method, body, tenant, retry: false, cache });
      }
      throw new ApiError(401, { message: "Сессия истекла. Войдите снова." });
    }
    clearSession();
    notifyAuthExpired();
    throw new ApiError(401, { message: "Требуется авторизация." });
  }

  const { data } = response;
  if (response.failed) throw new ApiError(response.status, data);

  if (isGet && cache) writeCache(key, data);
  if (!isGet) invalidateApiCache(tenant ? session.tenantId : "");

  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  del: (path, options) => request(path, { ...options, method: "DELETE" }),
};
