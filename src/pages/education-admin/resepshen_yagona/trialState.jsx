import { t } from "@/i18n";
import { isSameLocalDay } from "./utils";

/* One status pill for a trial lesson: the outcome marked on this screen wins, then the
   lesson's own state (cancelled / held / today / planned). */
export function trialState(lesson, outcome) {
  if (outcome === "came") return "came";
  if (outcome === "no_show") return "no_show";
  if (lesson.status === "cancelled") return "cancelled";
  if (lesson.status === "completed" || new Date(lesson.ends_at) < new Date()) return "past";
  if (isSameLocalDay(lesson.starts_at)) return "today";
  return "planned";
}

const PILLS = {
  came: ["is-teal-solid", "aRec.outcome_came"],
  no_show: ["is-amber", "aRec.outcome_no_show"],
  cancelled: ["", "aTrials.cancelled"],
  past: ["", "aTrials.held"],
  today: ["is-teal", "rxTrials.today"],
  planned: ["is-blue", "aTrials.scheduled"],
};

export function trialStatePill(lesson, outcome) {
  const [tone, key] = PILLS[trialState(lesson, outcome)];
  return <span className={`rx-pill ${tone}`.trim()}>{t(key)}</span>;
}
