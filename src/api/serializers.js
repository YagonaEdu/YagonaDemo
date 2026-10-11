/* Stored rows → API payloads, field-for-field like the Django REST serializers. */
import { findById, table } from "./db";
import { canSeePayroll, isStudent } from "./context";
import { money } from "./http";

export const UPLOAD_RULES = {
  max_files: 10,
  max_file_size: 20 * 1024 * 1024,
  extensions: [".doc", ".docx", ".jpeg", ".jpg", ".m4a", ".mp3", ".ogg", ".pdf", ".png", ".txt", ".webm", ".zip"],
};

const fullName = (user) => (user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "");

export function userOut(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    phone: user.phone || null,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    name: fullName(user),
    avatar: user.avatar || "",
    photo_url: user.photo_url || null,
    is_superuser: Boolean(user.is_superuser),
  };
}

export function membershipOut(m) {
  const tenant = findById("tenants", m.tenant);
  return { id: m.id, tenant_id: m.tenant, tenant_name: tenant?.name || "", tenant_slug: tenant?.slug || "", role: m.role, position: m.position || "" };
}

export function staffOut(m, ctx) {
  const data = {
    id: m.id,
    role: m.role,
    is_active: m.is_active,
    user: userOut(findById("users", m.user)),
    position: m.position || "",
    hired_on: m.hired_on,
    payment_type: m.payment_type || "",
    salary_rate: m.salary_rate || "0.00",
    salary_paid_month: m.salary_paid_month || "0.00",
    last_payout_at: m.last_payout_at,
    last_payout_amount: m.last_payout_amount,
    created_at: m.created_at,
  };
  if (!canSeePayroll(ctx)) {
    ["payment_type", "salary_rate", "salary_paid_month", "last_payout_at", "last_payout_amount"].forEach((key) => delete data[key]);
  }
  return data;
}

export function teacherName(membershipId) {
  const m = findById("memberships", membershipId);
  return m ? fullName(findById("users", m.user)) : "";
}

export const courseOut = (c) => ({
  id: c.id, name: c.name, description: c.description || "", price: c.price, currency: c.currency || "UZS",
  is_active: c.is_active, created_at: c.created_at, updated_at: c.updated_at,
});

export const roomOut = (r) => ({ id: r.id, name: r.name, capacity: r.capacity, is_active: r.is_active });

export function groupOut(g) {
  return {
    id: g.id, course: g.course, name: g.name, teacher: g.teacher, capacity: g.capacity,
    active_students: table("enrollments").filter((e) => e.group === g.id && e.status === "active").length,
    start_date: g.start_date, end_date: g.end_date, status: g.status, created_at: g.created_at, updated_at: g.updated_at,
  };
}

export const enrollmentOut = (e) => ({
  id: e.id, student: e.student, group: e.group, status: e.status, joined_at: e.joined_at, ended_at: e.ended_at, created_at: e.created_at,
});

export function studentOut(s) {
  const data = {
    id: s.id, full_name: s.full_name, birth_date: s.birth_date, phone: s.phone, email: s.email || "", status: s.status,
    notes: s.notes || "", created_at: s.created_at, updated_at: s.updated_at,
  };
  if (s.temporary_password) data.temporary_password = s.temporary_password;
  return data;
}

export const guardianOut = (g) => ({ id: g.id, full_name: g.full_name, phone: g.phone, email: g.email || "", created_at: g.created_at, updated_at: g.updated_at });
export const studentGuardianOut = (l) => ({ id: l.id, student: l.student, guardian: l.guardian, relationship: l.relationship || "", is_primary: Boolean(l.is_primary) });

export function lessonOut(l) {
  const group = findById("groups", l.group);
  const course = group ? findById("courses", group.course) : null;
  const room = l.room ? findById("rooms", l.room) : null;
  return {
    id: l.id, group: l.group, group_name: group?.name || "", course: course?.id || null, course_name: course?.name || "",
    teacher: l.teacher, teacher_name: teacherName(l.teacher), room: l.room, room_name: room?.name || null,
    schedule_rule: l.schedule_rule || null, starts_at: l.starts_at, ends_at: l.ends_at, topic: l.topic || "", status: l.status,
    created_at: l.created_at, updated_at: l.updated_at,
  };
}

export const attendanceOut = (a) => ({
  id: a.id, student: a.student, status: a.status, comment: a.comment || "", marked_by: a.marked_by, created_at: a.created_at, updated_at: a.updated_at,
});

