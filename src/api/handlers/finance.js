/* Billing (plans, subscriptions, invoices, payments), staff and payroll. */
import { findById, insert, nowIso, patch, table } from "../db";
import { forbidden, invalid, listResponse, money, notFound } from "../http";
import { crud, inTenant, route } from "../router";
import { canSeePayroll, isStudent } from "../context";
import { invoiceOut, paymentOut, planOut, salaryOut, staffOut, subscriptionOut } from "../serializers";

const BILLING_WRITE = ["owner", "admin", "accountant"];
const MANAGERS = ["owner", "admin"];

const ownInvoices = (ctx) => {
  const rows = inTenant(ctx, "invoices");
  return isStudent(ctx) ? rows.filter((i) => i.student === ctx.student?.id) : rows;
};

crud("/plans", {
  tableName: "plans",
  writeRoles: BILLING_WRITE,
  out: planOut,
  scope: (ctx) => inTenant(ctx, "plans"),
  create: (ctx, body) => {
    if (body.billing_type === "lessons" && !Number(body.lesson_limit)) throw invalid({ lesson_limit: ["Lesson packages require a positive lesson limit."] });
    return insert("plans", {
      tenant: ctx.tenantId, name: body.name || "Тариф", billing_type: body.billing_type || "monthly", price: money(body.price), currency: "UZS",
      lesson_limit: body.lesson_limit ? Number(body.lesson_limit) : null, duration_days: Number(body.duration_days) || 30, is_active: body.is_active ?? true,
    });
  },
});

crud("/subscriptions", {
  tableName: "subscriptions",
  writeRoles: BILLING_WRITE,
  noDelete: true,
  out: subscriptionOut,
  ordering: "-created_at",
  scope: (ctx) => {
    const rows = inTenant(ctx, "subscriptions");
    return isStudent(ctx) ? rows.filter((s) => s.student === ctx.student?.id) : rows;
  },
  create: (ctx, body) => {
    const plan = findById("plans", body.plan);
    if (!plan) throw invalid({ plan: ["Выберите тариф."] });
    const starts = body.starts_on || nowIso().slice(0, 10);
    const ends = new Date(`${starts}T12:00:00`);
    ends.setDate(ends.getDate() + (plan.duration_days || 30));
    return insert("subscriptions", {
      tenant: ctx.tenantId, student: body.student, plan: plan.id, starts_on: starts, ends_on: ends.toISOString().slice(0, 10),
      total_lessons: plan.lesson_limit, used_lessons: 0, status: "active",
    });
  },
});

crud("/invoices", {
  tableName: "invoices",
  writeRoles: BILLING_WRITE,
  noDelete: true,
  search: ["number"],
  ordering: "-created_at",
  out: invoiceOut,
  scope: ownInvoices,
  create: (ctx, body) => {
    if (!body.student) throw invalid({ student: ["Выберите ученика."] });
    if (!(Number(body.amount) > 0)) throw invalid({ amount: ["Сумма должна быть больше нуля."] });
    const count = inTenant(ctx, "invoices").length + 1;
    return insert("invoices", {
      tenant: ctx.tenantId, number: `INV-${new Date().getFullYear()}-${String(count).padStart(5, "0")}`, student: body.student,
      subscription: body.subscription || null, amount: money(body.amount), paid_amount: "0.00", currency: "UZS",
      due_at: body.due_at || null, status: "issued", description: body.description || "",
    });
  },
});

crud("/payments", {
  tableName: "payments",
  writeRoles: BILLING_WRITE,
  noDelete: true,
  ordering: "-paid_at",
  out: paymentOut,
  scope: (ctx) => {
    const invoices = new Set(ownInvoices(ctx).map((i) => i.id));
    return inTenant(ctx, "payments").filter((p) => invoices.has(p.invoice));
  },
  create: (ctx, body) => {
    const invoice = inTenant(ctx, "invoices").find((i) => i.id === body.invoice);
    if (!invoice) throw invalid({ invoice: ["Счёт не найден."] });
    const amount = Number(body.amount);
    if (!(amount > 0)) throw invalid({ amount: ["Сумма должна быть больше нуля."] });
    const balance = Number(invoice.amount) - Number(invoice.paid_amount);
    if (amount > balance + 0.009) throw invalid({ amount: [`Сумма больше долга по счёту (${money(balance)}).`] });
    const paidTotal = Number(invoice.paid_amount) + amount;
    patch("invoices", invoice.id, {
      paid_amount: money(paidTotal),
      status: paidTotal >= Number(invoice.amount) - 0.009 ? "paid" : "partially_paid",
    });
    return insert("payments", {
      tenant: ctx.tenantId, invoice: invoice.id, amount: money(amount), method: body.method || "cash", status: "succeeded",
      external_id: "", idempotency_key: body.idempotency_key || "", paid_at: body.paid_at || nowIso(), note: body.note || "",
    });
  },
});

