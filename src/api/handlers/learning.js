/* Homework, teaching materials and vocabulary (lists, exams, attempts, Leitner practice). */
import { findById, insert, nowIso, patch, remove, table, uuid } from "../db";
import { forbidden, invalid, listResponse, notFound } from "../http";
import { crud, inTenant, route } from "../router";
import { isStaff, isStudent, isTeacher, studentGroupIds, teacherGroupIds } from "../context";
import {
  attemptOut,
  deadlinePassed,
  editBlockReason,
  examState,
  homeworkOut,
  materialOut,
  submissionOut,
  vocabExamOut,
  vocabListOut,
  wordOut,
} from "../serializers";

const TEACHING = ["owner", "admin", "teacher"];

/* ---------- homework ---------- */

function homeworkScope(ctx) {
  const rows = inTenant(ctx, "homeworks");
  if (isStudent(ctx)) {
    const groups = studentGroupIds(ctx);
    return rows.filter((h) => h.is_published && groups.has(h.group));
  }
  if (isTeacher(ctx)) {
    const groups = teacherGroupIds(ctx);
    return rows.filter((h) => groups.has(h.group));
  }
  return rows;
}

function getHomework(ctx) {
  const hw = homeworkScope(ctx).find((h) => h.id === ctx.params.id);
  if (!hw) throw notFound();
  return hw;
}

route("POST", "/homeworks/:id/attachments", (ctx) => {
  const hw = getHomework(ctx);
  const body = ctx.body || {};
  const file = body.file;
  if (!file?.url && !body.url) throw invalid({ detail: "Прикрепите файл или ссылку." });
  const item = {
    id: uuid(), title: body.title || file?.name || body.url, url: file ? "" : body.url, original_name: file?.name || "",
    size: file?.size ?? null, download_url: file?.url || null, created_at: nowIso(),
  };
  patch("homeworks", hw.id, { attachments: [...(hw.attachments || []), item] });
  return { status: 201, data: item };
});

route("DELETE", "/homeworks/:id/attachments/:attachmentId", (ctx) => {
  const hw = getHomework(ctx);
  patch("homeworks", hw.id, { attachments: (hw.attachments || []).filter((a) => a.id !== ctx.params.attachmentId) });
  return { status: 204, data: null };
});

route("GET", "/homeworks/:id/submissions", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const hw = getHomework(ctx);
  const handed = new Map(
    inTenant(ctx, "submissions")
      .filter((s) => s.homework === hw.id && s.status !== "draft")
      .map((s) => [s.student, s]),
  );
  const row = (student, sub) => ({
    id: sub?.id || null, student: student.id, student_name: student.full_name, status: sub?.status || "missing", text: sub?.text || "",
    link: sub?.link || "", files: sub ? submissionOut(sub).files : [], submitted_at: sub?.submitted_at || null, attempt: sub?.attempt || 0,
    score: sub?.score ?? null, feedback: sub?.feedback || "", graded_at: sub?.graded_at || null,
  });
  const active = inTenant(ctx, "enrollments")
    .filter((e) => e.group === hw.group && e.status === "active")
    .map((e) => findById("students", e.student))
    .filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
  const rows = active.map((student) => {
    const sub = handed.get(student.id);
    handed.delete(student.id);
    return row(student, sub);
  });
  handed.forEach((sub) => rows.push(row(findById("students", sub.student) || { id: sub.student, full_name: "" }, sub)));
  return rows;
});

route("POST", "/homeworks/:id/remind", (ctx) => {
  const hw = getHomework(ctx);
  const handed = new Set(inTenant(ctx, "submissions").filter((s) => s.homework === hw.id && s.status !== "draft").map((s) => s.student));
  const sent = inTenant(ctx, "enrollments").filter((e) => e.group === hw.group && e.status === "active" && !handed.has(e.student)).length;
  return { sent };
});