export function attendanceHistoryOut(a) {
  const lesson = findById("lessons", a.lesson);
  const group = lesson ? findById("groups", lesson.group) : null;
  const course = group ? findById("courses", group.course) : null;
  return {
    id: a.id, lesson: a.lesson, student: a.student, status: a.status, comment: a.comment || "",
    lesson_starts_at: lesson?.starts_at || null, lesson_status: lesson?.status || "", lesson_topic: lesson?.topic || "",
    group: group?.id || null, group_name: group?.name || "", course: course?.id || null, course_name: course?.name || "",
    created_at: a.created_at, updated_at: a.updated_at,
  };
}

export const planOut = (p) => ({
  id: p.id, name: p.name, billing_type: p.billing_type, price: p.price, currency: p.currency, lesson_limit: p.lesson_limit,
  duration_days: p.duration_days, is_active: p.is_active,
});

export const subscriptionOut = (s) => ({
  id: s.id, student: s.student, plan: s.plan, starts_on: s.starts_on, ends_on: s.ends_on, total_lessons: s.total_lessons,
  remaining_lessons: s.total_lessons == null ? null : Math.max(0, s.total_lessons - (s.used_lessons || 0)),
  status: s.status, created_at: s.created_at,
});

export const invoiceOut = (i) => ({
  id: i.id, number: i.number, student: i.student, subscription: i.subscription, amount: i.amount, paid_amount: i.paid_amount,
  balance: money(Number(i.amount) - Number(i.paid_amount)), currency: i.currency, due_at: i.due_at, status: i.status,
  description: i.description || "", created_at: i.created_at, updated_at: i.updated_at,
});

export const paymentOut = (p) => ({
  id: p.id, invoice: p.invoice, amount: p.amount, method: p.method, status: p.status, external_id: p.external_id || "",
  idempotency_key: p.idempotency_key || "", paid_at: p.paid_at, note: p.note || "", created_at: p.created_at,
});

export const stageOut = (s) => ({ id: s.id, name: s.name, position: s.position, is_won: s.is_won, is_lost: s.is_lost });
export const tagOut = (t) => ({ id: t.id, name: t.name, color: t.color });

export const leadOut = (l) => ({
  id: l.id, full_name: l.full_name, phone: l.phone || "", email: l.email || "", source: l.source, source_details: l.source_details || "",
  stage: l.stage, assigned_to: l.assigned_to, tags: l.tags || [], notes: l.notes || "", next_follow_up_at: l.next_follow_up_at,
  lost_reason: l.lost_reason || "", converted_student: l.converted_student, created_at: l.created_at, updated_at: l.updated_at,
});

export const activityOut = (a) => ({ id: a.id, kind: a.kind, content: a.content, occurred_at: a.occurred_at, created_by: a.created_by, created_at: a.created_at });

/* ---------- homework ---------- */

export const deadlinePassed = (hw, now = new Date()) => Boolean(hw.due_at) && new Date(hw.due_at) < now;
const HANDED_IN = ["submitted", "late"];

export function editBlockReason(sub) {
  const hw = findById("homeworks", sub.homework);
  if (sub.status === "graded") return "Работа уже проверена.";
  if (sub.status === "returned") return null;
  if (HANDED_IN.includes(sub.status) && !hw?.allow_resubmit) return "Пересдача для этого задания не разрешена.";
  if (hw && deadlinePassed(hw) && !hw.allow_late) return "Срок сдачи истёк, сдача после дедлайна не разрешена.";
  return null;
}

export function canSubmit(sub) {
  if (!["draft", "returned"].includes(sub.status)) return false;
  if (editBlockReason(sub)) return false;
  return Boolean(String(sub.text || "").trim() || sub.link || (sub.files || []).length);
}

const fileOut = (f) => ({ id: f.id, original_name: f.original_name, size: f.size, content_type: f.content_type || "", download_url: f.download_url || null, created_at: f.created_at });

export function submissionOut(sub) {
  const hw = findById("homeworks", sub.homework);
  const student = findById("students", sub.student);
  return {
    id: sub.id, homework: sub.homework, homework_title: hw?.title || "", homework_due_at: hw?.due_at || null, max_score: hw?.max_score ?? null,
    student: sub.student, student_name: student?.full_name || "", status: sub.status, text: sub.text || "", link: sub.link || "",
    files: (sub.files || []).map(fileOut), submitted_at: sub.submitted_at, attempt: sub.attempt || 0, score: sub.score ?? null,
    feedback: sub.feedback || "", graded_at: sub.graded_at, can_edit: editBlockReason(sub) === null, can_submit: canSubmit(sub),
    edit_block_reason: editBlockReason(sub), created_at: sub.created_at, updated_at: sub.updated_at,
  };
}

