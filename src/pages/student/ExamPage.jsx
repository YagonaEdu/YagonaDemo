import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { YagonaLogo } from "@/components/brand";
import { ErrorState } from "@/components/ui";
import { getVocabAttempt, saveVocabAnswer, finishVocabAttempt } from "@/services/student";
import { pluralRu } from "@/utils/format";
import ConfirmDialog from "./ConfirmDialog";
import { IconTimer } from "./icons";
import "@/styles/student.css";
import "@/styles/student-learning.css";
import "@/styles/student-vocab.css";

const TYPING_SAVE_DELAY = 600;

const INSTRUCTIONS = {
  choice: {
    term_to_translation: "Выберите перевод",
    translation_to_term: "Выберите слово",
  },
  typing: {
    term_to_translation: "Напишите перевод",
    translation_to_term: "Напишите слово на английском",
  },
};

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function storageKey(attemptId) {
  return `yagona-exam-position:${attemptId}`;
}

function readPosition(attemptId) {
  try {
    return Number(sessionStorage.getItem(storageKey(attemptId))) || 0;
  } catch {
    return 0;
  }
}

export default function StudentExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState({}); // answerId -> saving | saved | error
  const [index, setIndex] = useState(() => readPosition(attemptId));
  const [remaining, setRemaining] = useState(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const offset = useRef(0);
  const timers = useRef({});
  const inflight = useRef(new Set());
  const finished = useRef(false);
  const warned = useRef({ minute: false, last: false });
  const questionRef = useRef(null);
  const inputRef = useRef(null);

  const goToResult = useCallback(
    () => navigate(`/student/vocab/result/${attemptId}`, { replace: true }),
    [navigate, attemptId],
  );

  /* ---- load / restore ---- */
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getVocabAttempt(attemptId);
      if (data.status !== "in_progress") {
        goToResult();
        return;
      }
      offset.current = new Date(data.server_now).getTime() - Date.now();
      setAttempt(data);
      setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, q.given_answer || ""])));
      setIndex((value) => Math.min(value, data.questions.length - 1));
    } catch (error) {
      setLoadError(error);
    }
  }, [attemptId, goToResult]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(attemptId), String(index));
    } catch {
      /* position restore is a convenience */
    }
  }, [attemptId, index]);

  /* ---- finishing ---- */
  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setFinishing(true);
    Object.values(timers.current).forEach(clearTimeout);
    await Promise.allSettled([...inflight.current]);
    try {
      await finishVocabAttempt(attemptId);
    } catch {
      /* already expired/finished on the server — the result page shows the outcome */
    }
    try {
      sessionStorage.removeItem(storageKey(attemptId));
    } catch {
      /* ignore */
    }
    goToResult();
  }, [attemptId, goToResult]);

  /* ---- timer (server deadline, corrected for clock skew) ---- */
  useEffect(() => {
    if (!attempt) return undefined;
    const deadline = new Date(attempt.deadline_at).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + offset.current);
      setRemaining(left);
      if (left <= 60000 && !warned.current.minute) {
        warned.current.minute = true;
        setAnnounce("Осталась одна минута");
      }
      if (left <= 15000 && !warned.current.last) {
        warned.current.last = true;
        setAnnounce("Осталось 15 секунд");
      }
      if (left <= 0) finish();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [attempt, finish]);

  /* ---- leave warning ---- */
  useEffect(() => {
    if (!attempt) return undefined;
    const onBeforeUnload = (event) => {
      if (finished.current) return undefined;
      event.preventDefault();
      event.returnValue = "Экзамен ещё идёт. Ответы сохранены, но таймер не остановится.";
      return event.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [attempt]);

  /* ---- answers ---- */
  const persist = useCallback(
    (answerId, value) => {
      setSaving((state) => ({ ...state, [answerId]: "saving" }));
      const request = saveVocabAnswer(attemptId, answerId, value)
        .then(() => setSaving((state) => ({ ...state, [answerId]: "saved" })))
        .catch((error) => {
          if (error.status === 409) {
            finish();
            return;
          }
          setSaving((state) => ({ ...state, [answerId]: "error" }));
        })
        .finally(() => inflight.current.delete(request));
      inflight.current.add(request);
      return request;
    },
    [attemptId, finish],
  );

  const setAnswer = (question, value, { immediate = false } = {}) => {
    setAnswers((state) => ({ ...state, [question.id]: value }));
    clearTimeout(timers.current[question.id]);
    if (immediate) {
      persist(question.id, value);
    } else {
      setSaving((state) => ({ ...state, [question.id]: "saving" }));
      timers.current[question.id] = setTimeout(() => {
        delete timers.current[question.id];
        persist(question.id, value);
      }, TYPING_SAVE_DELAY);
    }
  };

  /** Save a pending typed answer right away (before moving on). */
  const flush = (question) => {
    if (!question || !timers.current[question.id]) return;
    clearTimeout(timers.current[question.id]);
    delete timers.current[question.id];
    persist(question.id, answers[question.id] || "");
  };

  const questions = attempt?.questions || [];
  const question = questions[index];
  const answeredCount = questions.filter((q) => (answers[q.id] || "").trim()).length;
  const unanswered = questions.length - answeredCount;

  const goTo = (next) => {
    flush(question);
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    setMapOpen(false);
  };

  // Focus the new question for keyboard and screen-reader users.
  useEffect(() => {
    if (!question) return;
    if (question.question_type === "typing") inputRef.current?.focus();
    else questionRef.current?.focus();
  }, [question]);

  /* ---- keyboard: 1–4 choose, Enter next, ← → navigate ---- */
  useEffect(() => {
    if (!question) return undefined;
    const onKey = (event) => {
      if (confirmFinish || finishing) return;
      const typing = event.target.closest?.("input, textarea");
      if (question.question_type === "choice" && !typing && /^[1-4]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (option) setAnswer(question, option, { immediate: true });
      } else if (event.key === "Enter" && !event.target.closest?.("button")) {
        event.preventDefault();
        if (index < questions.length - 1) goTo(index + 1);
        else {
          flush(question);
          setConfirmFinish(true);
        }
      } else if (!typing && event.key === "ArrowRight") {
        goTo(index + 1);
      } else if (!typing && event.key === "ArrowLeft") {
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---- render ---- */
  if (loadError) {
    return (
      <div className="st-exam-shell">
        <main className="st-exam-body">
          <ErrorState message={loadError.message} onRetry={load} />
        </main>
      </div>
    );
  }
  if (!attempt || !question) {
    return (
      <div className="st-exam-shell">
        <main className="st-exam-body">
          <p className="st-muted" role="status">
            Загружаем экзамен…
          </p>
        </main>
      </div>
    );
  }

  const tone = remaining == null ? "" : remaining <= 15000 ? " is-danger" : remaining <= 60000 ? " is-warning" : "";
  const value = answers[question.id] || "";
  const state = saving[question.id];

  return (
    <div className="st-exam-shell">
      <header className="st-exam-top">
        <span className="st-exam-logo">
          <YagonaLogo mark size={28} />
        </span>
        <div className="st-exam-title">
          <strong>{attempt.exam_title}</strong>
          <span>
            Вопрос {index + 1} / {questions.length}
          </span>
        </div>
        <div className={`st-exam-timer${tone}`} role="timer" aria-label={`Осталось ${clock(remaining)}`}>
          <IconTimer size={18} />
          <span>{clock(remaining)}</span>
        </div>
        <span className="st-sr-only" aria-live="assertive">
          {announce}
        </span>
      </header>
      <div className="st-exam-bar" aria-hidden="true">
        <span style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      <div className="st-exam-layout">
        <main className="st-exam-body">
          <section className="st-exam-card" aria-labelledby="exam-question">
            <span className="st-overline">{INSTRUCTIONS[question.question_type][question.direction]}</span>
            <h1 id="exam-question" ref={questionRef} tabIndex={-1} lang={question.direction === "term_to_translation" ? "en" : "ru"}>
              {question.prompt}
            </h1>

            {question.question_type === "choice" ? (
              <div className="st-exam-options" role="radiogroup" aria-labelledby="exam-question">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={value === option}
                    className={`st-exam-option${value === option ? " is-picked" : ""}`}
                    onClick={() => setAnswer(question, option, { immediate: true })}
                  >
                    <kbd>{optionIndex + 1}</kbd>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <label className="st-exam-typing">
                <span className="st-sr-only">Ваш ответ</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={300}
                  placeholder="Введите ответ и нажмите Enter"
                  onChange={(event) => setAnswer(question, event.target.value)}
                />
              </label>
            )}

            <p className={`st-exam-save is-${state || "idle"}`} role="status">
              {state === "saving"
                ? "Сохраняем ответ…"
                : state === "saved"
                  ? "Ответ сохранён"
                  : state === "error"
                    ? "Не удалось сохранить — проверьте интернет, ответ сохранится при следующей попытке"
                    : ""}
            </p>
          </section>

          <nav className="st-exam-nav" aria-label="Навигация по вопросам">
            <button type="button" className="y-btn y-btn-secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
              ← Назад
            </button>
            <button type="button" className="y-btn y-btn-ghost st-exam-map-toggle" onClick={() => setMapOpen((open) => !open)} aria-expanded={mapOpen} aria-controls="exam-map">
              Карта вопросов
            </button>
            {index < questions.length - 1 ? (
              <button type="button" className="y-btn y-btn-primary" onClick={() => goTo(index + 1)}>
                Дальше →
              </button>
            ) : (
              <button
                type="button"
                className="y-btn y-btn-teal"
                onClick={() => {
                  flush(question);
                  setConfirmFinish(true);
                }}
              >
                Завершить
              </button>
            )}
          </nav>
        </main>

        <aside id="exam-map" className={`st-exam-map${mapOpen ? " is-open" : ""}`} aria-label="Карта вопросов">
          <h2>Вопросы</h2>
          <ol>
            {questions.map((item, itemIndex) => {
              const done = (answers[item.id] || "").trim();
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${itemIndex === index ? "is-current" : ""}${done ? " is-done" : ""}`}
                    onClick={() => goTo(itemIndex)}
                    aria-current={itemIndex === index ? "step" : undefined}
                    aria-label={`Вопрос ${itemIndex + 1}${done ? ", есть ответ" : ", без ответа"}`}
                  >
                    {itemIndex + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="st-muted">
            Отвечено {answeredCount} из {questions.length}
          </p>
          <button
            type="button"
            className="y-btn y-btn-teal"
            onClick={() => {
              flush(question);
              setConfirmFinish(true);
            }}
          >
            Завершить экзамен
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmFinish}
        title="Завершить экзамен?"
        confirmLabel="Завершить"
        cancelLabel="Вернуться"
        tone="teal"
        busy={finishing}
        onCancel={() => setConfirmFinish(false)}
        onConfirm={finish}
      >
        <p>
          {unanswered
            ? `Без ответа ${pluralRu(unanswered, ["вопрос", "вопроса", "вопросов"])} — они будут засчитаны как ошибки.`
            : "Вы ответили на все вопросы."}
        </p>
        <p>После завершения изменить ответы будет нельзя.</p>
      </ConfirmDialog>

      {finishing && !confirmFinish ? (
        <div className="st-exam-overlay" role="status">
          {remaining != null && remaining <= 0 ? "Время вышло — подводим итоги…" : "Подводим итоги…"}
        </div>
      ) : null}
    </div>
  );
}