route("PUT", "/homeworks/:id/my-submission", (ctx) => {
  if (!isStudent(ctx) || !ctx.student) throw forbidden();
  const hw = getHomework(ctx);
  const body = ctx.body || {};
  let sub = inTenant(ctx, "submissions").find((s) => s.homework === hw.id && s.student === ctx.student.id);
  if (sub) {
    const reason = editBlockReason(sub);
    if (reason) throw invalid({ detail: reason });
  }
  const fields = {};
  if ("text" in body) fields.text = body.text || "";
  if ("link" in body) fields.link = body.link || "";
  if (!sub) {
    sub = insert("submissions", { tenant: ctx.tenantId, homework: hw.id, student: ctx.student.id, status: "draft", text: "", link: "", files: [], submitted_at: null, attempt: 0, score: null, feedback: "", graded_at: null, ...fields });
  } else {
    // Editing a handed-in work (resubmit allowed) turns it back into a draft.
    if (["submitted", "late"].includes(sub.status)) fields.status = "draft";
    sub = patch("submissions", sub.id, fields);
  }
  return submissionOut(sub);
});

crud("/homeworks", {
  tableName: "homeworks",
  writeRoles: TEACHING,
  ordering: "-created_at",
  out: homeworkOut,
  scope: homeworkScope,
  create: (ctx, body) => {
    if (!body.group) throw invalid({ group: ["Выберите группу."] });
    if (!String(body.title || "").trim()) throw invalid({ title: ["Обязательное поле."] });
    if (isTeacher(ctx) && !teacherGroupIds(ctx).has(body.group)) throw forbidden("Можно публиковать только в своих группах.");
    const published = body.is_published ?? true;
    return insert("homeworks", {
      tenant: ctx.tenantId, group: body.group, lesson: body.lesson || null, title: body.title, description: body.description || "",
      due_at: body.due_at || null, max_score: body.max_score === "" || body.max_score == null ? null : Number(body.max_score),
      allow_late: body.allow_late ?? true, allow_resubmit: body.allow_resubmit ?? true, is_published: published,
      published_at: published ? nowIso() : null, attachments: [], created_by: ctx.user?.id || null,
    });
  },
  update: (ctx, row, body) => {
    const changes = { ...body };
    if (changes.is_published && !row.published_at) changes.published_at = nowIso();
    if ("max_score" in changes) changes.max_score = changes.max_score === "" || changes.max_score == null ? null : Number(changes.max_score);
    return patch("homeworks", row.id, changes);
  },
  destroy: (ctx, row) => {
    if (inTenant(ctx, "submissions").some((s) => s.homework === row.id && s.status !== "draft")) {
      throw invalid({ detail: "Есть сданные работы — снимите задание с публикации вместо удаления." });
    }
    remove("homeworks", row.id);
  },
});

function submissionScope(ctx) {
  const rows = inTenant(ctx, "submissions");
  if (isStudent(ctx)) {
    const visible = new Set(homeworkScope(ctx).map((h) => h.id));
    return rows.filter((s) => s.student === ctx.student?.id && visible.has(s.homework));
  }
  const staffRows = rows.filter((s) => s.status !== "draft");
  if (isTeacher(ctx)) {
    const visible = new Set(homeworkScope(ctx).map((h) => h.id));
    return staffRows.filter((s) => visible.has(s.homework));
  }
  return staffRows;
}

function getSubmission(ctx) {
  const sub = submissionScope(ctx).find((s) => s.id === ctx.params.id);
  if (!sub) throw notFound();
  return sub;
}

route("POST", "/homework-submissions/:id/files", (ctx) => {
  if (!isStudent(ctx)) throw forbidden();
  const sub = getSubmission(ctx);
  const reason = editBlockReason(sub);
  if (reason) throw invalid({ detail: reason });
  const file = ctx.body?.file;
  if (!file?.url) throw invalid({ file: ["Прикрепите файл."] });
  if ((sub.files || []).length >= 10) throw invalid({ file: ["Не больше 10 файлов."] });
  const item = { id: uuid(), original_name: file.name, size: file.size, content_type: file.type || "", download_url: file.url, created_at: nowIso() };
  const changes = { files: [...(sub.files || []), item] };
  if (["submitted", "late"].includes(sub.status)) changes.status = "draft";
  patch("submissions", sub.id, changes);
  return { status: 201, data: item };
});