export function homeworkOut(hw, ctx) {
  const group = findById("groups", hw.group);
  const course = group ? findById("courses", group.course) : null;
  const subs = table("submissions").filter((s) => s.homework === hw.id);
  const student = isStudent(ctx);
  const mine = student && ctx.student ? subs.find((s) => s.student === ctx.student.id) : null;
  const handed = subs.filter((s) => s.status !== "draft");
  return {
    id: hw.id, group: hw.group, group_name: group?.name || "", course: course?.id || null, course_name: course?.name || "",
    lesson: hw.lesson, title: hw.title, description: hw.description || "", due_at: hw.due_at, max_score: hw.max_score,
    allow_late: hw.allow_late, allow_resubmit: hw.allow_resubmit, is_published: hw.is_published, published_at: hw.published_at,
    is_overdue: deadlinePassed(hw), attachments: hw.attachments || [], created_by: hw.created_by,
    total_students: student ? null : table("enrollments").filter((e) => e.group === hw.group && e.status === "active").length,
    submitted_count: student ? null : handed.length,
    graded_count: student ? null : handed.filter((s) => s.status === "graded").length,
    returned_count: student ? null : handed.filter((s) => s.status === "returned").length,
    my_submission: mine ? submissionOut(mine) : null,
    upload_rules: UPLOAD_RULES, created_at: hw.created_at, updated_at: hw.updated_at,
  };
}

export const materialOut = (m) => ({
  id: m.id, teacher: m.teacher, group: m.group, course: m.course, title: m.title, description: m.description || "",
  material_type: m.material_type, file: m.file || null, link: m.link || "", text_content: m.text_content || "", topic: m.topic || "",
  level: m.level || "", author: m.author || "", status: m.status, is_published: m.status === "published",
  word_count: m.material_type === "text" ? String(m.text_content || "").split(/\s+/).filter(Boolean).length : null,
  file_size: m.file_size ?? null, created_at: m.created_at, updated_at: m.updated_at,
});

/* ---------- vocabulary ---------- */

export const wordOut = (w) => ({
  id: w.id, list: w.list, term: w.term, translation: w.translation, transcription: w.transcription || "", example: w.example || "",
  part_of_speech: w.part_of_speech || "", order: w.order,
});

export function vocabListOut(list, ctx) {
  const group = list.group ? findById("groups", list.group) : null;
  const course = list.course ? findById("courses", list.course) : null;
  const words = table("vocabWords").filter((w) => w.list === list.id);
  let learned = null;
  if (isStudent(ctx) && ctx.student) {
    const ids = new Set(words.map((w) => w.id));
    learned = table("vocabProgress").filter((p) => p.student === ctx.student.id && ids.has(p.word) && p.box >= 4).length;
  }
  return {
    id: list.id, course: list.course, course_name: course?.name || null, group: list.group, group_name: group?.name || null,
    title: list.title, level: list.level || "", description: list.description || "", is_published: list.is_published,
    word_count: words.length, learned_count: learned, created_by: list.created_by, created_at: list.created_at, updated_at: list.updated_at,
  };
}

export function examState(exam, now = new Date()) {
  if (exam.opens_at && now < new Date(exam.opens_at)) return "upcoming";
  if (exam.closes_at && now > new Date(exam.closes_at)) return "closed";
  return "open";
}

const attemptSummary = (a) => ({
  id: a.id, status: a.status, started_at: a.started_at, deadline_at: a.deadline_at, finished_at: a.finished_at,
  score_percent: a.score_percent, correct_count: a.correct_count, total: a.total,
});

