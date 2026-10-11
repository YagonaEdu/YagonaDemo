/* Centre-wide endpoints: notifications, tenant settings, dashboards and the platform
   (super admin) cabinet. */
import { DEFAULT_CENTER_SETTINGS, mergeCenterSettings } from "@/mocks";
import { findById, insert, nowIso, patch, remove, table } from "../db";
import { forbidden, invalid, listResponse, money, MockHttpError, notFound } from "../http";
import { crud, inTenant, route } from "../router";
import { isStudent, isTeacher, teacherGroupIds } from "../context";
import {
  inboxOut,
  licenseStatus,
  outboxOut,
  platformPlanOut,
  platformStudentOut,
  platformTenantOut,
  sentOut,
  tenantSettingsOut,
} from "../serializers";

/* ---------- notifications: student inbox ---------- */

function myRecipients(ctx) {
  if (!isStudent(ctx) || !ctx.student) return [];
  return inTenant(ctx, "notificationRecipients").filter((r) => r.student === ctx.student.id);
}

route("GET", "/notifications", (ctx) =>
  listResponse(myRecipients(ctx).map(inboxOut), ctx, { ordering: "-created_at" }),
);

route("GET", "/notifications/unread-count", (ctx) => ({ count: myRecipients(ctx).filter((r) => !r.read_at).length }));

route("POST", "/notifications/read-all", (ctx) => {
  const unread = myRecipients(ctx).filter((r) => !r.read_at);
  const stamp = nowIso();
  unread.forEach((r) => patch("notificationRecipients", r.id, { read_at: stamp }));
  return { updated: unread.length };
});

/* ---------- notifications: sent by the centre ---------- */

const SEND_ROLES = ["owner", "admin", "teacher"];

function sentScope(ctx) {
  if (!SEND_ROLES.includes(ctx.role)) throw forbidden();
  const rows = inTenant(ctx, "notifications");
  return isTeacher(ctx) ? rows.filter((n) => n.created_by === ctx.user?.id) : rows;
}

route("GET", "/notifications/sent", (ctx) => listResponse(sentScope(ctx).map((n) => sentOut(n)), ctx, { ordering: "-created_at" }));

route("GET", "/notifications/sent/:id", (ctx) => {
  const n = sentScope(ctx).find((row) => row.id === ctx.params.id);
  if (!n) throw notFound();
  return sentOut(n, { detail: true });
});

route("POST", "/notifications/send", (ctx) => {
  if (!SEND_ROLES.includes(ctx.role)) throw forbidden();
  const body = ctx.body || {};
  if (!String(body.title || "").trim()) throw invalid({ title: ["Обязательное поле."] });
  if (!String(body.message || "").trim()) throw invalid({ message: ["Обязательное поле."] });
  const type = body.recipient_type;
  const enrollments = inTenant(ctx, "enrollments").filter((e) => e.status === "active");
  let studentIds = [];
  if (type === "all_students") {
    studentIds = inTenant(ctx, "students").filter((s) => s.status === "active").map((s) => s.id);
  } else if (type === "group") {
    if (isTeacher(ctx) && !teacherGroupIds(ctx).has(body.group_id)) throw forbidden("You can only notify your own groups.");
    studentIds = enrollments.filter((e) => e.group === body.group_id).map((e) => e.student);
  } else if (type === "course") {
    if (isTeacher(ctx)) throw forbidden("Teachers can only notify their groups or students.");
    const groups = new Set(inTenant(ctx, "groups").filter((g) => g.course === body.course_id).map((g) => g.id));
    studentIds = enrollments.filter((e) => groups.has(e.group)).map((e) => e.student);
  } else if (type === "students" || type === "student") {
    studentIds = (body.student_ids || []).map(String);
  } else {
    throw invalid({ recipient_type: ["Выберите получателей."] });
  }
  studentIds = [...new Set(studentIds)];
  if (!studentIds.length) throw invalid({ detail: "Нет получателей." });
  const notification = insert("notifications", {
    tenant: ctx.tenantId, title: body.title, message: body.message, category: body.category || "announcement", priority: body.priority || "normal",
    recipient_type: type, send_push: Boolean(body.send_push), created_by: ctx.user?.id || null, group: body.group_id || null,
    course: body.course_id || null, metadata: { route: body.category || "announcement", ...(body.metadata || {}) },
  });
  const stamp = nowIso();
  studentIds.forEach((studentId) => {
    insert("notificationRecipients", {
      tenant: ctx.tenantId, notification: notification.id, student: studentId, read_at: null, delivered_at: stamp,
      push_sent_at: body.send_push ? stamp : null, push_failed_at: null, push_error: "",
    });
  });
  return { status: 201, data: sentOut(notification) };
});

