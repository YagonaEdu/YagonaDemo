import { formatDayShort, formatDeadline, formatTime, pluralRu } from "@/utils/format";
import { IconBooks, IconCheck, IconClock, IconSound, IconTimer } from "./icons";
import { Ring } from "./parts";

/* ---------- pronunciation (Web Speech) ---------- */

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

let voice = null;
function englishVoice() {
  if (voice) return voice;
  const voices = window.speechSynthesis.getVoices();
  voice =
    voices.find((item) => item.lang === "en-US" && /Google|Samantha|Microsoft/i.test(item.name)) ||
    voices.find((item) => item.lang === "en-US") ||
    voices.find((item) => item.lang?.startsWith("en")) ||
    null;
  return voice;
}

export function speak(text) {
  if (!canSpeak || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  const preferred = englishVoice();
  if (preferred) utterance.voice = preferred;
  synth.speak(utterance);
}

export function SpeakButton({ text, className = "" }) {
  if (!canSpeak) return null;
  return (
    <button
      type="button"
      className={`st-speak ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        speak(text);
      }}
      aria-label={`Произнести «${text}»`}
      title="Произнести"
    >
      <IconSound size={18} />
    </button>
  );
}

/** "кошка|кот" → "кошка, кот" */
export function translationText(value) {
  return (value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/* ---------- exams ---------- */

export function durationLabel(seconds) {
  if (seconds < 60) return `${seconds} сек`;
  const minutes = Math.round(seconds / 60);
  return pluralRu(minutes, ["минута", "минуты", "минут"]);
}

/** Bucket for the student's exam tabs. */
export function examBucket(exam) {
  if (exam.in_progress_attempt || (exam.state === "open" && exam.can_start)) return "open";
  if (exam.state === "upcoming") return "upcoming";
  return "done";
}

export const EXAM_TABS = [
  { key: "open", label: "Доступны сейчас" },
  { key: "upcoming", label: "Скоро" },
  { key: "done", label: "Пройдены" },
];

const MODE_LABELS = { choice: "выбор ответа", typing: "ввод слова", mixed: "выбор и ввод" };

/** Time left until `target` split into the two largest units, e.g. [["2", "дн"], ["5", "ч"]]. */
function timeParts(target, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((new Date(target).getTime() - now) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return [[days, "дн"], [hours, "ч"]];
  if (hours) return [[hours, "ч"], [mins, "мин"]];
  return [[mins, "мин"]];
}

function ExamMeta({ exam, light = false }) {
  const questions = Math.min(exam.questions_count, exam.word_count || exam.questions_count);
  return (
    <ul className={`st-exam-meta${light ? " is-light" : ""}`}>
      <li>
        <IconBooks size={16} />
        {exam.list_title}
      </li>
      <li>
        <IconTimer size={16} />
        {pluralRu(questions, ["вопрос", "вопроса", "вопросов"])} · {durationLabel(exam.time_limit_sec)}
      </li>
      <li>
        <IconCheck size={16} />
        порог {exam.pass_score}% · {MODE_LABELS[exam.mode]}
      </li>
    </ul>
  );
}

function attemptsText(exam) {
  if (exam.attempts_allowed == null) return "попытки без ограничений";
  const left = Math.max(exam.attempts_allowed - exam.attempts_used, 0);
  return `осталось ${pluralRu(left, ["попытка", "попытки", "попыток"])} из ${exam.attempts_allowed}`;
}

/** Open now: the featured dark card, like "Следующий урок" on the home screen. */
function OpenExamCard({ exam, onStart, busy }) {
  const questions = Math.min(exam.questions_count, exam.word_count || exam.questions_count);
  const resume = Boolean(exam.in_progress_attempt);
  return (
    <article className="st-exam is-open">
      <div className="st-exam-tile" aria-hidden="true">
        <small>вопросов</small>
        <strong>{questions}</strong>
        <span>{durationLabel(exam.time_limit_sec)}</span>
      </div>

      <div className="st-exam-main">
        <span className="st-exam-eyebrow">
          {resume ? "Экзамен начат — время идёт" : "Экзамен открыт"}
        </span>
        <h3>{exam.title}</h3>
        <ExamMeta exam={exam} light />
        <p className="st-exam-note">
          {attemptsText(exam)}
          {exam.best_score != null ? ` · лучший результат ${exam.best_score}%` : ""}
        </p>
      </div>

      <div className="st-exam-side">
        {exam.closes_at ? (
          <div className="st-exam-countdown" aria-label={`Закроется ${formatDeadline(exam.closes_at)}`}>
            <span className="st-exam-countdown-label">закроется через</span>
            <div>
              {timeParts(exam.closes_at).map(([value, unit]) => (
                <span key={unit} className="st-exam-count">
                  <strong>{String(value).padStart(2, "0")}</strong>
                  <small>{unit}</small>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className={`y-btn st-exam-cta${resume ? " is-resume" : ""}`}
          onClick={() => onStart(exam)}
          disabled={busy}
        >
          {resume ? "Продолжить" : exam.attempts_used ? "Ещё попытка" : "Начать экзамен"}
        </button>
      </div>
    </article>
  );
}

/** Opens later: date tile in the style of the week schedule. */
function UpcomingExamCard({ exam }) {
  return (
    <article className="st-exam is-upcoming">
      <div className="st-exam-date" aria-hidden="true">
        <small>{formatDayShort(exam.opens_at)}</small>
        <strong>{formatTime(exam.opens_at)}</strong>
      </div>
      <div className="st-exam-main">
        <span className="st-exam-eyebrow">Откроется {formatDeadline(exam.opens_at)}</span>
        <h3>{exam.title}</h3>
        <ExamMeta exam={exam} />
      </div>
      <span className="y-pill is-hw-todo st-exam-pill">
        <IconClock size={14} />
        через {timeParts(exam.opens_at).map(([value, unit]) => `${value} ${unit}`).join(" ")}
      </span>
    </article>
  );
}

/** Finished or closed: compact row with the best result. */
function DoneExamRow({ exam }) {
  const tried = exam.attempts_used > 0 && exam.best_score != null;
  return (
    <article className={`st-exam is-done${tried ? (exam.passed ? " is-passed" : " is-failed") : " is-missed"}`}>
      {tried ? (
        <Ring value={exam.best_score} max={100} size={64} stroke={7} tone={exam.passed ? "teal" : "danger"}>
          <strong>{exam.best_score}%</strong>
        </Ring>
      ) : (
        <span className="st-exam-missed" aria-hidden="true">
          <IconTimer size={22} />
        </span>
      )}
      <div className="st-exam-main">
        <h3>{exam.title}</h3>
        <p className="st-exam-note">
          {exam.list_title}
          {tried ? ` · попыток: ${exam.attempts_used}` : ""}
          {exam.closes_at ? ` · закрыт ${formatDeadline(exam.closes_at)}` : ""}
        </p>
      </div>
      <span
        className={`y-pill st-exam-pill ${
          !tried ? "is-hw-draft" : exam.passed ? "is-hw-submitted" : "is-hw-overdue"
        }`}
      >
        {!tried ? "Не сдавался" : exam.passed ? "Сдан" : "Не сдан"}
      </span>
    </article>
  );
}

export function ExamCard({ exam, onStart, busy }) {
  const bucket = examBucket(exam);
  if (bucket === "open") return <OpenExamCard exam={exam} onStart={onStart} busy={busy} />;
  if (bucket === "upcoming") return <UpcomingExamCard exam={exam} />;
  return <DoneExamRow exam={exam} />;
}