export function vocabExamOut(exam, ctx) {
  const list = findById("vocabLists", exam.list);
  const group = findById("groups", exam.group);
  const course = group ? findById("courses", group.course) : null;
  const student = isStudent(ctx) && ctx.student;
  const mine = student ? table("vocabAttempts").filter((a) => a.exam === exam.id && a.student === ctx.student.id) : null;
  const finished = (mine || []).filter((a) => a.status !== "in_progress");
  const scores = finished.map((a) => a.score_percent).filter((s) => s != null);
  const best = scores.length ? Math.max(...scores) : null;
  const inProgress = (mine || []).find((a) => a.status === "in_progress");
  const state = examState(exam);
  const last = [...finished].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  return {
    id: exam.id, list: exam.list, list_title: list?.title || "", group: exam.group, group_name: group?.name || "", course_name: course?.name || "",
    title: exam.title, mode: exam.mode, direction: exam.direction, questions_count: exam.questions_count,
    word_count: table("vocabWords").filter((w) => w.list === exam.list).length, time_limit_sec: exam.time_limit_sec,
    opens_at: exam.opens_at, closes_at: exam.closes_at, attempts_allowed: exam.attempts_allowed, pass_score: exam.pass_score,
    shuffle: exam.shuffle, is_published: exam.is_published, state,
    attempts_used: mine ? finished.length : null, best_score: best, passed: best == null ? null : best >= exam.pass_score,
    can_start: mine ? Boolean(inProgress) || (state === "open" && (!exam.attempts_allowed || finished.length < exam.attempts_allowed)) : null,
    in_progress_attempt: inProgress ? inProgress.id : null, last_attempt: last ? attemptSummary(last) : null,
    created_by: exam.created_by, created_at: exam.created_at, updated_at: exam.updated_at,
  };
}

export function attemptOut(a, { detail = true } = {}) {
  const exam = findById("vocabExams", a.exam);
  const student = findById("students", a.student);
  const question = (q) => ({ id: q.id, order: q.order, question_type: q.question_type, direction: q.direction, prompt: q.prompt, options: q.options, given_answer: q.given_answer, answered_at: q.answered_at });
  const review = (q) => ({ id: q.id, order: q.order, word: q.word, question_type: q.question_type, direction: q.direction, prompt: q.prompt, options: q.options, given_answer: q.given_answer, expected: q.expected, is_correct: q.is_correct });
  return {
    id: a.id, exam: a.exam, exam_title: exam?.title || "", student: a.student, student_name: student?.full_name || "", status: a.status,
    started_at: a.started_at, deadline_at: a.deadline_at, finished_at: a.finished_at, server_now: new Date().toISOString(),
    score_percent: a.score_percent, correct_count: a.correct_count, total: a.total, pass_score: exam?.pass_score ?? null,
    passed: a.score_percent == null ? null : a.score_percent >= (exam?.pass_score ?? 0),
    questions: detail && a.status === "in_progress" ? (a.answers || []).map(question) : null,
    review: detail && a.status !== "in_progress" ? (a.answers || []).map(review) : null,
  };
}

/* ---------- notifications ---------- */

const ENTITY_KEYS = ["homework_id", "exam_id", "lesson_id", "invoice_id", "material_id"];

export function inboxOut(recipient) {
  const n = findById("notifications", recipient.notification);
  const meta = n?.metadata || {};
  return {
    id: n?.id, title: n?.title || "", message: n?.message || "", category: n?.category || "announcement", priority: n?.priority || "normal",
    created_at: n?.created_at, read: Boolean(recipient.read_at), read_at: recipient.read_at, delivered_at: recipient.delivered_at,
    data: { route: meta.route || n?.category, entity_id: meta.entity_id || ENTITY_KEYS.map((k) => meta[k]).find(Boolean) || null },
  };
}

export function sentOut(n, { detail = false } = {}) {
  const recipients = table("notificationRecipients").filter((r) => r.notification === n.id);
  const sender = findById("users", n.created_by);
  const data = {
    id: n.id, title: n.title, message: n.message, category: n.category, priority: n.priority, recipient_type: n.recipient_type,
    recipients_count: recipients.length, send_push: n.send_push, sender_name: fullName(sender) || "Учебный центр",
    read_count: recipients.filter((r) => r.read_at).length, unread_count: recipients.filter((r) => !r.read_at).length,
    push_sent_count: recipients.filter((r) => r.push_sent_at).length, push_failed_count: recipients.filter((r) => r.push_failed_at).length,
    group: n.group, course: n.course, created_at: n.created_at,
  };
  if (detail) {
    data.metadata = n.metadata || {};
    data.recipients = recipients.slice(0, 200).map((r) => ({
      id: r.id, student_id: r.student, student_name: findById("students", r.student)?.full_name || "", read: Boolean(r.read_at),
      read_at: r.read_at, delivered_at: r.delivered_at, push_sent_at: r.push_sent_at, push_failed_at: r.push_failed_at, push_error: r.push_error || "",
    }));
  }
  return data;
}