route("POST", "/notifications/:id/read", (ctx) => {
  const recipient = myRecipients(ctx).find((r) => r.notification === ctx.params.id);
  if (!recipient) throw notFound();
  return inboxOut(recipient.read_at ? recipient : patch("notificationRecipients", recipient.id, { read_at: nowIso() }));
});

crud("/notification-outbox", { tableName: "outbox", readOnly: true, ordering: "-created_at", out: outboxOut, scope: (ctx) => (isStudent(ctx) ? [] : inTenant(ctx, "outbox")) });
route("GET", "/notification-templates", (ctx) => listResponse([], ctx));
route("GET", "/notification-contacts", (ctx) => listResponse([], ctx));
route("GET", "/notifications/devices", (ctx) => listResponse([], ctx));
route("POST", "/notifications/devices", (ctx) => ({ status: 201, data: { id: "demo-device", token: ctx.body?.token || "", platform: ctx.body?.platform || "android", is_active: true, created_at: nowIso(), updated_at: nowIso() } }));

/* ---------- tenant settings ---------- */

const SETTINGS_FIELDS = [
  "name", "short_name", "description", "timezone", "currency", "language", "primary_color", "secondary_color", "contact_phone",
  "contact_phone_secondary", "contact_email", "telegram", "website", "legal_name", "legal_address", "city", "stir", "director_name",
  "contract_number", "contract_signed_on",
];

function activeTenant(ctx) {
  const tenant = findById("tenants", ctx.tenantId);
  if (!tenant) throw notFound();
  return tenant;
}

route("GET", "/tenant/settings", (ctx) => {
  if (isStudent(ctx)) throw forbidden();
  return tenantSettingsOut(activeTenant(ctx));
});

route("PATCH", "/tenant/settings", (ctx) => {
  if (!["owner", "admin"].includes(ctx.role)) throw forbidden();
  const tenant = activeTenant(ctx);
  const body = ctx.body || {};
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => SETTINGS_FIELDS.includes(key)));
  ["primary_color", "secondary_color"].forEach((key) => {
    if (changes[key] && !/^#[0-9a-f]{6}$/i.test(changes[key])) throw invalid({ [key]: ["Цвет должен быть в формате #RRGGBB."] });
    if (changes[key]) changes[key] = changes[key].toLowerCase();
  });
  if (body.center_settings) {
    const patchValue = typeof body.center_settings === "string" ? JSON.parse(body.center_settings) : body.center_settings;
    changes.center_settings = mergeCenterSettings(tenant.center_settings, patchValue);
  }
  if (body.logo && typeof body.logo === "object") changes.logo_url = body.logo.url;
  if (body.logo === "" || body.remove_logo) changes.logo_url = null;
  return tenantSettingsOut(patch("tenants", tenant.id, changes));
});

route("POST", "/tenant/settings/reset-branding", (ctx) => {
  if (!["owner", "admin"].includes(ctx.role)) throw forbidden();
  return tenantSettingsOut(patch("tenants", activeTenant(ctx).id, { primary_color: "#0b3a8a", secondary_color: "#00bfa5", logo_url: null }));
});

