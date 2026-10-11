import { translated } from "@/i18n";
import { api } from "@/services/api/client";
import { buildQuery, fetchAll } from "@/services/api/paginate";

export function listVocabLists() {
  return fetchAll(`/vocab-lists${buildQuery({ page_size: 100 })}`);
}

export function saveVocabList(listId, payload) {
  return listId ? api.patch(`/vocab-lists/${listId}`, payload) : api.post("/vocab-lists", payload);
}

export function listVocabWords(listId) {
  return api.get(`/vocab-lists/${listId}/words`);
}

export function addVocabWord(listId, word) {
  return api.post(`/vocab-lists/${listId}/words`, word);
}

export function updateVocabWord(listId, wordId, word) {
  return api.patch(`/vocab-lists/${listId}/words/${wordId}`, word);
}

export function deleteVocabWord(listId, wordId) {
  return api.del(`/vocab-lists/${listId}/words/${wordId}`);
}

/** CSV "term;translation;example". Send a File or pasted text; returns { created, skipped, errors }. */
export function importVocabWords(listId, { file, text }) {
  if (file) {
    const body = new FormData();
    body.append("file", file, file.name);
    return api.post(`/vocab-lists/${listId}/import`, body);
  }
  return api.post(`/vocab-lists/${listId}/import`, { text });
}

export function listVocabExams() {
  return fetchAll(`/vocab-exams${buildQuery({ page_size: 100 })}`);
}

export function saveVocabExam(examId, payload) {
  return examId ? api.patch(`/vocab-exams/${examId}`, payload) : api.post("/vocab-exams", payload);
}

/** One row per student of the exam's group: status, attempts, best score, passed. */
export function getVocabExamResults(examId) {
  return api.get(`/vocab-exams/${examId}/results`);
}

export const EXAM_MODES = [
  { id: "choice", label: "t:tch.exam.modeChoice" },
  { id: "typing", label: "t:tch.exam.modeTyping" },
  { id: "mixed", label: "t:tch.exam.modeMixed" },
].map(translated);

export const EXAM_DIRECTIONS = [
  { id: "term_to_translation", label: "t:tch.exam.dirTermToTranslation" },
  { id: "translation_to_term", label: "t:tch.exam.dirTranslationToTerm" },
  { id: "both", label: "t:tch.exam.dirBoth" },
].map(translated);
