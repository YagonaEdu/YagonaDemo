import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useToast } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { addWordsToPractice, getVocabAttempt } from "@/services/student";
import { formatWhen, pluralRu } from "@/utils/format";
import { IconArrowLeft, IconCards } from "./icons";
import { CardSkeleton, LoadError, Ring } from "./parts";

export default function StudentExamResultPage() {
  const { attemptId } = useParams();
  const attempt = useAsync(() => getVocabAttempt(attemptId), [attemptId]);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  if (attempt.loading && !attempt.data) {
    return (
      <div className="st-page">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={6} />
      </div>
    );
  }
  if (attempt.error) {
    return (
      <div className="st-page">
        <LoadError error={attempt.error} onRetry={attempt.reload} />
      </div>
    );
  }

  const data = attempt.data;
  const review = data.review || [];
  const mistakes = review.filter((row) => !row.is_correct);
  const mistakeWords = [...new Set(mistakes.map((row) => row.word).filter(Boolean))];

  const addMistakes = async () => {
    setBusy(true);
    try {
      const result = await addWordsToPractice(mistakeWords);
      setAdded(true);
      showToast(`${pluralRu(result.added, ["слово добавлено", "слова добавлены", "слов добавлено"])} в тренировку`);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-page">
      <Link to="/student/vocab?tab=exams" className="st-back">
        <IconArrowLeft size={18} />
        К экзаменам
      </Link>

      <section className={`st-result${data.passed ? " is-passed" : " is-failed"}`}>
        <Ring value={data.score_percent ?? 0} max={100} size={148} stroke={13} tone={data.passed ? "teal" : "danger"}>
          <strong>{data.score_percent ?? 0}%</strong>
          <span>результат</span>
        </Ring>
        <div className="st-result-copy">
          <span className="st-result-eyebrow">
            {data.status === "expired" ? "Время вышло · ответы засчитаны" : "Экзамен завершён"}
          </span>
          <h1>{data.passed ? "Экзамен сдан!" : "Экзамен не сдан"}</h1>
          <p>
            {data.exam_title} · порог {data.pass_score}% · {formatWhen(data.finished_at)}
          </p>
          <dl className="st-result-stats">
            <div>
              <dd>{data.correct_count}</dd>
              <dt>правильно</dt>
            </div>
            <div>
              <dd>{data.total - data.correct_count}</dd>
              <dt>ошибок</dt>
            </div>
            <div>
              <dd>{data.total}</dd>
              <dt>вопросов</dt>
            </div>
          </dl>
        </div>
      </section>

      <section className="st-card">
        <header className="st-card-head">
          <h2>{mistakes.length ? "Разбор ошибок" : "Ошибок нет"}</h2>
          {mistakeWords.length ? (
            <button
              type="button"
              className="y-btn y-btn-teal y-btn-sm"
              onClick={addMistakes}
              disabled={busy || added}
            >
              <IconCards size={16} />
              {added ? "Добавлено в тренировку" : "Добавить ошибки в тренировку"}
            </button>
          ) : null}
        </header>
        {mistakes.length ? (
          <ol className="st-review">
            {mistakes.map((row) => (
              <li key={row.id}>
                <span className="st-review-num">{row.order}</span>
                <div className="st-review-body">
                  <strong lang={row.direction === "term_to_translation" ? "en" : "ru"}>{row.prompt}</strong>
                  <dl>
                    <div className="is-wrong">
                      <dt>Ваш ответ</dt>
                      <dd>{row.given_answer || "— нет ответа —"}</dd>
                    </div>
                    <div className="is-right">
                      <dt>Правильно</dt>
                      <dd>{row.expected}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="st-muted">Все ответы верные — отличная работа!</p>
        )}
      </section>
      {toast}
    </div>
  );
}