export const outboxOut = (o) => ({
  id: o.id, contact: o.contact, template: o.template, rendered_body: o.rendered_body, payload: o.payload || {}, status: o.status,
  attempts: o.attempts, next_attempt_at: o.next_attempt_at, last_error: o.last_error || "", sent_at: o.sent_at, created_at: o.created_at,
});

export function salaryOut(r) {
  const m = findById("memberships", r.membership);
  return {
    id: r.id, membership: r.membership, staff_name: m ? fullName(findById("users", m.user)) : "", staff_role: m?.role || "",
    hired_on: m?.hired_on || null, period: r.period, accrued_amount: r.accrued_amount, paid_amount: r.paid_amount, paid_at: r.paid_at,
    status: r.status, notes: r.notes || "", created_at: r.created_at, updated_at: r.updated_at,
  };
}

/* ---------- tenants / platform ---------- */

export function licenseStatus(tenant, today = new Date()) {
  if (!tenant.is_active) return "suspended";
  if (tenant.licensed_until && new Date(`${tenant.licensed_until}T23:59:59`) < today) return "expired";
  const plan = table("platformPlans").find((p) => p.code === tenant.plan);
  if (tenant.plan === "trial" || plan?.is_trial) return "trial";
  return "active";
}

function tenantCounts(tenant) {
  const staff = table("memberships").filter((m) => m.tenant === tenant.id && m.is_active && m.role !== "student").length;
  const students = table("students").filter((s) => s.tenant === tenant.id && s.status === "active").length;
  return { staff: tenant.demo_staff_count ?? staff, students: tenant.demo_student_count ?? students };
}

function ownerOf(tenant) {
  if (tenant.demo_owner) return tenant.demo_owner;
  const m = table("memberships").find((row) => row.tenant === tenant.id && row.role === "owner" && row.is_active);
  if (!m) return null;
  const user = findById("users", m.user);
  return { name: fullName(user) || user?.email || "—", email: user?.email || "", phone: user?.phone || "", role: "owner", is_active: true };
}

function documentsOf(tenant) {
  const labels = { contract: "Договор", license: "Лицензия", passport: "Паспорт / доверенность", other: "Другое" };
  return table("tenantDocuments")
    .filter((d) => d.tenant === tenant.id)
    .map((d) => ({ id: d.id, kind: d.kind, kind_label: labels[d.kind] || d.kind, title: d.title || d.original_name, number: "", created_at: d.created_at, file_url: d.file_url || null, original_name: d.original_name || "" }));
}

export function platformTenantOut(tenant) {
  const counts = tenantCounts(tenant);
  return {
    id: tenant.id, name: tenant.name, slug: tenant.slug, timezone: tenant.timezone, currency: tenant.currency, language: tenant.language,
    is_active: tenant.is_active, plan: tenant.plan, billing_cycle: tenant.billing_cycle, monthly_price: tenant.monthly_price,
    licensed_from: tenant.licensed_from, licensed_until: tenant.licensed_until, includes_crm: tenant.includes_crm, includes_app: tenant.includes_app,
    license_status: licenseStatus(tenant), legal_name: tenant.legal_name || "", legal_address: tenant.legal_address || "", city: tenant.city || "",
    contact_phone: tenant.contact_phone || "", stir: tenant.stir || "", director_name: tenant.director_name || "",
    contract_number: tenant.contract_number || "", contract_signed_on: tenant.contract_signed_on, notes: tenant.notes || "",
    created_at: tenant.created_at, owner: ownerOf(tenant), staff_count: counts.staff, student_count: counts.students,
    documents: documentsOf(tenant).map((d) => ({ id: d.id, kind: d.kind, title: d.title, file: d.file_url, original_name: d.original_name, created_at: d.created_at })),
  };
}

export function platformPlanOut(plan) {
  return {
    id: plan.id, code: plan.code, name: plan.name, description: plan.description, default_monthly_price: plan.default_monthly_price,
    default_billing_cycle: plan.default_billing_cycle, duration_days: plan.duration_days, is_trial: plan.is_trial,
    includes_crm: plan.includes_crm, includes_app: plan.includes_app, is_active: plan.is_active, sort_order: plan.sort_order,
    centers_count: table("tenants").filter((t) => t.plan === plan.code).length, created_at: plan.created_at, updated_at: plan.updated_at,
  };
}

