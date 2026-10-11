/* Who is calling: resolved from the demo access token and the X-Tenant-ID the client sends,
   the same way the backend resolves request.user / request.membership / linked_student. */
import { findById, table } from "./db";
import { MockHttpError } from "./http";

export const TOKEN_PREFIX = "demo-access.";

export function tokenFor(userId) {
  return `${TOKEN_PREFIX}${userId}`;
}

export function buildContext({ method, path, query, body, access, tenantId, tenant }) {
  const ctx = { method, path, query, body, params: {}, user: null, membership: null, role: null, student: null, tenantId: null };
  if (access && access.startsWith(TOKEN_PREFIX)) {
    ctx.user = findById("users", access.slice(TOKEN_PREFIX.length));
  }
  if (!tenant) return ctx;
  if (!tenantId) {
    throw new MockHttpError(400, { message: "Учебный центр не выбран.", details: { tenant: "X-Tenant-ID header is required." } });
  }
  ctx.tenantId = String(tenantId);
  if (ctx.user) {
    ctx.membership =
      table("memberships").find((m) => m.user === ctx.user.id && m.tenant === ctx.tenantId && m.is_active) || null;
    // A platform admin opening a centre works there with owner rights.
    if (!ctx.membership && ctx.user.is_superuser) {
      ctx.membership = { id: `super-${ctx.user.id}`, tenant: ctx.tenantId, user: ctx.user.id, role: "owner", virtual: true };
    }
    ctx.role = ctx.membership?.role || null;
    if (ctx.role === "student") {
      ctx.student = table("students").find((s) => s.user === ctx.user.id && s.tenant === ctx.tenantId) || null;
    }
  }
  return ctx;
}

export const isStaff = (ctx) => ctx.role && ctx.role !== "student";
export const isTeacher = (ctx) => ctx.role === "teacher";
export const isStudent = (ctx) => ctx.role === "student";
export const canSeePayroll = (ctx) => ctx.role === "owner" || ctx.role === "accountant";

export function requireRoles(ctx, roles) {
  if (!roles.includes(ctx.role)) {
    throw new MockHttpError(403, { detail: "У вас нет прав на это действие." });
  }
}

/** Rows of the active centre only. */
export function tenantRows(ctx, name) {
  return table(name).filter((row) => row.tenant === ctx.tenantId);
}

/** Group ids where the linked student has an active enrollment. */
export function studentGroupIds(ctx) {
  if (!ctx.student) return new Set();
  return new Set(
    table("enrollments")
      .filter((e) => e.student === ctx.student.id && e.status === "active")
      .map((e) => e.group),
  );
}

/** Group ids taught by the calling teacher. */
export function teacherGroupIds(ctx) {
  return new Set(tenantRows(ctx, "groups").filter((g) => g.teacher === ctx.membership?.id).map((g) => g.id));
}
