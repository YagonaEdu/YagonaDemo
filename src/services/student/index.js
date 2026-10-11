import { ROLES } from "@/constants";
import { api, getSession, invalidateApiCache, setSession } from "@/services/api/client";
import { buildQuery as query, fetchAll } from "@/services/api/paginate";
import { rememberStudentTenant } from "@/services/auth";

export { fetchAll };

export function isTenantAccessError(error) {
  return error?.status === 404 && (error.payload?.code === "not_found" || !error.payload);
}

/** The backend scopes /students to the requesting student: at most one row. */
export async function getMyCard() {
  const data = await api.get("/students");
  return (data?.results || data || [])[0] || null;
}

export function listLessons(from, to) {
  return fetchAll(
    `/lessons${query({
      page_size: 100,
      ordering: "starts_at",
      starts_at_from: from?.toISOString(),
      starts_at_to: to?.toISOString(),
    })}`,
  );
}

export function listAttendance(params = {}) {
  return fetchAll(`/attendance${query({ page_size: 100, ...params })}`);
}

export function listSubscriptions() {
  return fetchAll(`/subscriptions${query({ page_size: 100 })}`);
}

export function listPlans() {
  return fetchAll(`/plans${query({ page_size: 100 })}`);
}

export function listInvoices() {
  return fetchAll(`/invoices${query({ page_size: 100, ordering: "-due_at" })}`);
}

export function listPayments() {
  return fetchAll(`/payments${query({ page_size: 100, ordering: "-paid_at" })}`);
}

export async function listMyGuardians() {
  const [guardians, links] = await Promise.all([
    fetchAll(`/guardians${query({ page_size: 100 })}`),
    fetchAll(`/student-guardians${query({ page_size: 100 })}`),
  ]);
  return guardians.map((guardian) => {
    const link = links.find((item) => String(item.guardian) === String(guardian.id));
    return { ...guardian, relationship: link?.relationship || "", is_primary: Boolean(link?.is_primary) };
  });
}

/** Re-reads /me/tenants so a newly added centre shows up without re-login. */
export async function refreshStudentMemberships() {
  const all = await api.get("/me/tenants", { tenant: false });
  const memberships = (all || []).filter((item) => item.role === ROLES.STUDENT);
  const session = getSession();
  const same =
    memberships.length === session.memberships.length &&
    memberships.every((item, index) => item.id === session.memberships[index]?.id);
  if (!same) setSession({ memberships });
  return memberships;
}

/** No backend "switch" API: change X-Tenant-ID and drop every cached response. */
export function switchStudentTenant(tenantId) {
  const membership = getSession().memberships.find(
    (item) => String(item.tenant_id) === String(tenantId),
  );
  if (!membership) return;
  invalidateApiCache();
  rememberStudentTenant(membership.tenant_id);
  setSession({ tenantId: String(membership.tenant_id), tenantSlug: membership.tenant_slug || "" });
}

/** Published homework of my groups; each row carries `my_submission` (or null). */
export function loadHomework() {
  return fetchAll(`/homeworks${query({ page_size: 100, ordering: "due_at" })}`);
}

export function getHomework(id) {
  return api.get(`/homeworks/${id}`);
}

/** Creates the draft on first call; text/link may be sent separately. */
export function saveHomeworkDraft(id, fields) {
  return api.put(`/homeworks/${id}/my-submission`, fields);
}

export function uploadSubmissionFile(submissionId, file) {
  const body = new FormData();
  body.append("file", file, file.name);
  return api.post(`/homework-submissions/${submissionId}/files`, body);
}

export function deleteSubmissionFile(submissionId, fileId) {
  return api.del(`/homework-submissions/${submissionId}/files/${fileId}`);
}

export function submitHomework(submissionId) {
  return api.post(`/homework-submissions/${submissionId}/submit`);
}

export function listMaterials() {
  return fetchAll(`/materials${query({ page_size: 100, ordering: "-created_at" })}`);
}

export function listGroups() {
  return fetchAll(`/groups${query({ page_size: 100 })}`);
}

export function listCourses() {
  return fetchAll(`/courses${query({ page_size: 100 })}`);
}

export async function listNotifications(params = {}) {
  const rows = await fetchAll(`/notifications${query({ page_size: 50, ...params })}`, 4);
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function unreadNotificationsCount() {
  const data = await api.get("/notifications/unread-count");
  return Number(data?.count || 0);
}

export function markNotificationRead(id) {
  return api.post(`/notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return api.post("/notifications/read-all");
}

/* ---------- vocabulary ---------- */

export function listVocabLists() {
  return fetchAll(`/vocab-lists${query({ page_size: 100 })}`);
}

export function getVocabList(id) {
  return api.get(`/vocab-lists/${id}`);
}

export function listVocabWords(id) {
  return api.get(`/vocab-lists/${id}/words`);
}

/** Today's Leitner cards: { due_count, cards }. Without a list — across all my lists. */
export function getPractice(listId) {
  return api.get(`/vocab-practice${query({ list: listId })}`);
}

export function reviewWord(wordId, known) {
  return api.post("/vocab-practice/review", { word_id: wordId, known });
}

export function addWordsToPractice(wordIds) {
  return api.post("/vocab-practice/add", { word_ids: wordIds });
}

export function listVocabExams() {
  return fetchAll(`/vocab-exams${query({ page_size: 100 })}`);
}

export function startVocabExam(examId) {
  return api.post(`/vocab-exams/${examId}/start`);
}

export function getVocabAttempt(attemptId) {
  return api.get(`/vocab-attempts/${attemptId}`);
}

export function saveVocabAnswer(attemptId, answerId, givenAnswer) {
  return api.put(`/vocab-attempts/${attemptId}/answers/${answerId}`, { given_answer: givenAnswer });
}

export function finishVocabAttempt(attemptId) {
  return api.post(`/vocab-attempts/${attemptId}/finish`);
}

export function getMe() {
  return api.get("/me", { tenant: false });
}

/** first_name, last_name, email, phone — the account (not the centre's student card). */
export function updateMe(fields) {
  return api.patch("/me", fields, { tenant: false });
}

export function changeMyPassword(currentPassword, newPassword) {
  return api.post(
    "/me/password",
    { current_password: currentPassword, new_password: newPassword },
    { tenant: false },
  );
}

export function uploadMyPhoto(file) {
  const body = new FormData();
  body.append("file", file, file.name);
  return api.post("/me/photo", body, { tenant: false });
}

export function deleteMyPhoto() {
  return api.del("/me/photo", { tenant: false });
}