export function platformStudentOut(s) {
  const tenant = findById("tenants", s.tenant);
  const subscriptions = table("subscriptions")
    .filter((sub) => sub.student === s.id)
    .map((sub) => {
      const plan = findById("plans", sub.plan);
      return {
        id: sub.id, plan_name: plan?.name || "", billing_type: plan?.billing_type || "", status: sub.status, starts_on: sub.starts_on,
        ends_on: sub.ends_on, total_lessons: sub.total_lessons, remaining_lessons: sub.total_lessons == null ? null : Math.max(0, sub.total_lessons - (sub.used_lessons || 0)),
      };
    });
  const active = subscriptions.filter((sub) => sub.status === "active");
  return {
    id: s.id, full_name: s.full_name, phone: s.phone, email: s.email || "", status: s.status, tenant_id: s.tenant, tenant_name: tenant?.name || "",
    subscription_count: subscriptions.length, active_subscription_count: active.length,
    active_until: active.map((sub) => sub.ends_on).sort().slice(-1)[0] || null, subscriptions,
  };
}

const PERMISSION_KEYS = ["can_manage_students", "can_manage_crm", "can_manage_billing", "can_send_notifications", "can_edit_attendance", "can_manage_staff", "can_manage_settings"];
const ROLE_OVERVIEW = [
  ["owner", "Владелец", [1, 1, 1, 1, 1, 1, 1]],
  ["admin", "Админ", [1, 1, 1, 1, 1, 1, 1]],
  ["accountant", "Бухгалтер", [1, 0, 1, 0, 0, 0, 0]],
  ["teacher", "Преподаватель", [1, 0, 0, 0, 1, 0, 0]],
].map(([role, label, flags]) => ({ role, label, ...Object.fromEntries(PERMISSION_KEYS.map((key, index) => [key, Boolean(flags[index])])) }));

export function tenantSettingsOut(tenant) {
  const plan = table("platformPlans").find((p) => p.code === tenant.plan);
  const status = licenseStatus(tenant);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysLeft = tenant.licensed_until ? Math.round((new Date(`${tenant.licensed_until}T00:00:00`) - startOfToday) / 86400000) : null;
  const counts = tenantCounts(tenant);
  return {
    id: tenant.id, name: tenant.name, slug: tenant.slug, short_name: tenant.short_name || "", description: tenant.description || "",
    timezone: tenant.timezone, currency: tenant.currency, language: tenant.language, logo: tenant.logo_url || null, logo_url: tenant.logo_url || null,
    primary_color: tenant.primary_color || "", secondary_color: tenant.secondary_color || "", contact_phone: tenant.contact_phone || "",
    contact_phone_secondary: tenant.contact_phone_secondary || "", contact_email: tenant.contact_email || "", telegram: tenant.telegram || "",
    website: tenant.website || "", legal_name: tenant.legal_name || "", legal_address: tenant.legal_address || "", city: tenant.city || "",
    stir: tenant.stir || "", director_name: tenant.director_name || "", contract_number: tenant.contract_number || "",
    contract_signed_on: tenant.contract_signed_on, center_settings: tenant.center_settings || {},
    integrations: {
      telegram: { key: "telegram", label: "Telegram", configured: true },
      fcm: { key: "fcm", label: "Firebase Push", configured: true },
      email: { key: "email", label: "Email", configured: false },
    },
    role_overview: ROLE_OVERVIEW,
    subscription: {
      plan_code: tenant.plan, plan_name: plan?.name || tenant.plan, plan_description: plan?.description || "", is_trial: Boolean(plan?.is_trial),
      status: status === "active" && daysLeft != null && daysLeft >= 0 && daysLeft <= 14 ? "expiring_soon" : status, license_status: status,
      monthly_price: tenant.monthly_price, billing_cycle: tenant.billing_cycle, licensed_from: tenant.licensed_from, licensed_until: tenant.licensed_until,
      next_payment_date: tenant.licensed_until, days_left: daysLeft, includes_crm: tenant.includes_crm, includes_app: tenant.includes_app,
      features: [
        { key: "crm", label: "CRM", included: tenant.includes_crm },
        { key: "app", label: "Мобильное приложение", included: tenant.includes_app },
      ],
      can_change_plan: false, payment_history: [],
    },
    documents: documentsOf(tenant), owner: ownerOf(tenant),
    usage: { students: { count: counts.students, limit: null }, staff: { count: counts.staff, limit: null } },
    updated_at: tenant.updated_at,
  };
}
