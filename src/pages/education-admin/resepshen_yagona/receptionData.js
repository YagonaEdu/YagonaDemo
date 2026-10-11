/* Requests shared by the reception shell (sidebar counters) and the «Сегодня» dashboard.
   Same paths + { cache: true } so both read one cached response. */
import { ApiError } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { isSameLocalDay, isTrialLesson } from "./utils";

export const LEADS_PATH = "/leads?page_size=120&ordering=-updated_at";

export function todayLessonsPath(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return `/lessons?page_size=60&ordering=starts_at&starts_at_from=${encodeURIComponent(start.toISOString())}&starts_at_to=${encodeURIComponent(end.toISOString())}`;
}

/** List endpoint as an array; access errors propagate, other failures give []. */
export async function asList(path) {
  try {
    return await getList(path, { cache: true });
  } catch (err) {
    // Access and connection problems are shown to the user; other failures read as an empty list.
    if (err instanceof ApiError && [0, 401, 403].includes(err.status)) throw err;
    return [];
  }
}

/** Follow-ups due today or earlier that are still open. */
export function dueFollowUps(leads, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return leads.filter(
    (lead) => !lead.converted_student && lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= end,
  );
}

/** Sidebar badges: new leads today, trial lessons today, contacts to make. */
export async function loadReceptionCounts() {
  const [leads, lessons] = await Promise.all([asList(LEADS_PATH), asList(todayLessonsPath())]);
  return {
    leads: leads.filter((lead) => !lead.converted_student && isSameLocalDay(lead.created_at)).length,
    trials: lessons.filter((lesson) => lesson.status !== "cancelled" && isTrialLesson(lesson)).length,
    tasks: dueFollowUps(leads).length,
  };
}
