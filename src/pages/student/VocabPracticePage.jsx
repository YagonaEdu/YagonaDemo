import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { getPractice, reviewWord } from "@/services/student";
import { pluralRu } from "@/utils/format";
import { IconArrowLeft, IconCards } from "./icons";
import { CardSkeleton, LoadError } from "./parts";
import { SpeakButton, translationText } from "./vocabParts";

const BOX_LABELS = { 1: "новое", 2: "знакомое", 3: "уверенно", 4: "почти выучено", 5: "выучено" };

function Summary({ known, unknown, hasMore, onMore }) {
  const total = known + unknown;
  return (
    <section className="st-card st-practice-done">
      <span className="st-practice-done-icon" aria-hidden="true">
        <IconCards size={28} />
      </span>
      <h2>Сессия завершена</h2>
      <p>
        Повторено {pluralRu(total, ["слово", "слова", "слов"])}: знаю — {known}, нужно
        повторить — {unknown}.
      </p>
      <p className="st-muted">
        {hasMore
          ? "Есть ещё слова на сегодня — можно продолжить."
          : "Следующая сессия — завтра. Слова, которые вы не вспомнили, вернутся первыми."}
      </p>
      <div className="st-practice-done-actions">
        {hasMore ? (
          <button type="button" className="y-btn y-btn-primary" onClick={onMore}>
            Ещё карточки
          </button>
        ) : null}
        <Link to="/student/vocab" className="y-btn y-btn-secondary">
          К словарям
        </Link>
      </div>
    </section>
  );
}

export default function StudentVocabPracticePage() {
  const [params] = useSearchParams();
  const listId = params.get("list") || undefined;
  const [round, setRound] = useState(0);
  const queue = useAsync(() => getPractice(listId), [listId, round]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ known: 0, unknown: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cards = queue.data?.cards || [];
  const card = cards[index];
  const finished = queue.data && index >= cards.length;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [queue.data]);

  const answer = useCallback(
    async (known) => {
      if (!card || saving) return;
      setSaving(true);
      setError("");
      try {
        await reviewWord(card.id, known);
        setTally((value) => ({ ...value, [known ? "known" : "unknown"]: value[known ? "known" : "unknown"] + 1 }));
        setFlipped(false);
        setIndex((value) => value + 1);
      } catch (exc) {
        setError(exc.message);
      } finally {
        setSaving(false);
      }
    },
    [card, saving],
  );

  useEffect(() => {
    const onKey = (event) => {
      if (!card || event.target.closest?.("input, textarea, select")) return;
      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (flipped && (event.key === "1" || event.key === "ArrowLeft")) {
        answer(false);
      } else if (flipped && (event.key === "2" || event.key === "ArrowRight")) {
        answer(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, answer]);

  const reviewed = tally.known + tally.unknown;

  return (
    <div className="st-page st-practice">
      <Link to="/student/vocab" className="st-back">
        <IconArrowLeft size={18} />
        Словарь
      </Link>

      {queue.loading && !queue.data ? (
        <CardSkeleton lines={5} />
      ) : queue.error ? (
        <LoadError error={queue.error} onRetry={queue.reload} />
      ) : !cards.length && !reviewed ? (
        <div className="st-card">
          <EmptyState
            icon={<IconCards />}
            title="На сегодня всё повторено"
            body="Следующие карточки появятся завтра. А пока можно посмотреть слова словаря."
            action={
              <Link to="/student/vocab" className="y-btn y-btn-secondary">
                К словарям
              </Link>
            }
          />
        </div>
      ) : finished ? (
        <Summary
          known={tally.known}
          unknown={tally.unknown}
          hasMore={queue.data.due_count > cards.length}
          onMore={() => setRound((value) => value + 1)}
        />
      ) : (
        <>
          <div className="st-practice-progress">
            <span>
              Карточка {index + 1} из {cards.length}
            </span>
            <div
              className="st-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={cards.length}
              aria-valuenow={index}
              aria-label="Прогресс сессии"
            >
              <span style={{ width: `${(index / cards.length) * 100}%` }} />
            </div>
          </div>

          <div className="st-flip-wrap">
            <button
              type="button"
              className={`st-flip${flipped ? " is-flipped" : ""}`}
              onClick={() => setFlipped((value) => !value)}
              aria-label={flipped ? "Показать слово" : "Показать перевод"}
              aria-pressed={flipped}
            >
              <span className="st-flip-face is-front" aria-hidden={flipped}>
                <small>{card.list_title}</small>
                <strong lang="en">{card.term}</strong>
                {card.transcription ? <span lang="en">{card.transcription}</span> : null}
                <em>Нажмите или пробел — перевернуть</em>
              </span>
              <span className="st-flip-face is-back" aria-hidden={!flipped}>
                <small>{card.box ? BOX_LABELS[card.box] : "новое слово"}</small>
                <strong>{translationText(card.translation)}</strong>
                {card.example ? <span lang="en">{card.example}</span> : null}
              </span>
            </button>
            <SpeakButton text={card.term} className="st-flip-speak" />
          </div>

          <div className="st-practice-actions">
            <button
              type="button"
              className="st-practice-btn is-no"
              onClick={() => answer(false)}
              disabled={!flipped || saving}
            >
              Не знаю <kbd>1</kbd>
            </button>
            <button
              type="button"
              className="st-practice-btn is-yes"
              onClick={() => answer(true)}
              disabled={!flipped || saving}
            >
              Знаю <kbd>2</kbd>
            </button>
          </div>
          {!flipped ? (
            <p className="st-practice-hint">Сначала вспомните перевод, затем переверните карточку.</p>
          ) : null}
          {error ? (
            <p className="st-field-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
