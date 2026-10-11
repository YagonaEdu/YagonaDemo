/* Tiny route table: "METHOD /path/:param" → handler(ctx). Plus a DRF-ModelViewSet-like
   CRUD factory so most resources are one declaration. */
import { findById, insert, patch, remove, table } from "./db";
import { forbidden, listResponse, notFound } from "./http";

const routes = [];

export function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    `^${pattern.replace(/\/:([a-zA-Z_]+)/g, (_, key) => {
      keys.push(key);
      return "/([^/]+)";
    })}/?$`,
  );
  routes.push({ method, regex, keys, handler });
}

export function resolve(method, path) {
  for (const item of routes) {
    if (item.method !== method) continue;
    const match = item.regex.exec(path);
    if (!match) continue;
    const params = {};
    item.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return { handler: item.handler, params };
  }
  return null;
}

/**
 * Registers list / create / retrieve / update / destroy for one table.
 *  - scope(ctx) → rows the caller may see (tenant + role filtering)
 *  - out(row, ctx) → payload
 *  - writeRoles: roles allowed to create/update/delete (default: any staff)
 *  - create(ctx, body) / update(ctx, row, body) / destroy(ctx, row): optional overrides
 */
export function crud(base, options) {
  const {
    tableName,
    scope,
    out,
    search = [],
    aliases = {},
    ordering,
    orderAliases,
    writeRoles = ["owner", "admin", "accountant", "teacher"],
    readOnly = false,
    noDelete = false,
    create,
    update,
    destroy,
  } = options;

  const getRow = (ctx) => {
    const row = scope(ctx).find((item) => String(item.id) === String(ctx.params.id));
    if (!row) throw notFound();
    return row;
  };
  const canWrite = (ctx) => {
    if (!writeRoles.includes(ctx.role)) throw forbidden();
  };

  route("GET", base, (ctx) => listResponse(scope(ctx).map((row) => out(row, ctx)), ctx, { search, aliases, ordering, orderAliases }));
  route("GET", `${base}/:id`, (ctx) => out(getRow(ctx), ctx));
  if (readOnly) return;

  route("POST", base, (ctx) => {
    canWrite(ctx);
    const row = create ? create(ctx, ctx.body) : insert(tableName, { ...ctx.body, tenant: ctx.tenantId });
    return { status: 201, data: out(row, ctx) };
  });
  const doUpdate = (ctx) => {
    canWrite(ctx);
    const row = getRow(ctx);
    const updated = update ? update(ctx, row, ctx.body) : patch(tableName, row.id, ctx.body);
    return out(updated || findById(tableName, row.id), ctx);
  };
  route("PATCH", `${base}/:id`, doUpdate);
  route("PUT", `${base}/:id`, doUpdate);
  if (noDelete) return;
  route("DELETE", `${base}/:id`, (ctx) => {
    canWrite(ctx);
    const row = getRow(ctx);
    if (destroy) destroy(ctx, row);
    else remove(tableName, row.id);
    return { status: 204, data: null };
  });
}

/** Rows of a table filtered by the active tenant. */
export function inTenant(ctx, name) {
  return table(name).filter((row) => row.tenant === ctx.tenantId);
}