route("DELETE", "/homework-submissions/:id/files/:fileId", (ctx) => {
  const sub = getSubmission(ctx);
  patch("submissions", sub.id, { files: (sub.files || []).filter((f) => f.id !== ctx.params.fileId) });
  return { status: 204, data: null };
});

route("POST", "/homework-submissions/:id/submit", (ctx) => {
  if (!isStudent(ctx)) throw forbidden();
  const sub = getSubmission(ctx);
  if (["submitted", "late"].includes(sub.status)) throw invalid({ detail: "Работа уже сдана." });
  const reason = editBlockReason(sub);
  if (reason) throw invalid({ detail: reason });
  if (!(String(sub.text || "").trim() || sub.link || (sub.files || []).length)) {
    throw invalid({ detail: "Добавьте текст, ссылку или файл перед сдачей." });
  }
  const hw = findById("homeworks", sub.homework);
  return submissionOut(
    patch("submissions", sub.id, { status: deadlinePassed(hw) ? "late" : "submitted", submitted_at: nowIso(), attempt: (sub.attempt || 0) + 1 }),
  );
});

route("POST", "/homework-submissions/:id/grade", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const sub = getSubmission(ctx);
  const hw = findById("homeworks", sub.homework);
  const score = ctx.body?.score === "" || ctx.body?.score == null ? null : Number(ctx.body.score);
  if (score != null && hw?.max_score != null && score > hw.max_score) throw invalid({ score: [`Не больше ${hw.max_score}.`] });
  return submissionOut(patch("submissions", sub.id, { status: "graded", score, feedback: ctx.body?.feedback || "", graded_at: nowIso() }));
});

route("POST", "/homework-submissions/:id/return", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const sub = getSubmission(ctx);
  if (!String(ctx.body?.feedback || "").trim()) throw invalid({ feedback: ["Напишите, что доработать."] });
  return submissionOut(patch("submissions", sub.id, { status: "returned", feedback: ctx.body.feedback, score: null, graded_at: nowIso() }));
});

crud("/homework-submissions", {
  tableName: "submissions",
  readOnly: true,
  ordering: "-submitted_at",
  out: submissionOut,
  scope: submissionScope,
});

/* ---------- teaching materials ---------- */

function materialScope(ctx) {
  const rows = inTenant(ctx, "materials");
  if (isStudent(ctx)) {
    const groups = studentGroupIds(ctx);
    const courses = new Set(inTenant(ctx, "groups").filter((g) => groups.has(g.id)).map((g) => g.course));
    return rows.filter((m) => m.status === "published" && (groups.has(m.group) || (!m.group && courses.has(m.course))));
  }
  if (isTeacher(ctx)) return rows.filter((m) => m.teacher === ctx.membership.id);
  return rows;
}

function materialFields(body) {
  const fields = { ...body };
  if (fields.file && typeof fields.file === "object") {
    fields.file_size = fields.file.size;
    fields.file = fields.file.url;
  }
  if ("is_published" in fields && !("status" in body)) {
    fields.status = fields.is_published === true || fields.is_published === "true" ? "published" : "draft";
  }
  delete fields.is_published;
  ["group", "course"].forEach((key) => {
    if (fields[key] === "" || fields[key] === "null") fields[key] = null;
  });
  return fields;
}

function getMaterial(ctx) {
  const material = materialScope(ctx).find((m) => m.id === ctx.params.id);
  if (!material) throw notFound();
  return material;
}

route("POST", "/materials/:id/publish", (ctx) => materialOut(patch("materials", getMaterial(ctx).id, { status: "published" })));
route("POST", "/materials/:id/archive", (ctx) => materialOut(patch("materials", getMaterial(ctx).id, { status: "archived" })));
route("POST", "/materials/:id/duplicate", (ctx) => {
  const { id, created_at, updated_at, ...rest } = getMaterial(ctx);
  return { status: 201, data: materialOut(insert("materials", { ...rest, title: `${rest.title} (копия)`, status: "draft" })) };
});

