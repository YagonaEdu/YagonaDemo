import { api } from "@/services/api/client";

/* Demo build: the mock API (src/api) builds DRF `next` links under this fixed prefix. */
const API_PATH = "/api/v1";

/** DRF `next` is an absolute URL; the client wants a path relative to the API root. */
function nextPath(next) {
  const url = new URL(next, window.location.origin);
  const path = `${url.pathname}${url.search}`;
  return path.startsWith(API_PATH) ? path.slice(API_PATH.length) : path;
}

/** Follows DRF pagination until exhausted (bounded to avoid runaway loops). */
export async function fetchAll(path, maxPages = 20) {
  const items = [];
  let next = path;
  for (let page = 0; next && page < maxPages; page += 1) {
    const data = await api.get(next);
    if (Array.isArray(data)) return data;
    items.push(...(data?.results || []));
    next = data?.next ? nextPath(data.next) : null;
  }
  return items;
}

/**
 * Whole list from a paginated endpoint: the API returns at most one page (max_page_size),
 * so every list screen must follow `next` or it silently loses records.
 */
export async function getList(path, options = {}, maxPages = 50) {
  const items = [];
  let next = path;
  for (let page = 0; next && page < maxPages; page += 1) {
    const data = await api.get(next, options);
    if (Array.isArray(data)) return data;
    items.push(...(data?.results || []));
    next = data?.next ? nextPath(data.next) : null;
  }
  return items;
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Lessons from `daysBack` days ago to `daysAhead` days ahead (local days), for screens that
    only show recent and upcoming lessons. */
export function lessonsWindowPath(daysBack, daysAhead, ordering = "starts_at") {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + daysAhead);
  to.setHours(23, 59, 59, 999);
  return `/lessons?page_size=500&ordering=${ordering}&starts_at_from=${encodeURIComponent(from.toISOString())}&starts_at_to=${encodeURIComponent(to.toISOString())}`;
}

/**
 * Attendance marks of many lessons: { [lessonId]: rows }. One request per 40 lessons
 * (?lesson__in=…) instead of one /lessons/<id>/attendance call per lesson.
 */
export async function attendanceForLessons(lessonIds, options = {}) {
  const ids = [...new Set(lessonIds.map(String))];
  const byLesson = Object.fromEntries(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const rows = await getList(`/attendance?page_size=500&lesson__in=${chunk.join(",")}`, options);
    rows.forEach((row) => {
      const key = String(row.lesson);
      if (byLesson[key]) byLesson[key].push(row);
    });
  }
  return byLesson;
}