route("GET", "/tenant/access", (ctx) => {
  const tenant = activeTenant(ctx);
  return { license_status: licenseStatus(tenant), includes_crm: tenant.includes_crm, includes_app: tenant.includes_app, licensed_until: tenant.licensed_until };
});

/* ---------- dashboards ---------- */

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000 - 1);
  return [start.toISOString(), end.toISOString()];
}

route("GET", "/dashboard/summary", (ctx) => {
  if (!["owner", "admin", "accountant"].includes(ctx.role)) throw forbidden();
  const leads = inTenant(ctx, "leads");
  const converted = leads.filter((l) => l.converted_student).length;
  const [from, to] = dayBounds();
  const now = new Date().toISOString();
  const overdue = inTenant(ctx, "invoices").filter((i) => i.due_at && i.due_at < now && !["paid", "void"].includes(i.status));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const collected = inTenant(ctx, "payments")
    .filter((p) => p.status === "succeeded" && p.paid_at >= monthStart.toISOString())
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    leads: {
      total: leads.length,
      converted,
      conversion_rate: leads.length ? Math.round((converted / leads.length) * 10000) / 100 : 0,
      by_stage: [...inTenant(ctx, "leadStages")]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, name: s.name, count: leads.filter((l) => l.stage === s.id).length })),
    },
    active_students: inTenant(ctx, "students").filter((s) => s.status === "active").length,
    lessons_today: inTenant(ctx, "lessons").filter((l) => l.starts_at >= from && l.starts_at <= to).length,
    overdue_invoices: overdue.length,
    overdue_total: money(overdue.reduce((sum, i) => sum + Number(i.amount) - Number(i.paid_amount), 0)),
    collected_this_month: money(collected),
    currency: activeTenant(ctx).currency,
  };
});

route("GET", "/teacher/dashboard", (ctx) => {
  if (!isTeacher(ctx)) throw forbidden();
  const groups = inTenant(ctx, "groups").filter((g) => g.teacher === ctx.membership.id && g.status === "active");
  const groupIds = new Set(groups.map((g) => g.id));
  const [from, to] = dayBounds();
  const today = inTenant(ctx, "lessons").filter((l) => l.teacher === ctx.membership.id && l.starts_at >= from && l.starts_at <= to && l.status === "scheduled");
  const enrollments = inTenant(ctx, "enrollments").filter((e) => groupIds.has(e.group) && e.status === "active");
  const todayGroups = new Set(today.map((l) => l.group));
  const attendance = inTenant(ctx, "attendance");
  const unmarked = today.filter((lesson) => {
    const expected = enrollments.filter((e) => e.group === lesson.group).length;
    const marked = attendance.filter((a) => a.lesson === lesson.id).length;
    return expected > 0 && marked < expected;
  }).length;
  const myLessons = new Set(inTenant(ctx, "lessons").filter((l) => l.teacher === ctx.membership.id && groupIds.has(l.group)).map((l) => l.id));
  const marks = attendance.filter((a) => myLessons.has(a.lesson));
  const present = marks.filter((a) => ["present", "late", "excused"].includes(a.status)).length;
  const homeworks = new Set(inTenant(ctx, "homeworks").filter((h) => groupIds.has(h.group)).map((h) => h.id));
  return {
    lessons_today: today.length,
    students_today: new Set(enrollments.filter((e) => todayGroups.has(e.group)).map((e) => e.student)).size,
    pending_reviews: inTenant(ctx, "submissions").filter((s) => homeworks.has(s.homework) && ["submitted", "late"].includes(s.status)).length,
    unmarked_attendance: unmarked,
    avg_attendance_pct: marks.length ? Math.round((present / marks.length) * 1000) / 10 : null,
    groups_count: groups.length,
    students_count: new Set(enrollments.map((e) => e.student)).size,
  };
});

/* ---------- platform (super admin) ---------- */