crud("/materials", {
  tableName: "materials",
  writeRoles: TEACHING,
  search: ["title", "topic"],
  ordering: "-created_at",
  out: materialOut,
  scope: materialScope,
  create: (ctx, body) => {
    const fields = materialFields(body);
    if (!String(fields.title || "").trim()) throw invalid({ title: ["Обязательное поле."] });
    const type = fields.material_type || "file";
    if (["link", "video"].includes(type) && !fields.link) throw invalid({ link: ["URL is required."] });
    if (type === "text" && !String(fields.text_content || "").trim()) throw invalid({ text_content: ["Text content is required."] });
    const user = ctx.user;
    return insert("materials", {
      tenant: ctx.tenantId, teacher: ctx.membership?.id || null, group: null, course: null, description: "", file: null, link: "",
      text_content: "", topic: "", level: "", author: user ? `${user.first_name} ${user.last_name}`.trim() : "", status: "draft",
      ...fields, material_type: type,
    });
  },
  update: (ctx, row, body) => patch("materials", row.id, materialFields(body)),
});

/* ---------- vocabulary lists ---------- */

function listScope(ctx) {
  const rows = inTenant(ctx, "vocabLists");
  if (isStudent(ctx)) {
    const groups = studentGroupIds(ctx);
    const courses = new Set(inTenant(ctx, "groups").filter((g) => groups.has(g.id)).map((g) => g.course));
    return rows.filter((l) => l.is_published && (groups.has(l.group) || (!l.group && courses.has(l.course))));
  }
  if (isTeacher(ctx)) {
    const groups = teacherGroupIds(ctx);
    return rows.filter((l) => l.created_by === ctx.user?.id || groups.has(l.group));
  }
  return rows;
}

function getList(ctx) {
  const list = listScope(ctx).find((l) => l.id === ctx.params.id);
  if (!list) throw notFound();
  return list;
}

const wordsOf = (listId) => table("vocabWords").filter((w) => w.list === listId).sort((a, b) => a.order - b.order);

/** Text of an uploaded .txt/.csv: small uploads arrive as base64 data: URLs. */
function decodeUpload(file) {
  const url = String(file?.url || "");
  const match = /^data:[^,]*;base64,(.*)$/.exec(url);
  if (!match) return "";
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

route("GET", "/vocab-lists/:id/words", (ctx) => wordsOf(getList(ctx).id).map(wordOut));

route("POST", "/vocab-lists/:id/words", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const list = getList(ctx);
  const body = ctx.body || {};
  if (!String(body.term || "").trim() || !String(body.translation || "").trim()) throw invalid({ term: ["Укажите слово и перевод."] });
  const word = insert("vocabWords", {
    tenant: ctx.tenantId, list: list.id, term: body.term.trim(), translation: body.translation.trim(), transcription: body.transcription || "",
    example: body.example || "", part_of_speech: body.part_of_speech || "", order: body.order || wordsOf(list.id).length + 1,
  });
  return { status: 201, data: wordOut(word) };
});

function updateWord(ctx) {
  if (!isStaff(ctx)) throw forbidden();
  const list = getList(ctx);
  const word = wordsOf(list.id).find((w) => w.id === ctx.params.wordId);
  if (!word) throw notFound();
  return wordOut(patch("vocabWords", word.id, ctx.body || {}));
}
route("PATCH", "/vocab-lists/:id/words/:wordId", updateWord);
route("PUT", "/vocab-lists/:id/words/:wordId", updateWord);

route("DELETE", "/vocab-lists/:id/words/:wordId", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  getList(ctx);
  remove("vocabWords", ctx.params.wordId);
  return { status: 204, data: null };
});

