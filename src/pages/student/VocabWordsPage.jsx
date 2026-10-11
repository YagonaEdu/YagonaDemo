import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { getVocabList, listVocabWords } from "@/services/student";
import { pluralRu } from "@/utils/format";
import { IconArrowLeft, IconBooks, IconCards, IconSearch } from "./icons";
import { CardSkeleton, LoadError } from "./parts";
import { SpeakButton, translationText } from "./vocabParts";

function normalize(text) {
  return (text || "").toLowerCase().replace(/ё/g, "е").trim();
}

export default function StudentVocabWordsPage() {
  const { id } = useParams();
  const data = useAsync(() => Promise.all([getVocabList(id), listVocabWords(id)]), [id]);
  const [search, setSearch] = useState("");

  const [vocabList, words] = data.data || [null, []];
  const filtered = useMemo(() => {
    const needle = normalize(search);
    if (!needle) return words;
    return words.filter(
      (word) => normalize(word.term).includes(needle) || normalize(word.translation).includes(needle),
    );
  }, [words, search]);

  return (
    <div className="st-page">
      <Link to="/student/vocab" className="st-back">
        <IconArrowLeft size={18} />
        Все словари
      </Link>

      {data.loading && !data.data ? (
        <CardSkeleton lines={8} />
      ) : data.error ? (
        <LoadError error={data.error} onRetry={data.reload} />
      ) : (
        <>
          <header className="st-vwords-head">
            <div>
              <span className="st-hw-course">
                {vocabList.course_name || vocabList.group_name || "Общий словарь"}
                {vocabList.level ? ` · ${vocabList.level}` : ""}
              </span>
              <h1>{vocabList.title}</h1>
              <p className="st-muted">
                {pluralRu(vocabList.word_count, ["слово", "слова", "слов"])} · выучено{" "}
                {vocabList.learned_count || 0}
              </p>
            </div>
            <Link to={`/student/vocab/practice?list=${vocabList.id}`} className="y-btn y-btn-teal">
              <IconCards size={18} />
              Тренировка
            </Link>
          </header>
          {vocabList.description ? <p className="st-vwords-desc">{vocabList.description}</p> : null}

          <label className="st-search st-vwords-search">
            <IconSearch size={18} />
            <span className="st-sr-only">Поиск по словам</span>
            <input
              type="search"
              value={search}
              placeholder="Найти слово или перевод"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          {filtered.length ? (
            <ul className="st-words" aria-label="Слова">
              {filtered.map((word) => (
                <li key={word.id} className="st-word">
                  <div className="st-word-main">
                    <div className="st-word-term">
                      <strong lang="en">{word.term}</strong>
                      <SpeakButton text={word.term} />
                    </div>
                    {word.transcription ? (
                      <span className="st-word-ipa" lang="en">
                        {word.transcription}
                      </span>
                    ) : null}
                    {word.part_of_speech ? (
                      <span className="st-word-pos">{word.part_of_speech}</span>
                    ) : null}
                  </div>
                  <div className="st-word-meaning">
                    <span>{translationText(word.translation)}</span>
                    {word.example ? (
                      <p className="st-word-example" lang="en">
                        {word.example}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="st-card">
              <EmptyState
                icon={<IconBooks />}
                title={search ? "Ничего не найдено" : "В словаре пока нет слов"}
                body={search ? "Попробуйте другое слово или перевод." : undefined}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