function requireSuper(ctx) {
  if (!ctx.user) throw new MockHttpError(401, { detail: "Требуется авторизация." });
  if (!ctx.user.is_superuser) throw forbidden();
}

const truthy = (value) => value === true || value === "true" || value === "1" || value === "on";

route("GET", "/platform/students/summary", (ctx) => {
  requireSuper(ctx);
  const tenantId = ctx.query.get("tenant");
  const students = table("students").filter((s) => !tenantId || s.tenant === tenantId);
  const subs = table("subscriptions");
  const withStatus = (status) => new Set(subs.filter((s) => s.status === status).map((s) => s.student));
  const active = withStatus("active");
  const expired = withStatus("expired");
  return {
    students: students.length,
    active: students.filter((s) => s.status === "active").length,
    inactive: students.filter((s) => s.status === "inactive").length,
    archived: students.filter((s) => s.status === "archived").length,
    with_active_subscription: students.filter((s) => active.has(s.id)).length,
    expired_subscription: students.filter((s) => expired.has(s.id)).length,
  };
});

route("GET", "/platform/students", (ctx) => {
  requireSuper(ctx);
  return listResponse(table("students").map(platformStudentOut), ctx, { search: ["full_name", "phone", "email", "tenant_name"], aliases: { tenant: "tenant_id" }, ordering: "full_name" });
});

route("GET", "/platform/plans", (ctx) => {
  requireSuper(ctx);
  return listResponse(table("platformPlans").map(platformPlanOut), ctx, { ordering: "sort_order" });
});

route("POST", "/platform/plans", (ctx) => {
  requireSuper(ctx);
  const body = ctx.body || {};
  if (!body.code || !body.name) throw invalid({ code: ["Укажите код и название тарифа."] });
  if (table("platformPlans").some((p) => p.code === body.code)) throw invalid({ code: ["Тариф с таким кодом уже есть."] });
  const plan = insert("platformPlans", {
    code: body.code, name: body.name, description: body.description || "", default_monthly_price: money(body.default_monthly_price),
    default_billing_cycle: body.default_billing_cycle || "monthly", duration_days: Number(body.duration_days) || 30, is_trial: truthy(body.is_trial),
    includes_crm: truthy(body.includes_crm), includes_app: truthy(body.includes_app), is_active: body.is_active == null ? true : truthy(body.is_active),
    sort_order: Number(body.sort_order) || table("platformPlans").length + 1,
  });
  return { status: 201, data: platformPlanOut(plan) };
});

function updatePlatformPlan(ctx) {
  requireSuper(ctx);
  const plan = findById("platformPlans", ctx.params.id);
  if (!plan) throw notFound();
  const changes = { ...ctx.body };
  ["is_trial", "includes_crm", "includes_app", "is_active"].forEach((key) => {
    if (key in changes) changes[key] = truthy(changes[key]);
  });
  if ("default_monthly_price" in changes) changes.default_monthly_price = money(changes.default_monthly_price);
  return platformPlanOut(patch("platformPlans", plan.id, changes));
}
route("PATCH", "/platform/plans/:id", updatePlatformPlan);
route("PUT", "/platform/plans/:id", updatePlatformPlan);

const TENANT_FIELDS = [
  "name", "slug", "legal_name", "legal_address", "city", "contact_phone", "stir", "director_name", "plan", "billing_cycle",
  "monthly_price", "licensed_until", "licensed_from", "includes_crm", "includes_app", "contract_number", "contract_signed_on", "notes", "is_active",
];
const DOC_KINDS = { contract_file: "contract", license_file: "license", passport_file: "passport", other_file: "other" };

function tenantChanges(body) {
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => TENANT_FIELDS.includes(key)));
  ["includes_crm", "includes_app", "is_active"].forEach((key) => {
    if (key in changes) changes[key] = truthy(changes[key]);
  });
  if ("monthly_price" in changes) changes.monthly_price = money(changes.monthly_price);
  if (changes.licensed_until === "") changes.licensed_until = null;
  return changes;
}