route("POST", "/vocab-lists/:id/import", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const list = getList(ctx);
  const text = ctx.body?.text || decodeUpload(ctx.body?.file);
  const existing = new Set(wordsOf(list.id).map((w) => w.term.toLowerCase()));
  let created = 0;
  let skipped = 0;
  const errors = [];
  String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const parts = line.split(/\t|;|\s+[-–—]\s+|,/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) {
        errors.push({ line: index + 1, error: "Нужно «слово — перевод»." });
        return;
      }
      if (existing.has(parts[0].toLowerCase())) {
        skipped += 1;
        return;
      }
      existing.add(parts[0].toLowerCase());
      insert("vocabWords", { tenant: ctx.tenantId, list: list.id, term: parts[0], translation: parts[1], transcription: parts[2] || "", example: parts[3] || "", part_of_speech: "", order: wordsOf(list.id).length + 1 });
      created += 1;
    });
  return { created, skipped, errors };
});

crud("/vocab-lists", {
  tableName: "vocabLists",
  writeRoles: TEACHING,
  search: ["title"],
  ordering: "-created_at",
  out: vocabListOut,
  scope: listScope,
  create: (ctx, body) => {
    if (!String(body.title || "").trim()) throw invalid({ title: ["Обязательное поле."] });
    return insert("vocabLists", {
      tenant: ctx.tenantId, course: body.course || null, group: body.group || null, title: body.title, level: body.level || "",
      description: body.description || "", is_published: body.is_published ?? true, created_by: ctx.user?.id || null,
    });
  },
  destroy: (ctx, row) => {
    wordsOf(row.id).forEach((w) => remove("vocabWords", w.id));
    remove("vocabLists", row.id);
  },
});

/* ---------- vocabulary exams and attempts ---------- */

function examScope(ctx) {
  const rows = inTenant(ctx, "vocabExams");
  if (isStudent(ctx)) {
    const groups = studentGroupIds(ctx);
    return rows.filter((e) => e.is_published && groups.has(e.group));
  }
  if (isTeacher(ctx)) {
    const groups = teacherGroupIds(ctx);
    return rows.filter((e) => groups.has(e.group));
  }
  return rows;
}