route("GET", "/lesson-credits", (ctx) => listResponse([], ctx));

/* ---------- staff ---------- */

function staffScope(ctx) {
  if (isStudent(ctx)) return [];
  return inTenant(ctx, "memberships").filter((m) => m.role !== "student");
}

route("GET", "/staff", (ctx) => listResponse(staffScope(ctx).map((m) => staffOut(m, ctx)), ctx, { ordering: "created_at" }));

route("GET", "/staff/:id", (ctx) => {
  const m = staffScope(ctx).find((row) => row.id === ctx.params.id);
  if (!m) throw notFound();
  return staffOut(m, ctx);
});

route("POST", "/staff", (ctx) => {
  if (!MANAGERS.includes(ctx.role)) throw forbidden();
  const body = ctx.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").replace(/[^\d+]/g, "");
  if (!email && !phone) throw invalid({ non_field_errors: ["Email or phone is required."] });
  if (!body.role || body.role === "student") throw invalid({ role: ["Выберите роль."] });
  if (email && table("users").some((u) => u.email === email)) throw invalid({ email: ["Этот email уже используется."] });
  const user = insert("users", {
    email, phone: phone || null, first_name: body.first_name || "", last_name: body.last_name || "", avatar: "", photo_url: null, is_superuser: false,
  });
  const membership = insert("memberships", {
    tenant: ctx.tenantId, user: user.id, role: body.role, is_active: true, position: body.position || "", hired_on: body.hired_on || null,
    payment_type: body.payment_type || "fixed", salary_rate: money(body.salary_rate), salary_paid_month: "0.00", last_payout_at: null, last_payout_amount: null,
  });
  return { status: 201, data: staffOut(membership, ctx) };
});

function updateStaff(ctx) {
  const m = staffScope(ctx).find((row) => row.id === ctx.params.id);
  if (!m) throw notFound();
  const self = m.id === ctx.membership?.id;
  if (!MANAGERS.includes(ctx.role) && !canSeePayroll(ctx) && !self) throw forbidden();
  const body = ctx.body || {};
  if (self && ((body.role && body.role !== m.role) || (body.is_active === false && m.is_active))) {
    throw invalid({ role: ["Нельзя менять собственную роль или статус."] });
  }
  if (body.role === "student") throw invalid({ role: ["Сотрудника нельзя сделать учеником."] });
  const allowed = ["role", "is_active", "position", "hired_on", "payment_type", "salary_rate", "salary_paid_month", "last_payout_at", "last_payout_amount"];
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  const userFields = Object.fromEntries(Object.entries(body).filter(([key]) => ["first_name", "last_name", "email", "phone"].includes(key)));
  if (Object.keys(userFields).length) patch("users", m.user, userFields);
  return staffOut(patch("memberships", m.id, changes), ctx);
}
route("PATCH", "/staff/:id", updateStaff);
route("PUT", "/staff/:id", updateStaff);

route("DELETE", "/staff/:id", (ctx) => {
  if (!MANAGERS.includes(ctx.role)) throw forbidden();
  const m = staffScope(ctx).find((row) => row.id === ctx.params.id);
  if (!m) throw notFound();
  if (m.id === ctx.membership?.id) throw invalid({ detail: "Нельзя удалить самого себя." });
  patch("memberships", m.id, { is_active: false });
  return { status: 204, data: null };
});

/* ---------- payroll ---------- */

function syncPayout(record) {
  if (record.status !== "paid") return;
  patch("memberships", record.membership, {
    last_payout_at: record.paid_at || nowIso().slice(0, 10),
    last_payout_amount: record.paid_amount,
  });
}

crud("/salary-records", {
  tableName: "salaryRecords",
  writeRoles: ["owner", "accountant"],
  ordering: "-period",
  out: salaryOut,
  scope: (ctx) => (canSeePayroll(ctx) ? inTenant(ctx, "salaryRecords") : []),
  create: (ctx, body) => {
    if (!body.membership) throw invalid({ membership: ["Выберите сотрудника."] });
    const period = `${String(body.period || nowIso().slice(0, 7)).slice(0, 7)}-01`;
    const paid = Number(body.paid_amount || 0);
    const fields = {
      accrued_amount: money(body.accrued_amount), paid_amount: money(paid), paid_at: body.paid_at || (paid > 0 ? nowIso().slice(0, 10) : null),
      status: body.status || (paid > 0 ? "paid" : "unpaid"), notes: body.notes || "",
    };
    const existing = inTenant(ctx, "salaryRecords").find((r) => r.membership === body.membership && r.period === period);
    const record = existing ? patch("salaryRecords", existing.id, fields) : insert("salaryRecords", { tenant: ctx.tenantId, membership: body.membership, period, ...fields });
    syncPayout(record);
    return record;
  },
  update: (ctx, row, body) => {
    const record = patch("salaryRecords", row.id, body);
    syncPayout(record);
    return record;
  },
});