function saveDocuments(tenantId, body) {
  Object.entries(DOC_KINDS).forEach(([field, kind]) => {
    const file = body[field];
    if (file && typeof file === "object") {
      insert("tenantDocuments", { tenant: tenantId, kind, title: file.name, original_name: file.name, file_url: file.url });
    }
  });
  let ids = body.delete_document_ids || [];
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = [];
    }
  }
  ids.forEach((docId) => remove("tenantDocuments", docId));
}

const TRANSLIT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };

function slugify(name) {
  const base =
    String(name || "center")
      .toLowerCase()
      .split("")
      .map((ch) => TRANSLIT[ch] ?? ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "center";
  let slug = base;
  let n = 2;
  while (table("tenants").some((t) => t.slug === slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

route("GET", "/platform/tenants", (ctx) => {
  requireSuper(ctx);
  return listResponse(table("tenants").map(platformTenantOut), ctx, { search: ["name", "city", "slug", "legal_name"], ordering: "-created_at" });
});

route("GET", "/platform/tenants/:id", (ctx) => {
  requireSuper(ctx);
  const tenant = findById("tenants", ctx.params.id);
  if (!tenant) throw notFound();
  return platformTenantOut(tenant);
});

route("POST", "/platform/tenants", (ctx) => {
  requireSuper(ctx);
  const body = ctx.body || {};
  if (!String(body.name || "").trim()) throw invalid({ name: ["Укажите название центра."] });
  const plan = table("platformPlans").find((p) => p.code === (body.plan || "trial"));
  const today = new Date().toISOString().slice(0, 10);
  const until = body.licensed_until || new Date(Date.now() + (plan?.duration_days || 30) * 86400000).toISOString().slice(0, 10);
  const tenant = insert("tenants", {
    short_name: body.name, description: "", timezone: "Asia/Tashkent", currency: "UZS", language: "ru", is_active: true,
    plan: plan?.code || "trial", billing_cycle: "monthly", monthly_price: plan?.default_monthly_price || "0.00", licensed_from: today,
    includes_crm: true, includes_app: true, contact_phone_secondary: "", contact_email: "", telegram: "", website: "", logo_url: null,
    primary_color: "#0b3a8a", secondary_color: "#00bfa5", center_settings: JSON.parse(JSON.stringify(DEFAULT_CENTER_SETTINGS)),
    ...tenantChanges(body), slug: slugify(body.slug || body.name), licensed_until: until,
  });
  const owner = insert("users", {
    email: String(body.owner_email || "").trim().toLowerCase(), phone: body.owner_phone || null, first_name: body.owner_first_name || "",
    last_name: body.owner_last_name || "", avatar: "", photo_url: null, is_superuser: false,
  });
  insert("memberships", {
    tenant: tenant.id, user: owner.id, role: "owner", is_active: true, position: "Владелец", hired_on: today, payment_type: "fixed",
    salary_rate: "0.00", salary_paid_month: "0.00", last_payout_at: null, last_payout_amount: null,
  });
  saveDocuments(tenant.id, body);
  return { status: 201, data: { ...platformTenantOut(tenant), owner_password: body.owner_password || "DemoOwner2026" } };
});

function updatePlatformTenant(ctx) {
  requireSuper(ctx);
  const tenant = findById("tenants", ctx.params.id);
  if (!tenant) throw notFound();
  const body = ctx.body || {};
  const changes = tenantChanges(body);
  if (changes.slug && changes.slug !== tenant.slug) changes.slug = slugify(changes.slug);
  saveDocuments(tenant.id, body);
  return platformTenantOut(patch("tenants", tenant.id, changes));
}
route("PATCH", "/platform/tenants/:id", updatePlatformTenant);
route("PUT", "/platform/tenants/:id", updatePlatformTenant);
