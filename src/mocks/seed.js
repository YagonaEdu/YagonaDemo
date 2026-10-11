/* Builds the demo database. Deterministic (seeded random), but dates are generated
   around "today" so the schedule, debts and deadlines always look current. */
import {
  BILLING_PLANS,
  CENTER,
  COURSES,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  GROUPS,
  LAST_NAMES,
  LEAD_STAGES,
  ROOMS,
  STAFF,
  SUPER_USER,
  TAGS,
  TOPICS,
  VOCAB,
} from "./catalog";
import { DEFAULT_CENTER_SETTINGS } from "./settings";

const DAY = 24 * 60 * 60 * 1000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed() {
  const rand = rng(20261011);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const chance = (p) => rand() < p;
  const between = (min, max) => Math.round(min + rand() * (max - min));

  let counter = 0;
  const id = () => {
    counter += 1;
    return `0d3e0000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
  };

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayAt = (offset, time = "09:00") => {
    const [h, m] = time.split(":").map(Number);
    const date = new Date(today.getTime() + offset * DAY);
    date.setHours(h, m, 0, 0);
    return date;
  };
  const iso = (date) => date.toISOString();
  const isoDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const ago = (days, time) => iso(dayAt(-days, time || `${String(between(9, 19)).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}`));
  const stamp = (date) => ({ created_at: date, updated_at: date });
  const monthStart = (offset) => new Date(today.getFullYear(), today.getMonth() + offset, 1);

  const t = {
    users: [], tenants: [], tenantDocuments: [], memberships: [], platformPlans: [],
    courses: [], rooms: [], groups: [], students: [], enrollments: [], guardians: [], studentGuardians: [],
    lessons: [], attendance: [], plans: [], subscriptions: [], invoices: [], payments: [],
    leadStages: [], tags: [], leads: [], leadActivities: [],
    homeworks: [], submissions: [], materials: [],
    vocabLists: [], vocabWords: [], vocabExams: [], vocabAttempts: [], vocabProgress: [],
    notifications: [], notificationRecipients: [], outbox: [], salaryRecords: [],
  };

  /* ---------- platform plans and centres ---------- */
  const platformPlans = [
    { code: "trial", name: "Пробный", description: "14 дней бесплатно: все функции, до 50 учеников.", default_monthly_price: "0.00", default_billing_cycle: "monthly", duration_days: 14, is_trial: true, includes_crm: true, includes_app: true, sort_order: 1 },
    { code: "start", name: "Старт", description: "Учебная часть, расписание, посещаемость и оплаты.", default_monthly_price: "590000.00", default_billing_cycle: "monthly", duration_days: 30, is_trial: false, includes_crm: false, includes_app: true, sort_order: 2 },
    { code: "business", name: "Бизнес", description: "Всё из «Старт» + CRM, ресепшен и мобильное приложение.", default_monthly_price: "1290000.00", default_billing_cycle: "monthly", duration_days: 30, is_trial: false, includes_crm: true, includes_app: true, sort_order: 3 },
  ];
  platformPlans.forEach((plan) => t.platformPlans.push({ id: id(), is_active: true, ...plan, ...stamp(ago(400)) }));

  const mainTenantId = id();
  t.tenants.push({
    id: mainTenantId, ...CENTER, timezone: "Asia/Tashkent", currency: "UZS", language: "ru", is_active: true,
    plan: "business", billing_cycle: "monthly", monthly_price: "1290000.00",
    licensed_from: isoDate(dayAt(-160)), licensed_until: isoDate(dayAt(205)), includes_crm: true, includes_app: true,
    contract_signed_on: isoDate(dayAt(-160)), notes: "Демо-центр. Данные сгенерированы автоматически.",
    logo_url: null, primary_color: "#0b3a8a", secondary_color: "#00bfa5",
    center_settings: JSON.parse(JSON.stringify(DEFAULT_CENTER_SETTINGS)),
    ...stamp(ago(160)),
  });
  t.tenantDocuments.push(
    { id: id(), tenant: mainTenantId, kind: "contract", title: "Договор YG-2026/014", original_name: "contract-YG-2026-014.pdf", ...stamp(ago(160)) },
    { id: id(), tenant: mainTenantId, kind: "license", title: "Лицензия на образовательную деятельность", original_name: "license.pdf", ...stamp(ago(158)) },
  );

  const otherCenters = [
    { name: "Najot Ta'lim — Чиланзар", slug: "najot-chilanzar", city: "Ташкент", plan: "business", until: 120, staff: 14, students: 236, owner: "Шерзод Мирзаев" },
    { name: "Bright Kids Samarkand", slug: "bright-kids", city: "Самарканд", plan: "trial", until: 9, staff: 4, students: 38, owner: "Гулнора Холматова" },
    { name: "Lingua House Bukhara", slug: "lingua-house", city: "Бухара", plan: "start", until: -12, staff: 6, students: 74, owner: "Фаррух Ахмедов" },
    { name: "Smart Math Namangan", slug: "smart-math", city: "Наманган", plan: "start", until: 8, staff: 5, students: 91, owner: "Улугбек Назаров" },
    { name: "Uz IT Academy", slug: "uz-it", city: "Ташкент", plan: "business", until: 40, staff: 9, students: 152, owner: "Отабек Усмонов", inactive: true },
    { name: "Cambridge Center Fergana", slug: "cambridge-fergana", city: "Фергана", plan: "business", until: 280, staff: 11, students: 189, owner: "Нилуфар Шарипова" },
  ];
  const otherTenantIds = [];
  otherCenters.forEach((center, index) => {
    const tid = id();
    otherTenantIds.push(tid);
    const plan = platformPlans.find((item) => item.code === center.plan);
    t.tenants.push({
      id: tid, name: center.name, slug: center.slug, short_name: center.name.split(" ")[0], description: "",
      timezone: "Asia/Tashkent", currency: "UZS", language: "ru", is_active: !center.inactive,
      plan: center.plan, billing_cycle: index % 3 === 2 ? "yearly" : "monthly", monthly_price: plan.default_monthly_price,
      licensed_from: isoDate(dayAt(center.until - (plan.is_trial ? 14 : 180))), licensed_until: isoDate(dayAt(center.until)),
      includes_crm: plan.includes_crm, includes_app: plan.includes_app,
      legal_name: `ООО «${center.name}»`, legal_address: `${center.city}, ул. Навои, ${10 + index * 7}`, city: center.city,
      contact_phone: `+99871${between(2000000, 2999999)}`, contact_phone_secondary: "", contact_email: `info@${center.slug}.demo`,
      telegram: `@${center.slug.replace(/-/g, "_")}`, website: "", stir: String(between(300000000, 309999999)),
      director_name: center.owner, contract_number: `YG-2026/${String(20 + index).padStart(3, "0")}`,
      contract_signed_on: isoDate(dayAt(center.until - 180)), notes: "", logo_url: null,
      primary_color: "#0b3a8a", secondary_color: "#00bfa5", center_settings: JSON.parse(JSON.stringify(DEFAULT_CENTER_SETTINGS)),
      demo_staff_count: center.staff, demo_student_count: center.students,
      demo_owner: { name: center.owner, email: `owner@${center.slug}.demo`, phone: `+99890${between(1000000, 9999999)}`, role: "owner", is_active: true },
      ...stamp(ago(200 - index * 20)),
    });
  });

  /* ---------- users and staff ---------- */
  const superUserId = id();
  t.users.push({ id: superUserId, email: SUPER_USER.email, phone: SUPER_USER.phone, first_name: SUPER_USER.first, last_name: SUPER_USER.last, avatar: "owl", photo_url: null, is_superuser: true });

  const staffByKey = {};
  STAFF.forEach((person, index) => {
    const userId = id();
    t.users.push({ id: userId, email: person.email, phone: person.phone, first_name: person.first, last_name: person.last, avatar: ["fox", "owl", "panda"][index % 3], photo_url: null, is_superuser: false });
    const membership = {
      id: id(), tenant: mainTenantId, user: userId, role: person.role, is_active: true, position: person.position,
      hired_on: isoDate(dayAt(-between(120, 900))), payment_type: person.pay[0], salary_rate: `${person.pay[1]}.00`,
      salary_paid_month: "0.00", last_payout_at: null, last_payout_amount: null, ...stamp(ago(150 - index)),
    };
    t.memberships.push(membership);
    staffByKey[person.key] = membership;
  });

  /* ---------- academics ---------- */
  const courseByKey = {};
  COURSES.forEach((course) => {
    const row = { id: id(), tenant: mainTenantId, name: course.name, description: course.description, price: `${course.price}.00`, currency: "UZS", is_active: true, ...stamp(ago(150)) };
    t.courses.push(row);
    courseByKey[course.key] = row;
  });
  const rooms = ROOMS.map((room) => {
    const row = { id: id(), tenant: mainTenantId, name: room.name, capacity: room.capacity, is_active: true };
    t.rooms.push(row);
    return row;
  });

  const groupRows = GROUPS.map((group) => {
    const row = {
      id: id(), tenant: mainTenantId, course: courseByKey[group.course].id, name: group.name,
      teacher: staffByKey[group.teacher].id, capacity: rooms[group.room].capacity, room: rooms[group.room].id,
      start_date: isoDate(dayAt(group.status === "planned" ? 14 : -between(40, 90))),
      end_date: isoDate(dayAt(group.status === "planned" ? 200 : between(60, 150))), status: group.status,
      demo: group, ...stamp(ago(95)),
    };
    t.groups.push(row);
    return row;
  });

  /* ---------- students ---------- */
  const usedNames = new Set();
  const personName = () => {
    for (;;) {
      const female = chance(0.5);
      const first = pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
      const last = pick(LAST_NAMES) + (female ? "а" : "");
      const full = `${last} ${first}`;
      if (!usedNames.has(full)) {
        usedNames.add(full);
        return { full, first, last };
      }
    }
  };
  const phone = () => `+99890${between(1000000, 9999999)}`;

  const demoStudentUserId = id();
  t.users.push({ id: demoStudentUserId, email: "student@registon.demo", phone: "+998901234501", first_name: "Камола", last_name: "Юсупова", avatar: "panda", photo_url: null, is_superuser: false });
  usedNames.add("Юсупова Камола");
  const demoStudent = {
    id: id(), tenant: mainTenantId, full_name: "Юсупова Камола", birth_date: "2008-04-17", phone: "+998901234501",
    email: "student@registon.demo", status: "active", notes: "Демо-ученица: используйте вход «ученик».", user: demoStudentUserId, ...stamp(ago(80)),
  };
  t.students.push(demoStudent);
  t.memberships.push({ id: id(), tenant: mainTenantId, user: demoStudentUserId, role: "student", is_active: true, position: "", hired_on: null, payment_type: "", salary_rate: "0.00", salary_paid_month: "0.00", last_payout_at: null, last_payout_amount: null, ...stamp(ago(80)) });

  const pool = [];
  for (let i = 0; i < 52; i += 1) {
    const name = personName();
    const row = {
      id: id(), tenant: mainTenantId, full_name: name.full, birth_date: isoDate(new Date(between(1995, 2012), between(0, 11), between(1, 28))),
      phone: phone(), email: chance(0.4) ? `student${i + 1}@mail.demo` : "", status: "active", notes: chance(0.15) ? "Предпочитает связь в Telegram." : "", user: null,
      ...stamp(ago(between(5, 120))),
    };
    t.students.push(row);
    pool.push(row);
  }
  ["inactive", "inactive", "archived", "archived"].forEach((status) => {
    const name = personName();
    t.students.push({ id: id(), tenant: mainTenantId, full_name: name.full, birth_date: "2006-09-01", phone: phone(), email: "", status, notes: status === "archived" ? "Окончил курс." : "Пауза по семейным обстоятельствам.", user: null, ...stamp(ago(between(130, 300))) });
  });

  let cursor = 0;
  const members = {};
  groupRows.forEach((group) => {
    const list = [];
    if (group.demo.demoStudent) list.push(demoStudent);
    while (list.length < group.demo.size) {
      const student = pool[cursor % pool.length];
      cursor += 1;
      if (!list.includes(student)) list.push(student);
    }
    members[group.id] = list;
    list.forEach((student) => {
      t.enrollments.push({ id: id(), tenant: mainTenantId, student: student.id, group: group.id, status: "active", joined_at: group.start_date, ended_at: null, created_at: ago(90) });
    });
  });
  // Some history: a finished and a cancelled enrollment.
  t.enrollments.push({ id: id(), tenant: mainTenantId, student: t.students[t.students.length - 1].id, group: groupRows[0].id, status: "completed", joined_at: isoDate(dayAt(-300)), ended_at: isoDate(dayAt(-130)), created_at: ago(300) });
  t.enrollments.push({ id: id(), tenant: mainTenantId, student: t.students[t.students.length - 3].id, group: groupRows[2].id, status: "cancelled", joined_at: isoDate(dayAt(-120)), ended_at: isoDate(dayAt(-60)), created_at: ago(120) });

  /* Guardians for school-age students. */
  t.students.filter((s) => s.birth_date >= "2007-01-01").slice(0, 18).forEach((student, index) => {
    const parentName = `${student.full_name.split(" ")[0].replace(/а$/, "")}${index % 2 ? "а" : ""} ${pick(index % 2 ? FIRST_NAMES_F : FIRST_NAMES_M)}`;
    const guardian = { id: id(), tenant: mainTenantId, full_name: parentName, phone: phone(), email: "", ...stamp(student.created_at) };
    t.guardians.push(guardian);
    t.studentGuardians.push({ id: id(), tenant: mainTenantId, student: student.id, guardian: guardian.id, relationship: index % 2 ? "Мама" : "Папа", is_primary: true });
  });

  /* ---------- lessons and attendance ---------- */
  const attendanceStatus = () => {
    const r = rand();
    if (r < 0.84) return "present";
    if (r < 0.91) return "late";
    if (r < 0.97) return "absent";
    return "excused";
  };
  groupRows.filter((g) => g.status === "active").forEach((group) => {
    const course = COURSES.find((c) => courseByKey[c.key].id === group.course);
    const topics = TOPICS[course.key];
    let topicIndex = 0;
    for (let offset = -28; offset <= 21; offset += 1) {
      const date = dayAt(offset, group.demo.time);
      if (!group.demo.days.includes(date.getDay())) continue;
      const startsAt = date;
      const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
      const past = offset < 0;
      const cancelled = past && chance(0.03);
      const lesson = {
        id: id(), tenant: mainTenantId, group: group.id, teacher: group.teacher, room: group.room, schedule_rule: null,
        starts_at: iso(startsAt), ends_at: iso(endsAt), topic: topics[topicIndex % topics.length],
        status: cancelled ? "cancelled" : past ? "completed" : "scheduled", ...stamp(ago(30)),
      };
      topicIndex += 1;
      t.lessons.push(lesson);
      if (past && !cancelled) {
        members[group.id].forEach((student) => {
          const status = attendanceStatus();
          t.attendance.push({
            id: id(), tenant: mainTenantId, lesson: lesson.id, student: student.id, status,
            comment: status === "excused" ? "Справка от врача" : status === "late" ? "Опоздал(а) на 10 минут" : "",
            marked_by: null, ...stamp(lesson.ends_at),
          });
        });
      }
    }
  });

  /* Trial lessons are lessons whose topic starts with «ПРОБНЫЙ:» (see reception utils). */
  [
    [0, "12:30", "ge-a1", "Ахмедова Сабина", "+998935550101", "Хочет в утреннюю группу"],
    [0, "17:00", "ielts-65", "Назаров Достон", "+998977770202", "Цель — IELTS 7.0"],
    [1, "11:00", "math-1", "Эргашев Ислом", "+998946660303", ""],
    [2, "15:00", "py-1", "Тошпулатов Элдор", "+998903330404", "Школьник, 9 класс"],
    [-2, "14:00", "ge-b1", "Бакирова Умида", "+998911110505", ""],
    [-5, "18:30", "kor-1", "Холматова Райхона", "+998998880606", "Готовится к TOPIK"],
  ].forEach(([offset, time, groupKey, name, tel, comment]) => {
    const group = groupRows.find((g) => g.demo.key === groupKey);
    const startsAt = dayAt(offset, time);
    t.lessons.push({
      id: id(), tenant: mainTenantId, group: group.id, teacher: group.teacher, room: group.room, schedule_rule: null,
      starts_at: iso(startsAt), ends_at: iso(new Date(startsAt.getTime() + 60 * 60 * 1000)),
      topic: `ПРОБНЫЙ: ${name} · ${tel}${comment ? ` · ${comment}` : ""}`,
      status: offset < 0 ? "completed" : "scheduled", ...stamp(ago(Math.max(1, -offset + 2))),
    });
  });

  /* ---------- billing ---------- */
  const planRows = BILLING_PLANS.map((plan) => {
    const row = { id: id(), tenant: mainTenantId, name: plan.name, billing_type: plan.billing_type, price: `${plan.price}.00`, currency: "UZS", lesson_limit: plan.lesson_limit, duration_days: plan.duration_days, is_active: true };
    t.plans.push(row);
    return row;
  });

  let invoiceNumber = 0;
  const methods = ["cash", "cash", "card", "click", "payme", "bank_transfer"];
  const studentCourses = (student) =>
    t.enrollments
      .filter((e) => e.student === student.id && e.status === "active")
      .map((e) => t.courses.find((c) => c.id === t.groups.find((g) => g.id === e.group).course));

  t.students.filter((s) => s.tenant === mainTenantId && s.status === "active").forEach((student) => {
    const courses = studentCourses(student);
    if (!courses.length) return;
    const ielts = courses.some((c) => c.name.startsWith("IELTS"));
    const plan = ielts ? planRows[1] : chance(0.25) ? planRows[2] : planRows[0];
    const startsOn = monthStart(0);
    const subscription = {
      id: id(), tenant: mainTenantId, student: student.id, plan: plan.id, starts_on: isoDate(startsOn),
      ends_on: isoDate(new Date(startsOn.getTime() + plan.duration_days * DAY)), total_lessons: plan.lesson_limit,
      used_lessons: plan.lesson_limit ? between(2, 6) : 0, status: "active", created_at: iso(startsOn),
    };
    t.subscriptions.push(subscription);
    t.subscriptions.push({
      id: id(), tenant: mainTenantId, student: student.id, plan: plan.id, starts_on: isoDate(monthStart(-1)),
      ends_on: isoDate(new Date(monthStart(-1).getTime() + plan.duration_days * DAY)), total_lessons: plan.lesson_limit,
      used_lessons: plan.lesson_limit || 0, status: "expired", created_at: iso(monthStart(-1)),
    });
    const amount = courses.reduce((sum, c) => sum + Number(c.price), 0);

    [-2, -1, 0].forEach((monthOffset) => {
      const issued = monthStart(monthOffset);
      const due = new Date(issued.getFullYear(), issued.getMonth(), 10, 18, 0, 0);
      let paid = amount;
      if (monthOffset === -1 && chance(0.1)) paid = Math.round(amount / 2 / 1000) * 1000;
      if (monthOffset === 0) {
        const r = rand();
        paid = r < 0.55 ? amount : r < 0.72 ? Math.round((amount * 0.5) / 1000) * 1000 : 0;
      }
      if (student.id === demoStudent.id && monthOffset === 0) paid = Math.round((amount * 0.5) / 1000) * 1000;
      invoiceNumber += 1;
      const status = paid >= amount ? "paid" : paid > 0 ? "partially_paid" : due < now ? "overdue" : "issued";
      const invoice = {
        id: id(), tenant: mainTenantId, number: `INV-${today.getFullYear()}-${String(invoiceNumber).padStart(5, "0")}`,
        student: student.id, subscription: monthOffset === 0 ? subscription.id : null, amount: `${amount}.00`,
        paid_amount: `${paid}.00`, currency: "UZS", due_at: iso(due), status,
        description: `Оплата обучения за ${issued.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}: ${courses.map((c) => c.name).join(", ")}`,
        ...stamp(iso(issued)),
      };
      t.invoices.push(invoice);
      if (paid > 0) {
        const paidAt = new Date(Math.min(now.getTime() - DAY / 2, issued.getTime() + between(1, 12) * DAY + between(9, 18) * 3600000));
        t.payments.push({
          id: id(), tenant: mainTenantId, invoice: invoice.id, amount: `${paid}.00`, method: pick(methods), status: "succeeded",
          external_id: "", idempotency_key: `demo-${invoice.number}`, paid_at: iso(paidAt), note: "", created_at: iso(paidAt),
        });
      }
    });
  });

  /* ---------- CRM ---------- */
  const stageRows = LEAD_STAGES.map((stage, index) => {
    const row = { id: id(), tenant: mainTenantId, name: stage.name, position: index + 1, is_won: stage.is_won, is_lost: stage.is_lost };
    t.leadStages.push(row);
    return row;
  });
  const tagRows = TAGS.map((tag) => {
    const row = { id: id(), tenant: mainTenantId, ...tag };
    t.tags.push(row);
    return row;
  });
  const sources = ["instagram", "instagram", "telegram", "telegram", "website", "manual", "other"];
  const interests = ["General English", "IELTS 7.0", "DTM математика", "Корейский язык", "Python для школьника", "Русский язык"];
  const leadPlan = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 0, 1, 2, 3];
  leadPlan.forEach((stageIndex, index) => {
    const name = personName();
    const createdDays = index < 3 ? 0 : between(1, 35);
    const stage = stageRows[stageIndex];
    const converted = stage.is_won ? pool[(index * 3) % pool.length].id : null;
    const followUp = stage.is_won || stage.is_lost ? null : index % 4 === 0 ? ago(1, "10:00") : index % 4 === 1 ? iso(dayAt(0, "16:00")) : iso(dayAt(between(1, 5), "11:00"));
    const createdAt = createdDays === 0 ? iso(new Date(now.getTime() - between(20, 240) * 60000)) : ago(createdDays);
    const lead = {
      id: id(), tenant: mainTenantId, full_name: name.full, phone: phone(), email: chance(0.3) ? `lead${index + 1}@mail.demo` : "",
      source: pick(sources), source_details: chance(0.5) ? "Реклама в сторис" : "", stage: stage.id, assigned_to: staffByKey.admin.id,
      tags: chance(0.5) ? [pick(tagRows).id] : [], notes: `Интересует: ${pick(interests)}.`, next_follow_up_at: followUp,
      lost_reason: stage.is_lost ? pick(["Дорого", "Неудобное время", "Выбрал другой центр"]) : "", converted_student: converted,
      ...stamp(createdAt),
    };
    t.leads.push(lead);
    t.leadActivities.push({ id: id(), tenant: mainTenantId, lead: lead.id, kind: "note", content: "Заявка создана", occurred_at: createdAt, created_by: staffByKey.admin.user, created_at: createdAt });
    if (stageIndex > 0) {
      t.leadActivities.push({ id: id(), tenant: mainTenantId, lead: lead.id, kind: "call", content: "Позвонили, рассказали о курсах и ценах.", occurred_at: createdAt, created_by: staffByKey.admin.user, created_at: createdAt });
    }
    if (stageIndex >= 2) {
      t.leadActivities.push({ id: id(), tenant: mainTenantId, lead: lead.id, kind: "stage_change", content: `Этап: ${stage.name}`, occurred_at: createdAt, created_by: staffByKey.admin.user, created_at: createdAt });
    }
  });

  /* ---------- homework ---------- */
  const lessonsOf = (groupId) => t.lessons.filter((l) => l.group === groupId && !l.topic.startsWith("ПРОБНЫЙ"));
  const hwTemplates = [
    { offset: -10, title: "Упражнения по теме урока", description: "Выполните упражнения 1–5 из рабочей тетради и пришлите фото или текст ответов." },
    { offset: -2, title: "Эссе / письменная работа", description: "Напишите работу объёмом 150–200 слов по теме последнего урока. Обратите внимание на структуру." },
    { offset: 3, title: "Подготовка к контрольной", description: "Повторите материал последних трёх уроков и решите тренировочный вариант (ссылка во вложении)." },
  ];
  groupRows.filter((g) => g.status === "active").forEach((group) => {
    const teacherUser = t.memberships.find((m) => m.id === group.teacher).user;
    hwTemplates.forEach((tpl, index) => {
      const due = dayAt(tpl.offset, "23:59");
      const lesson = lessonsOf(group.id).filter((l) => new Date(l.starts_at) < due).slice(-1)[0] || null;
      const createdAt = iso(new Date(due.getTime() - 5 * DAY));
      const homework = {
        id: id(), tenant: mainTenantId, group: group.id, lesson: lesson?.id || null,
        title: `${tpl.title}${lesson ? `: ${lesson.topic}` : ""}`, description: tpl.description, due_at: iso(due),
        max_score: 10, allow_late: index !== 2, allow_resubmit: true, is_published: true, published_at: createdAt,
        attachments: index === 2 ? [{ id: id(), title: "Тренировочный вариант", url: "https://docs.google.com/document/d/demo", original_name: "", size: null, download_url: null, created_at: createdAt }] : [],
        created_by: teacherUser, ...stamp(createdAt),
      };
      t.homeworks.push(homework);
      members[group.id].forEach((student) => {
        const isDemo = student.id === demoStudent.id;
        let status;
        if (index === 0) status = isDemo ? "graded" : rand() < 0.75 ? "graded" : rand() < 0.5 ? "submitted" : null;
        else if (index === 1) status = isDemo ? "returned" : rand() < 0.45 ? "submitted" : rand() < 0.4 ? "graded" : rand() < 0.3 ? "late" : null;
        else status = isDemo ? null : rand() < 0.2 ? "submitted" : null;
        if (!status) return;
        const submittedAt = iso(new Date(Math.min(now.getTime() - 3600000, due.getTime() - between(2, 70) * 3600000 + (status === "late" ? 30 * 3600000 : 0))));
        const graded = status === "graded" || status === "returned";
        t.submissions.push({
          id: id(), tenant: mainTenantId, homework: homework.id, student: student.id, status,
          text: "Ответы:\n1) b\n2) a\n3) c\n4) have been\n5) more interesting", link: "", files: [],
          submitted_at: submittedAt, attempt: 1, score: status === "graded" ? between(6, 10) : null,
          feedback: status === "graded" ? pick(["Отлично, молодец!", "Хорошо, обратите внимание на артикли.", "Неплохо, но есть ошибки во времени глаголов."]) : status === "returned" ? "Пожалуйста, доработайте вторую часть: не хватает примеров." : "",
          graded_at: graded ? iso(new Date(new Date(submittedAt).getTime() + DAY)) : null, ...stamp(submittedAt),
        });
      });
    });
  });
  // An unpublished draft in the demo teacher's group.
  t.homeworks.push({
    id: id(), tenant: mainTenantId, group: groupRows[0].id, lesson: null, title: "Черновик: Present Perfect — практика",
    description: "Задание ещё не опубликовано ученикам.", due_at: iso(dayAt(7, "23:59")), max_score: 10, allow_late: true,
    allow_resubmit: true, is_published: false, published_at: null, attachments: [], created_by: staffByKey.teacher.user, ...stamp(ago(1)),
  });

  /* ---------- teaching materials ---------- */
  const materialSpecs = [
    ["teacher", "ge-b1", "Grammar: Present Perfect — шпаргалка", "text", { text_content: "Present Perfect = have/has + V3.\n\nИспользуем, когда результат важен сейчас: I have lost my keys.\n\nМаркеры: already, yet, just, ever, never, since, for." }, "B1", "published"],
    ["teacher", "ge-b1", "BBC Learning English: 6 Minute English", "video", { link: "https://www.youtube.com/@bbclearningenglish" }, "B1", "published"],
    ["teacher", "ge-b1", "Vocabulary: Food & Drinks (карточки)", "link", { link: "https://quizlet.com/" }, "A2", "published"],
    ["teacher", "ge-a1", "Алфавит и произношение", "video", { link: "https://www.youtube.com/watch?v=demo" }, "A1", "published"],
    ["teacher", "ge-a1", "Глагол to be — упражнения", "text", { text_content: "I am, you are, he/she/it is.\n\nЗаполните пропуски: 1) She ___ a student. 2) We ___ friends." }, "A1", "published"],
    ["teacher", "ge-a1", "План урока: Numbers 1–100", "text", { text_content: "Разминка — 10 мин, новые слова — 20 мин, игра Bingo — 15 мин." }, "A1", "draft"],
    ["t2", "ielts-65", "IELTS Writing Task 2 — структура эссе", "text", { text_content: "Introduction → Body 1 → Body 2 → Conclusion. 250+ слов, 40 минут." }, "B2", "published"],
    ["t2", "ielts-65", "Cambridge IELTS 18 — Listening", "link", { link: "https://www.cambridge.org/" }, "B2", "published"],
    ["t3", "math-1", "Формулы сокращённого умножения", "text", { text_content: "(a+b)² = a² + 2ab + b²\n(a−b)² = a² − 2ab + b²\na² − b² = (a−b)(a+b)" }, "", "published"],
    ["t3", "math-1", "Разбор варианта DTM-2025", "video", { link: "https://www.youtube.com/watch?v=demo-math" }, "", "published"],
    ["t6", "py-1", "Установка Python и VS Code", "link", { link: "https://www.python.org/downloads/" }, "", "published"],
  ];
  materialSpecs.forEach(([teacherKey, groupKey, title, type, extra, level, status], index) => {
    const group = groupRows.find((g) => g.demo.key === groupKey);
    const author = STAFF.find((s) => s.key === teacherKey);
    t.materials.push({
      id: id(), tenant: mainTenantId, teacher: staffByKey[teacherKey].id, group: group.id, course: group.course, title,
      description: "", material_type: type, file: null, link: "", text_content: "", topic: title.split(":")[0], level,
      author: `${author.first} ${author.last}`, status, ...extra, ...stamp(ago(30 - index * 2)),
    });
  });

  /* ---------- vocabulary ---------- */
  const listSpecs = [["Food & Drinks", "ge-b1", "A2"], ["Travel", "ge-b1", "B1"], ["IELTS: Environment", "ielts-65", "B2"]];
  const listRows = listSpecs.map(([title, groupKey, level], index) => {
    const group = groupRows.find((g) => g.demo.key === groupKey);
    const teacherUser = t.memberships.find((m) => m.id === group.teacher).user;
    const list = { id: id(), tenant: mainTenantId, course: group.course, group: group.id, title, level, description: `Словарь к теме «${title}».`, is_published: true, created_by: teacherUser, ...stamp(ago(25 - index * 5)) };
    t.vocabLists.push(list);
    VOCAB[title].forEach(([term, translation, transcription, example, pos], order) => {
      t.vocabWords.push({ id: id(), tenant: mainTenantId, list: list.id, term, translation, transcription, example, part_of_speech: pos, order: order + 1 });
    });
    return list;
  });

  const geB1 = groupRows.find((g) => g.demo.key === "ge-b1");
  const examOpen = {
    id: id(), tenant: mainTenantId, list: listRows[0].id, group: geB1.id, title: "Тест: Food & Drinks", mode: "mixed",
    direction: "both", questions_count: 10, time_limit_sec: 600, opens_at: ago(2, "09:00"), closes_at: iso(dayAt(5, "23:59")),
    attempts_allowed: 2, pass_score: 70, shuffle: true, is_published: true, created_by: staffByKey.teacher.user, ...stamp(ago(3)),
  };
  const examClosed = {
    id: id(), tenant: mainTenantId, list: listRows[1].id, group: geB1.id, title: "Контрольная: Travel", mode: "choice",
    direction: "term_to_translation", questions_count: 8, time_limit_sec: 480, opens_at: ago(10, "09:00"), closes_at: ago(3, "23:59"),
    attempts_allowed: 1, pass_score: 60, shuffle: true, is_published: true, created_by: staffByKey.teacher.user, ...stamp(ago(11)),
  };
  t.vocabExams.push(examOpen, examClosed);

  const travelWords = t.vocabWords.filter((w) => w.list === listRows[1].id);
  members[geB1.id].forEach((student, index) => {
    const isDemo = student.id === demoStudent.id;
    if (!isDemo && index % 5 === 4) return; // a student who skipped the test
    const total = examClosed.questions_count;
    const correct = isDemo ? 7 : between(3, 8);
    const started = new Date(new Date(examClosed.opens_at).getTime() + between(1, 5) * DAY + between(1, 8) * 3600000);
    const answers = travelWords.slice(0, total).map((word, order) => {
      const right = order < correct;
      const wrong = travelWords[(order + 3) % travelWords.length].translation;
      const options = [word.translation, wrong, travelWords[(order + 5) % travelWords.length].translation, travelWords[(order + 7) % travelWords.length].translation].sort(() => rand() - 0.5);
      return { id: id(), order: order + 1, word: word.id, question_type: "choice", direction: "term_to_translation", prompt: word.term, options, given_answer: right ? word.translation : wrong, answered_at: iso(started), expected: word.translation, is_correct: right };
    });
    t.vocabAttempts.push({
      id: id(), tenant: mainTenantId, exam: examClosed.id, student: student.id, status: "finished", started_at: iso(started),
      deadline_at: iso(new Date(started.getTime() + examClosed.time_limit_sec * 1000)), finished_at: iso(new Date(started.getTime() + 300000)),
      score_percent: Math.round((correct / total) * 100), correct_count: correct, total, answers,
    });
  });
  members[geB1.id].slice(1, 4).forEach((student) => {
    const started = new Date(now.getTime() - between(5, 30) * 3600000);
    const score = between(60, 100);
    t.vocabAttempts.push({
      id: id(), tenant: mainTenantId, exam: examOpen.id, student: student.id, status: "finished", started_at: iso(started),
      deadline_at: iso(new Date(started.getTime() + 600000)), finished_at: iso(new Date(started.getTime() + 420000)),
      score_percent: score, correct_count: Math.round(score / 10), total: 10, answers: [],
    });
  });
  t.vocabWords.filter((w) => w.list === listRows[0].id).slice(0, 8).forEach((word, index) => {
    t.vocabProgress.push({ id: id(), tenant: mainTenantId, student: demoStudent.id, word: word.id, box: (index % 4) + 1, next_review_at: index < 5 ? ago(1) : iso(dayAt(index, "09:00")) });
  });

  /* ---------- notifications ---------- */
  const notify = (spec, recipients) => {
    const { readSome, ...fields } = spec;
    const notification = { id: id(), tenant: mainTenantId, send_push: true, group: null, course: null, metadata: {}, priority: "normal", ...fields };
    t.notifications.push(notification);
    recipients.forEach((student, index) => {
      const read = readSome && index % 3 !== 0;
      t.notificationRecipients.push({
        id: id(), tenant: mainTenantId, notification: notification.id, student: student.id,
        read_at: read ? iso(new Date(new Date(spec.created_at).getTime() + 3600000)) : null, delivered_at: spec.created_at,
        push_sent_at: spec.created_at, push_failed_at: index === 5 ? spec.created_at : null, push_error: index === 5 ? "Device token expired" : "",
      });
    });
    return notification;
  };
  const allActive = t.students.filter((s) => s.tenant === mainTenantId && s.status === "active");
  notify({ title: "Расписание на праздники", message: "Уважаемые ученики! В праздничные дни занятия проходят по обычному расписанию, кроме 1 января.", category: "announcement", recipient_type: "all_students", created_by: staffByKey.admin.user, created_at: ago(9), readSome: true }, allActive);
  notify({ title: "Напоминание об оплате", message: "Срок оплаты за текущий месяц — до 10 числа. Оплатить можно на ресепшене, через Click или Payme.", category: "payment", priority: "important", recipient_type: "all_students", created_by: staffByKey.accountant.user, created_at: ago(4), readSome: true }, allActive);
  notify({ title: "Перенос урока", message: "Урок группы GE Pre-Intermediate B1-1 в субботу переносится на 15:00.", category: "schedule", recipient_type: "group", group: geB1.id, created_by: staffByKey.teacher.user, created_at: ago(2), readSome: true }, members[geB1.id]);
  notify({ title: "Новое задание опубликовано", message: "Опубликовано задание «Подготовка к контрольной». Срок — через 3 дня.", category: "announcement", recipient_type: "group", group: geB1.id, created_by: staffByKey.teacher.user, created_at: ago(1), metadata: { route: "homework", homework_id: t.homeworks.find((h) => h.group === geB1.id && h.title.startsWith("Подготовка"))?.id } }, members[geB1.id]);
  notify({ title: "Открыт тест по словарю", message: "Доступен тест «Food & Drinks». У вас 2 попытки, проходной балл 70%.", category: "announcement", recipient_type: "group", group: geB1.id, created_by: staffByKey.teacher.user, created_at: ago(2, "09:05"), metadata: { route: "vocab", exam_id: examOpen.id } }, members[geB1.id]);
  const mathStudents = t.enrollments
    .filter((e) => e.status === "active" && groupRows.some((g) => g.id === e.group && g.course === courseByKey.math.id))
    .map((e) => t.students.find((s) => s.id === e.student));
  notify({ title: "Пробный тест DTM в субботу", message: "В субботу в 10:00 — пробный тест DTM для групп математики. Возьмите калькулятор и черновик.", category: "announcement", priority: "important", recipient_type: "course", course: courseByKey.math.id, created_by: staffByKey.t3.user, created_at: ago(0, "08:30") }, mathStudents);

  ["sent", "sent", "sent", "failed", "pending"].forEach((status, index) => {
    const student = allActive[index * 4];
    t.outbox.push({
      id: id(), tenant: mainTenantId, contact: null, template: null,
      rendered_body: index < 3 ? `${student.full_name}, напоминаем: оплата за месяц до 10 числа.` : `Урок перенесён: ${student.full_name}, проверьте расписание.`,
      payload: { student: student.id }, status, attempts: status === "failed" ? 3 : 1, next_attempt_at: null,
      last_error: status === "failed" ? "Telegram: chat not found" : "", sent_at: status === "sent" ? ago(index + 1) : null, created_at: ago(index + 1),
    });
  });

  /* ---------- payroll ---------- */
  Object.values(staffByKey).forEach((membership) => {
    if (membership.role === "owner") return;
    const rate = Number(membership.salary_rate);
    const accrued = membership.payment_type === "per_lesson" ? rate * between(18, 26) : membership.payment_type === "hourly" ? rate * between(40, 60) : rate;
    [-2, -1, 0].forEach((offset) => {
      const period = monthStart(offset);
      const paidOut = offset < 0;
      t.salaryRecords.push({
        id: id(), tenant: mainTenantId, membership: membership.id, period: isoDate(period), accrued_amount: `${accrued}.00`,
        paid_amount: paidOut ? `${accrued}.00` : "0.00", paid_at: paidOut ? isoDate(new Date(period.getFullYear(), period.getMonth() + 1, 5)) : null,
        status: paidOut ? "paid" : "unpaid", notes: "", ...stamp(iso(period)),
      });
    });
    membership.last_payout_at = isoDate(new Date(today.getFullYear(), today.getMonth(), 5));
    membership.last_payout_amount = `${accrued}.00`;
  });

  /* Students of other centres, only visible in the platform (super admin) cabinet. */
  otherTenantIds.forEach((tenantId, index) => {
    for (let i = 0; i < 3; i += 1) {
      const name = personName();
      t.students.push({ id: id(), tenant: tenantId, full_name: name.full, birth_date: "2007-05-05", phone: phone(), email: "", status: i === 2 && index % 2 ? "inactive" : "active", notes: "", user: null, ...stamp(ago(between(10, 90))) });
    }
  });

  // Group rows keep their catalog spec only while seeding.
  t.groups.forEach((group) => {
    delete group.demo;
  });
  return t;
}