function getExam(ctx) {
  const exam = examScope(ctx).find((e) => e.id === ctx.params.id);
  if (!exam) throw notFound();
  return exam;
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildQuestions(exam) {
  const words = wordsOf(exam.list);
  const chosen = (exam.shuffle ? shuffle(words) : words).slice(0, Math.min(exam.questions_count || words.length, words.length));
  return chosen.map((word, index) => {
    const direction = exam.direction === "both" ? (index % 2 ? "translation_to_term" : "term_to_translation") : exam.direction;
    const type = exam.mode === "mixed" ? (index % 3 === 2 ? "typing" : "choice") : exam.mode;
    const forward = direction === "term_to_translation";
    const expected = forward ? word.translation : word.term;
    const pool = shuffle(words.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => (forward ? w.translation : w.term));
    return {
      id: uuid(), order: index + 1, word: word.id, question_type: type, direction, prompt: forward ? word.term : word.translation,
      options: type === "choice" ? shuffle([expected, ...pool]) : [], given_answer: "", answered_at: null, expected, is_correct: null,
    };
  });
}

function finishAttempt(attempt) {
  const answers = (attempt.answers || []).map((q) => ({
    ...q,
    is_correct: String(q.given_answer || "").trim().toLowerCase() === String(q.expected || "").trim().toLowerCase(),
  }));
  const correct = answers.filter((q) => q.is_correct).length;
  const total = answers.length;
  return patch("vocabAttempts", attempt.id, {
    answers, status: "finished", finished_at: nowIso(), correct_count: correct, total, score_percent: total ? Math.round((correct / total) * 100) : 0,
  });
}

route("POST", "/vocab-exams/:id/start", (ctx) => {
  if (!isStudent(ctx) || !ctx.student) throw forbidden();
  const exam = getExam(ctx);
  const mine = inTenant(ctx, "vocabAttempts").filter((a) => a.exam === exam.id && a.student === ctx.student.id);
  const open = mine.find((a) => a.status === "in_progress");
  if (open) return { status: 201, data: attemptOut(open) };
  if (examState(exam) !== "open") throw invalid({ detail: "Тест сейчас недоступен." });
  if (exam.attempts_allowed && mine.length >= exam.attempts_allowed) throw invalid({ detail: "Попытки закончились." });
  const now = new Date();
  const attempt = insert("vocabAttempts", {
    tenant: ctx.tenantId, exam: exam.id, student: ctx.student.id, status: "in_progress", started_at: now.toISOString(),
    deadline_at: exam.time_limit_sec ? new Date(now.getTime() + exam.time_limit_sec * 1000).toISOString() : null,
    finished_at: null, score_percent: null, correct_count: null, total: null, answers: buildQuestions(exam),
  });
  return { status: 201, data: attemptOut(attempt) };
});

route("GET", "/vocab-exams/:id/results", (ctx) => {
  if (!isStaff(ctx)) throw forbidden();
  const exam = getExam(ctx);
  const attempts = inTenant(ctx, "vocabAttempts").filter((a) => a.exam === exam.id);
  const students = inTenant(ctx, "enrollments")
    .filter((e) => e.group === exam.group && e.status === "active")
    .map((e) => findById("students", e.student))
    .filter(Boolean);
  attempts.forEach((a) => {
    if (!students.some((s) => s.id === a.student)) {
      const student = findById("students", a.student);
      if (student) students.push(student);
    }
  });
  return students
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"))
    .map((student) => {
      const mine = attempts.filter((a) => a.student === student.id);
      const done = mine.filter((a) => a.status !== "in_progress");
      const best = done.reduce((top, a) => (!top || (a.score_percent || 0) > (top.score_percent || 0) ? a : top), null);
      return {
        student: student.id, student_name: student.full_name, status: done.length ? "done" : mine.length ? "in_progress" : "not_started",
        attempts_used: done.length, best_score: best ? best.score_percent : null, passed: best ? best.score_percent >= exam.pass_score : null,
        last_finished_at: done.map((a) => a.finished_at).sort().slice(-1)[0] || null, best_attempt: best ? best.id : null,
      };
    });
});

crud("/vocab-exams", {
  tableName: "vocabExams",
  writeRoles: TEACHING,
  ordering: "-created_at",
  out: vocabExamOut,
  scope: examScope,
  create: (ctx, body) => {
    const list = findById("vocabLists", body.list);
    if (!list) throw invalid({ list: ["Выберите словарь."] });
    return insert("vocabExams", {
      tenant: ctx.tenantId, list: list.id, group: body.group || list.group, title: body.title || `Тест: ${list.title}`, mode: body.mode || "choice",
      direction: body.direction || "term_to_translation", questions_count: Number(body.questions_count) || 10, time_limit_sec: Number(body.time_limit_sec) || 600,
      opens_at: body.opens_at || nowIso(), closes_at: body.closes_at || null, attempts_allowed: body.attempts_allowed === "" ? null : Number(body.attempts_allowed) || null,
      pass_score: Number(body.pass_score) || 60, shuffle: body.shuffle ?? true, is_published: body.is_published ?? true, created_by: ctx.user?.id || null,
    });
  },
});

function attemptScope(ctx) {
  const rows = inTenant(ctx, "vocabAttempts");
  if (isStudent(ctx)) return rows.filter((a) => a.student === ctx.student?.id);
  const exams = new Set(examScope(ctx).map((e) => e.id));
  return rows.filter((a) => exams.has(a.exam));
}

function getAttempt(ctx) {
  let attempt = attemptScope(ctx).find((a) => a.id === ctx.params.id);
  if (!attempt) throw notFound();
  if (attempt.status === "in_progress" && attempt.deadline_at && new Date(attempt.deadline_at) < new Date()) {
    attempt = finishAttempt(attempt);
  }
  return attempt;
}

route("GET", "/vocab-attempts/:id", (ctx) => attemptOut(getAttempt(ctx)));

route("PUT", "/vocab-attempts/:id/answers/:answerId", (ctx) => {
  const attempt = getAttempt(ctx);
  if (attempt.status !== "in_progress") throw invalid({ detail: "Попытка уже завершена." });
  const answers = (attempt.answers || []).map((q) =>
    q.id === ctx.params.answerId ? { ...q, given_answer: String(ctx.body?.given_answer ?? ""), answered_at: nowIso() } : q,
  );
  const saved = patch("vocabAttempts", attempt.id, { answers }).answers.find((q) => q.id === ctx.params.answerId);
  if (!saved) throw notFound();
  return { id: saved.id, order: saved.order, question_type: saved.question_type, direction: saved.direction, prompt: saved.prompt, options: saved.options, given_answer: saved.given_answer, answered_at: saved.answered_at };
});

route("POST", "/vocab-attempts/:id/finish", (ctx) => {
  const attempt = getAttempt(ctx);
  return attemptOut(attempt.status === "in_progress" ? finishAttempt(attempt) : attempt);
});

route("GET", "/vocab-attempts", (ctx) => listResponse(attemptScope(ctx).map((a) => attemptOut(a, { detail: false })), ctx, { ordering: "-started_at" }));

/* ---------- Leitner practice ---------- */

const BOX_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

function practiceWords(ctx) {
  const lists = new Set(listScope(ctx).map((l) => l.id));
  return inTenant(ctx, "vocabWords").filter((w) => lists.has(w.list));
}

route("GET", "/vocab-practice", (ctx) => {
  if (!isStudent(ctx) || !ctx.student) throw invalid({ detail: "Профиль ученика не найден." });
  const listId = ctx.query.get("list");
  const words = new Map(practiceWords(ctx).filter((w) => !listId || w.list === listId).map((w) => [w.id, w]));
  const now = new Date().toISOString();
  const due = inTenant(ctx, "vocabProgress").filter((p) => p.student === ctx.student.id && words.has(p.word) && p.next_review_at <= now);
  const cards = due.map((p) => {
    const word = words.get(p.word);
    const list = findById("vocabLists", word.list);
    return { ...wordOut(word), list_title: list?.title || "", box: p.box };
  });
  return { due_count: cards.length, cards };
});

route("POST", "/vocab-practice/review", (ctx) => {
  if (!isStudent(ctx) || !ctx.student) throw forbidden();
  const word = practiceWords(ctx).find((w) => w.id === ctx.body?.word_id);
  if (!word) throw notFound();
  const progress = inTenant(ctx, "vocabProgress").find((p) => p.student === ctx.student.id && p.word === word.id);
  const box = ctx.body?.known ? Math.min((progress?.box || 1) + 1, 5) : 1;
  const next = new Date(Date.now() + BOX_DAYS[box] * 86400000 + (box === 1 ? 10 * 60000 : 0)).toISOString();
  const saved = progress
    ? patch("vocabProgress", progress.id, { box, next_review_at: next })
    : insert("vocabProgress", { tenant: ctx.tenantId, student: ctx.student.id, word: word.id, box, next_review_at: next });
  return { word: word.id, box: saved.box, next_review_at: saved.next_review_at };
});

route("POST", "/vocab-practice/add", (ctx) => {
  if (!isStudent(ctx) || !ctx.student) throw forbidden();
  const ids = new Set((ctx.body?.word_ids || []).map(String));
  const known = new Set(inTenant(ctx, "vocabProgress").filter((p) => p.student === ctx.student.id).map((p) => p.word));
  let added = 0;
  practiceWords(ctx)
    .filter((w) => ids.has(w.id) && !known.has(w.id))
    .forEach((w) => {
      insert("vocabProgress", { tenant: ctx.tenantId, student: ctx.student.id, word: w.id, box: 1, next_review_at: nowIso() });
      added += 1;
    });
  return { added };
});
