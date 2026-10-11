/* Courses, rooms, groups, enrollments, students, guardians, lessons and attendance. */
import { findById, insert, nowIso, patch, table } from "../db";
import { forbidden, invalid, listResponse, notFound } from "../http";
import { crud, inTenant, route } from "../router";
import { isStudent, isTeacher, studentGroupIds, teacherGroupIds } from "../context";
import {
  attendanceHistoryOut,
  attendanceOut,
  courseOut,
  enrollmentOut,
  groupOut,
  guardianOut,
  lessonOut,
  roomOut,
  studentGuardianOut,
  studentOut,
} from "../serializers";

const MANAGERS = ["owner", "admin"];
const TRIAL_MARKER = "ПРОБНЫЙ";

function tempPassword() {
  return `Yg-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ---------- courses / rooms / groups ---------- */

crud("/courses", {
  tableName: "courses",
  writeRoles: MANAGERS,
  search: ["name"],
  ordering: "name",
  out: courseOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "courses");
    if (isStudent(ctx)) {
      const groups = studentGroupIds(ctx);
      const ids = new Set(inTenant(ctx, "groups").filter((g) => groups.has(g.id)).map((g) => g.course));
      return rows.filter((c) => ids.has(c.id));
    }
    if (isTeacher(ctx)) {
      const ids = new Set(inTenant(ctx, "groups").filter((g) => g.teacher === ctx.membership.id).map((g) => g.course));
      return rows.filter((c) => ids.has(c.id));
    }
    return rows;
  },
  create: (ctx, body) => {
    if (!String(body.name || "").trim()) throw invalid({ name: ["Обязательное поле."] });
    return insert("courses", { tenant: ctx.tenantId, name: body.name, description: body.description || "", price: String(body.price ?? "0"), currency: body.currency || "UZS", is_active: body.is_active ?? true });
  },
});

crud("/rooms", {
  tableName: "rooms",
  writeRoles: MANAGERS,
  search: ["name"],
  ordering: "name",
  out: roomOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "rooms");
    if (isStudent(ctx)) {
      const groups = studentGroupIds(ctx);
      const ids = new Set(inTenant(ctx, "lessons").filter((l) => groups.has(l.group)).map((l) => l.room));
      return rows.filter((r) => ids.has(r.id));
    }
    return rows;
  },
  create: (ctx, body) => insert("rooms", { tenant: ctx.tenantId, name: body.name, capacity: Number(body.capacity) || 10, is_active: body.is_active ?? true }),
});

crud("/groups", {
  tableName: "groups",
  writeRoles: MANAGERS,
  search: ["name"],
  ordering: "name",
  out: groupOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "groups");
    if (isStudent(ctx)) {
      const ids = studentGroupIds(ctx);
      return rows.filter((g) => ids.has(g.id));
    }
    if (isTeacher(ctx)) return rows.filter((g) => g.teacher === ctx.membership.id);
    return rows;
  },
  create: (ctx, body) => {
    if (!body.course) throw invalid({ course: ["Выберите курс."] });
    if (!String(body.name || "").trim()) throw invalid({ name: ["Обязательное поле."] });
    return insert("groups", {
      tenant: ctx.tenantId, course: body.course, name: body.name, teacher: body.teacher || null, capacity: Number(body.capacity) || 12,
      room: body.room || null, start_date: body.start_date || null, end_date: body.end_date || null, status: body.status || "planned",
    });
  },
});

crud("/enrollments", {
  tableName: "enrollments",
  writeRoles: MANAGERS,
  out: enrollmentOut,
  ordering: "-created_at",
  scope: (ctx) => {
    const rows = inTenant(ctx, "enrollments");
    if (isStudent(ctx)) return ctx.student ? rows.filter((e) => e.student === ctx.student.id) : [];
    if (isTeacher(ctx)) {
      const ids = teacherGroupIds(ctx);
      return rows.filter((e) => ids.has(e.group));
    }
    return rows;
  },
  create: (ctx, body) => {
    if (!body.student || !body.group) throw invalid({ non_field_errors: ["Student and group are required."] });
    const existing = inTenant(ctx, "enrollments").find((e) => e.student === body.student && e.group === body.group && e.status === "active");
    if (existing) return existing;
    return insert("enrollments", { tenant: ctx.tenantId, student: body.student, group: body.group, status: "active", joined_at: body.joined_at || nowIso().slice(0, 10), ended_at: null });
  },
  update: (ctx, row, body) => {
    const changes = { ...body };
    if (changes.status === "cancelled" && !changes.ended_at) changes.ended_at = nowIso().slice(0, 10);
    return patch("enrollments", row.id, changes);
  },
});

/* ---------- students and guardians ---------- */

crud("/students", {
  tableName: "students",
  writeRoles: MANAGERS,
  search: ["full_name", "phone", "email"],
  ordering: "full_name",
  out: studentOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "students");
    if (isStudent(ctx)) return ctx.student ? rows.filter((s) => s.id === ctx.student.id) : [];
    if (isTeacher(ctx)) {
      const groups = teacherGroupIds(ctx);
      const ids = new Set(inTenant(ctx, "enrollments").filter((e) => groups.has(e.group) && e.status === "active").map((e) => e.student));
      return rows.filter((s) => ids.has(s.id));
    }
    return rows;
  },
  create: (ctx, body) => {
    const phone = String(body.phone || "").trim();
    if (!phone) throw invalid({ phone: ["Телефон нужен для входа студента."] });
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) throw invalid({ phone: ["Проверьте номер телефона: нужно 9–15 цифр."] });
    const duplicate = inTenant(ctx, "students").find((s) => String(s.phone).replace(/\D/g, "") === digits);
    if (duplicate) throw invalid({ phone: [`Ученик с этим телефоном уже есть: «${duplicate.full_name}».`] });
    const row = insert("students", {
      tenant: ctx.tenantId, full_name: body.full_name || "Новый ученик", birth_date: body.birth_date || null, phone: `+${digits}`,
      email: body.email || "", status: body.status || "active", notes: body.notes || "", user: null,
    });
    return { ...row, temporary_password: tempPassword() };
  },
  update: (ctx, row, body) => {
    const { password, reset_temporary: reset, ...changes } = body || {};
    if (password && String(password).length < 8) throw invalid({ password: ["Пароль должен быть не короче 8 символов."] });
    const updated = patch("students", row.id, changes);
    return reset ? { ...updated, temporary_password: tempPassword() } : updated;
  },
});

crud("/guardians", {
  tableName: "guardians",
  writeRoles: MANAGERS,
  search: ["full_name", "phone", "email"],
  out: guardianOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "guardians");
    if (isStudent(ctx)) {
      const ids = new Set(inTenant(ctx, "studentGuardians").filter((l) => l.student === ctx.student?.id).map((l) => l.guardian));
      return rows.filter((g) => ids.has(g.id));
    }
    return rows;
  },
  create: (ctx, body) => insert("guardians", { tenant: ctx.tenantId, full_name: body.full_name || "", phone: body.phone || "", email: body.email || "" }),
});

crud("/student-guardians", {
  tableName: "studentGuardians",
  writeRoles: MANAGERS,
  out: studentGuardianOut,
  scope: (ctx) => {
    const rows = inTenant(ctx, "studentGuardians");
    if (isStudent(ctx)) return rows.filter((l) => l.student === ctx.student?.id);
    return rows;
  },
  create: (ctx, body) => insert("studentGuardians", { tenant: ctx.tenantId, student: body.student, guardian: body.guardian, relationship: body.relationship || "", is_primary: Boolean(body.is_primary) }),
});

/* ---------- lessons and attendance ---------- */

function lessonScope(ctx) {
  const rows = inTenant(ctx, "lessons");
  if (isStudent(ctx)) {
    const groups = studentGroupIds(ctx);
    return rows.filter((l) => groups.has(l.group) && !String(l.topic || "").toUpperCase().startsWith(TRIAL_MARKER));
  }
  if (isTeacher(ctx)) return rows.filter((l) => l.teacher === ctx.membership.id);
  return rows;
}

route("GET", "/lessons/:id/attendance", (ctx) => {
  const lesson = lessonScope(ctx).find((l) => l.id === ctx.params.id);
  if (!lesson) throw notFound();
  let marks = inTenant(ctx, "attendance").filter((a) => a.lesson === lesson.id);
  if (isStudent(ctx)) marks = marks.filter((a) => a.student === ctx.student?.id);
  return marks.map(attendanceOut);
});

route("PUT", "/lessons/:id/attendance", (ctx) => {
  if (isStudent(ctx)) throw forbidden("Students cannot mark attendance.");
  const lesson = lessonScope(ctx).find((l) => l.id === ctx.params.id);
  if (!lesson) throw notFound();
  const entries = ctx.body?.entries || [];
  if (!entries.length) throw invalid({ entries: ["Список не может быть пустым."] });
  const rows = table("attendance");
  const saved = entries.map((entry) => {
    const existing = rows.find((a) => a.lesson === lesson.id && a.student === entry.student);
    if (existing) {
      return patch("attendance", existing.id, { status: entry.status, comment: entry.comment || "", marked_by: ctx.user?.id || null });
    }
    return insert("attendance", { tenant: ctx.tenantId, lesson: lesson.id, student: entry.student, status: entry.status, comment: entry.comment || "", marked_by: ctx.user?.id || null });
  });
  return saved.map(attendanceOut);
});

crud("/lessons", {
  tableName: "lessons",
  writeRoles: ["owner", "admin", "teacher"],
  search: ["topic", "group_name"],
  ordering: "starts_at",
  out: lessonOut,
  scope: lessonScope,
  create: (ctx, body) => {
    const group = findById("groups", body.group);
    if (!group) throw invalid({ group: ["Выберите группу."] });
    if (!body.starts_at || !body.ends_at) throw invalid({ starts_at: ["Укажите время урока."] });
    if (new Date(body.ends_at) <= new Date(body.starts_at)) throw invalid({ ends_at: ["Конец должен быть позже начала."] });
    return insert("lessons", {
      tenant: ctx.tenantId, group: group.id, teacher: body.teacher || group.teacher, room: body.room || group.room || null, schedule_rule: null,
      starts_at: new Date(body.starts_at).toISOString(), ends_at: new Date(body.ends_at).toISOString(), topic: body.topic || "", status: body.status || "scheduled",
    });
  },
  update: (ctx, row, body) => {
    const changes = { ...body };
    if (changes.starts_at) changes.starts_at = new Date(changes.starts_at).toISOString();
    if (changes.ends_at) changes.ends_at = new Date(changes.ends_at).toISOString();
    return patch("lessons", row.id, changes);
  },
  // DELETE cancels the lesson instead of removing it (like LessonViewSet.perform_destroy).
  destroy: (ctx, row) => patch("lessons", row.id, { status: "cancelled" }),
});

route("GET", "/schedule-rules", (ctx) => listResponse([], ctx));

crud("/attendance", {
  tableName: "attendance",
  readOnly: true,
  out: attendanceHistoryOut,
  aliases: { lesson__group: "group" },
  ordering: "-lesson_starts_at",
  orderAliases: { lesson__starts_at: "lesson_starts_at" },
  scope: (ctx) => {
    const rows = inTenant(ctx, "attendance");
    if (isStudent(ctx)) return rows.filter((a) => a.student === ctx.student?.id);
    if (isTeacher(ctx)) {
      const lessons = new Set(inTenant(ctx, "lessons").filter((l) => l.teacher === ctx.membership.id).map((l) => l.id));
      return rows.filter((a) => lessons.has(a.lesson));
    }
    return rows;
  },
});
