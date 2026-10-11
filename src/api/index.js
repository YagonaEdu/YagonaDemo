/* Mock backend entry point. services/api/client.js calls mockRequest() instead of fetch():
   every call resolves (or rejects) after ~300 ms with the same payload shape as the
   Django REST API, using data from src/mocks persisted in localStorage. */
import { buildContext } from "./context";
import { MockHttpError, normalizeBody } from "./http";
import { resolve } from "./router";

// Route registration (order matters only for overlapping literal paths).
import "./handlers/auth";
import "./handlers/center";
import "./handlers/academics";
import "./handlers/crm";
import "./handlers/finance";
import "./handlers/learning";

export { resetDemoData } from "./db";
export { MockHttpError } from "./http";

export const MOCK_DELAY_MS = 300;

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function readSession() {
  try {
    return {
      access: localStorage.getItem("access") || "",
      tenantId: localStorage.getItem("tenantId") || "",
    };
  } catch {
    return { access: "", tenantId: "" };
  }
}

function splitPath(rawPath) {
  const [pathPart, ...rest] = String(rawPath || "/").split("?");
  const path = `/${pathPart.replace(/^\/+/, "")}`.replace(/^\/api\/v1(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return { path, query: new URLSearchParams(rest.join("?")) };
}

function isEnvelope(result) {
  return Boolean(result) && typeof result === "object" && Object.keys(result).length === 2 && "status" in result && "data" in result;
}

/**
 * @param {string} rawPath  path relative to the API root, e.g. "/lessons?page_size=100"
 * @param {{ method?: string, body?: unknown, tenant?: boolean }} options
 * @returns {Promise<{ status: number, data: unknown }>}
 */
export async function mockRequest(rawPath, { method = "GET", body, tenant = true } = {}) {
  const started = Date.now();
  const { path, query } = splitPath(rawPath);
  const payload = await normalizeBody(body);
  const session = readSession();

  let outcome;
  try {
    const ctx = buildContext({ method, path, query, body: payload, access: session.access, tenantId: session.tenantId, tenant });
    const match = resolve(method, path);
    if (!match) throw new MockHttpError(404, { detail: `Демо: эндпоинт ${method} ${path} не реализован.` });
    if (!path.startsWith("/auth/") && !ctx.user) throw new MockHttpError(401, { detail: "Требуется авторизация." });
    ctx.params = match.params;
    const result = await match.handler(ctx);
    outcome = isEnvelope(result) ? result : { status: 200, data: result };
  } catch (err) {
    outcome = err instanceof MockHttpError ? err : new MockHttpError(500, { detail: err?.message || "Ошибка демо-сервера." });
    if (!(err instanceof MockHttpError)) console.error("[demo api]", method, path, err);
  }

  const jitter = Math.round((Math.random() - 0.5) * 80);
  await wait(Math.max(0, MOCK_DELAY_MS + jitter - (Date.now() - started)));

  if (outcome instanceof MockHttpError) throw outcome;
  // A deep copy, so screens never mutate the stored rows by reference.
  return { status: outcome.status, data: outcome.data == null ? null : JSON.parse(JSON.stringify(outcome.data)) };
}
