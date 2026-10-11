/* CRM: lead stages, tags, leads, lead activities and lead → student conversion. */
import { findById, insert, nowIso, patch, remove, table } from "../db";
import { forbidden, invalid, notFound } from "../http";
import { crud, inTenant, route } from "../router";
import { activityOut, leadOut, stageOut, studentOut, tagOut } from "../serializers";

const MANAGERS = ["owner", "admin"];

route("DELETE", "/lead-stages/:id", (ctx) => {
  if (!MANAGERS.includes(ctx.role)) throw forbidden();
  const stage = inTenant(ctx, "leadStages").find((s) => s.id === ctx.params.id);
  if (!stage) throw notFound();
  const moveTo = ctx.query.get("move_to");
  const leads = inTenant(ctx, "leads").filter((l) => l.stage === stage.id);
  if (leads.length && !moveTo) throw invalid({ detail: "На этапе есть лиды: укажите, куда их перенести." });
  leads.forEach((lead) => patch("leads", lead.id, { stage: moveTo }));
  remove("leadStages", stage.id);
  return { status: 204, data: null };
});

crud("/lead-stages", {
  tableName: "leadStages",
  writeRoles: MANAGERS,
  ordering: "position",
  out: stageOut,
  scope: (ctx) => inTenant(ctx, "leadStages"),
  create: (ctx, body) => {
    const position = body.position ?? inTenant(ctx, "leadStages").length + 1;
    return insert("leadStages", { tenant: ctx.tenantId, name: body.name || "Новый этап", position, is_won: Boolean(body.is_won), is_lost: Boolean(body.is_lost) });
  },
});

crud("/tags", {
  tableName: "tags",
  writeRoles: MANAGERS,
  out: tagOut,
  scope: (ctx) => inTenant(ctx, "tags"),
  create: (ctx, body) => insert("tags", { tenant: ctx.tenantId, name: body.name || "", color: body.color || "#2d6bea" }),
});

function leadScope(ctx) {
  return MANAGERS.includes(ctx.role) ? inTenant(ctx, "leads") : [];
}

route("GET", "/leads/:id/activities", (ctx) => {
  const lead = leadScope(ctx).find((l) => l.id === ctx.params.id);
  if (!lead) throw notFound();
  return inTenant(ctx, "leadActivities")
    .filter((a) => a.lead === lead.id)
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
    .map(activityOut);
});

route("POST", "/leads/:id/activities", (ctx) => {
  const lead = leadScope(ctx).find((l) => l.id === ctx.params.id);
  if (!lead) throw notFound();
  const body = ctx.body || {};
  if (!String(body.content || "").trim()) throw invalid({ content: ["Обязательное поле."] });
  const activity = insert("leadActivities", {
    tenant: ctx.tenantId, lead: lead.id, kind: body.kind || "note", content: body.content,
    occurred_at: body.occurred_at || nowIso(), created_by: ctx.user?.id || null,
  });
  patch("leads", lead.id, {});
  return { status: 201, data: activityOut(activity) };
});

route("POST", "/leads/:id/convert", (ctx) => {
  const lead = leadScope(ctx).find((l) => l.id === ctx.params.id);
  if (!lead) throw notFound();
  if (lead.converted_student) {
    const existing = findById("students", lead.converted_student);
    if (existing) return { status: 201, data: studentOut(existing) };
  }
  const groupId = ctx.body?.group_id;
  if (groupId && !findById("groups", groupId)) throw invalid({ group_id: ["Group not found."] });
  const digits = String(lead.phone || "").replace(/\D/g, "");
  const student = insert("students", {
    tenant: ctx.tenantId, full_name: lead.full_name, birth_date: null, phone: digits ? `+${digits}` : "", email: lead.email || "",
    status: "active", notes: lead.notes || "", user: null,
  });
  if (groupId) {
    insert("enrollments", { tenant: ctx.tenantId, student: student.id, group: groupId, status: "active", joined_at: nowIso().slice(0, 10), ended_at: null });
  }
  const won = inTenant(ctx, "leadStages").find((s) => s.is_won);
  patch("leads", lead.id, { converted_student: student.id, stage: won ? won.id : lead.stage, next_follow_up_at: null });
  insert("leadActivities", { tenant: ctx.tenantId, lead: lead.id, kind: "stage_change", content: "Лид переведён в ученики", occurred_at: nowIso(), created_by: ctx.user?.id || null });
  return { status: 201, data: { ...studentOut(student), temporary_password: `Yg-${Math.floor(100000 + Math.random() * 900000)}` } };
});

crud("/leads", {
  tableName: "leads",
  writeRoles: MANAGERS,
  search: ["full_name", "phone", "email"],
  ordering: "-created_at",
  out: leadOut,
  scope: leadScope,
  create: (ctx, body) => {
    if (!String(body.full_name || "").trim()) throw invalid({ full_name: ["Обязательное поле."] });
    const stages = [...inTenant(ctx, "leadStages")].sort((a, b) => a.position - b.position);
    return insert("leads", {
      tenant: ctx.tenantId, full_name: body.full_name, phone: body.phone || "", email: body.email || "", source: body.source || "manual",
      source_details: body.source_details || "", stage: body.stage || stages[0]?.id || null, assigned_to: body.assigned_to || ctx.membership?.id || null,
      tags: body.tags || [], notes: body.notes || "", next_follow_up_at: body.next_follow_up_at || null, lost_reason: body.lost_reason || "",
      converted_student: null,
    });
  },
  destroy: (ctx, row) => {
    table("leadActivities")
      .filter((a) => a.lead === row.id)
      .forEach((a) => remove("leadActivities", a.id));
    remove("leads", row.id);
  },
});
