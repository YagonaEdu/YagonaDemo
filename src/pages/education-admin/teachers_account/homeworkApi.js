import { api } from "@/services/api/client";
import { buildQuery, fetchAll } from "@/services/api/paginate";

/**
 * /homeworks rows for teacher screens. Backend counters:
 *   submitted_count — handed in and waiting for review (submitted + late),
 *   graded_count, returned_count, total_students (active enrollments).
 * The derived fields below are what the lists and summaries display.
 */
export function toHomeworkRow(homework) {
  const total = Number(homework.total_students || 0);
  const awaiting = Number(homework.submitted_count || 0);
  const graded = Number(homework.graded_count || 0);
  const returned = Number(homework.returned_count || 0);
  const handed = awaiting + graded + returned;
  return {
    ...homework,
    status: homework.is_published ? "published" : "draft",
    awaiting_count: awaiting,
    handed_count: handed,
    missing_count: Math.max(total - handed, 0),
  };
}

export async function listTeacherHomeworks(params = {}) {
  const rows = await fetchAll(`/homeworks${buildQuery({ page_size: 100, ...params })}`);
  return rows.map(toHomeworkRow);
}

/** One row per enrolled student; `id` is null and status "missing" when nothing was handed in. */
export function getHomeworkSubmissions(homeworkId) {
  return api.get(`/homeworks/${homeworkId}/submissions`);
}

export function saveHomework(homeworkId, payload) {
  return homeworkId
    ? api.patch(`/homeworks/${homeworkId}`, payload)
    : api.post("/homeworks", payload);
}

export function setHomeworkPublished(homeworkId, isPublished) {
  return api.patch(`/homeworks/${homeworkId}`, { is_published: isPublished });
}

export function addHomeworkFile(homeworkId, file) {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("title", file.name);
  return api.post(`/homeworks/${homeworkId}/attachments`, body);
}

export function addHomeworkLink(homeworkId, url, title = "") {
  return api.post(`/homeworks/${homeworkId}/attachments`, { url, title });
}

export function deleteHomeworkAttachment(homeworkId, attachmentId) {
  return api.del(`/homeworks/${homeworkId}/attachments/${attachmentId}`);
}

export function remindHomework(homeworkId) {
  return api.post(`/homeworks/${homeworkId}/remind`);
}

export function gradeHomeworkSubmission(submissionId, { score, feedback }) {
  return api.post(`/homework-submissions/${submissionId}/grade`, { score, feedback });
}

export function returnHomeworkSubmission(submissionId, feedback) {
  return api.post(`/homework-submissions/${submissionId}/return`, { feedback });
}

export function listGroupLessons(groupId) {
  return fetchAll(`/lessons${buildQuery({ group: groupId, page_size: 100, ordering: "starts_at" })}`);
}

/**
 * Homework in the shape older read-only screens (groups, dashboard, results, students) use:
 *   assignments: status "published" | "draft"; submitted_count = handed in incl. graded;
 *   submissions: `assignment` = homework id, plus a "not_submitted" placeholder for every
 *   active student of the group who hasn't handed in a published task.
 */
export async function loadHomeworkOverview() {
  const [homeworks, handed, enrollments] = await Promise.all([
    listTeacherHomeworks(),
    fetchAll(`/homework-submissions${buildQuery({ page_size: 100 })}`),
    fetchAll(`/enrollments${buildQuery({ page_size: 100, status: "active" })}`),
  ]);
  const assignments = homeworks.map((row) => ({
    ...row,
    submitted_count: row.awaiting_count + Number(row.graded_count || 0),
  }));
  const submissions = handed.map((row) => ({
    ...row,
    assignment: row.homework,
    teacher_feedback: row.feedback,
    text_answer: row.text,
  }));
  const done = new Set(submissions.map((row) => `${row.homework}:${row.student}`));
  for (const homework of assignments) {
    if (homework.status !== "published") continue;
    for (const enrollment of enrollments) {
      if (String(enrollment.group) !== String(homework.group)) continue;
      if (done.has(`${homework.id}:${enrollment.student}`)) continue;
      submissions.push({
        id: `missing-${homework.id}-${enrollment.student}`,
        assignment: homework.id,
        homework: homework.id,
        student: enrollment.student,
        status: "not_submitted",
        score: null,
        submitted_at: null,
      });
    }
  }
  return { assignments, submissions };
}
