import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { getPractice, listVocabExams, listVocabLists, startVocabExam } from "@/services/student";
import { pluralRu } from "@/utils/format";
import ConfirmDialog from "./ConfirmDialog";
import { IconBooks, IconCards, IconCheck, IconSearch, IconTimer } from "./icons";
import { LoadError, useCabinetHeader } from "./parts";
import { Badge, CardSkeleton, FxEmpty, FxRing, Kpi, KpiSkeleton, courseToneMap } from "./fx";
import { EXAM_TABS, ExamCard, durationLabel, examBucket } from "./vocabParts";

const SORTS = [
  ["progress", "по прогрессу"],
  ["title", "по названию"],
  ["new", "сначала новые"],
];

function PracticeHero({ practice, lists, openExams }) {
  const due = practice.data?.due_count ?? 0;
  const total = (lists.data || []).reduce((sum, item) => sum + (item.word_count || 0), 0);
  const learned = (lists.data || []).reduce((sum, item) => sum + (item.learned_count || 0), 0);
  const pct = total ? Math.round((learned / total) * 100) : 0;

  return (
    <section className="fx-hero fv-hero">
      <div className="fx-hero-copy">
        <span className="fx-hero-date">Тренировка на сегодня</span>
        <h2>
          {practice.loading
            ? "Считаем слова…"
            : due
              ? `${pluralRu(due, ["слово", "слова", "слов"])} на повторение`
              : "Все слова повторены 🎉"}
        </h2>
        <p>
          {due
            ? "Карточки по системе Лейтнера: знакомые слова возвращаются всё реже, трудные — чаще. 10 минут в день достаточно."
            : total
              ? "На сегодня всё. Загляните завтра — система сама подберёт слова для повторения."
              : "Новые слова появятся, когда преподаватель опубликует словарь для вашей группы."}
        </p>
        <div className="fx-hero-actions">
          {due ? (
            <Link to="/student/vocab/practice" className="sx-btn sx-btn-teal sx-btn-sm">
              <IconCards size={16} />
              Тренироваться
            </Link>
          ) : null}
          <Link to="/student/vocab?tab=exams" className="sx-btn sx-btn-ghost-light sx-btn-sm">
            Экзамены{openExams ? ` · ${openExams}` : ""}
          </Link>
        </div>
      </div>
      {total ? (
        <div className="fv-hero-ring">
          <FxRing value={pct} max={100} size={150} stroke={14} color="#5fe0d2" track="rgba(255,255,255,0.12)">
            <strong>{pct}%</strong>
            <span>
              {learned} из {total}
            </span>
          </FxRing>
          <small>выучено слов</small>
        </div>
      ) : null}
    </section>
  );
}

function ListCard({ item, tone }) {
  const total = item.word_count || 0;
  const learned = item.learned_count || 0;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const done = total > 0 && learned >= total;
  return (
    <article className={`fv-card is-${tone}`}>
      <div className="fv-card-top">
        <span className="fv-card-course">{item.course_name || item.group_name || "Общий словарь"}</span>
        {done ? (
          <Badge tone="teal">Выучен</Badge>
        ) : item.level ? (
          <Badge tone="grey" plain>
            {item.level}
          </Badge>
        ) : null}
      </div>
      <h3>{item.title}</h3>
      {item.description ? <p className="fv-card-desc">{item.description}</p> : null}
      <div className="fv-card-progress">
        <span>
          Выучено {learned} из {pluralRu(total, ["слова", "слов", "слов"])}
          <b>{pct}%</b>
        </span>
        <div className={`sx-bar is-${tone === "blue" ? "" : tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={learned} aria-label="Выучено слов">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="fv-card-actions">
        <Link to={`/student/vocab/lists/${item.id}`} className="sx-btn sx-btn-outline sx-btn-sm">
          <IconBooks size={16} />
          Слова
        </Link>
        <Link to={`/student/vocab/practice?list=${item.id}`} className="sx-btn sx-btn-teal sx-btn-sm">
          <IconCards size={16} />
          Тренировка
        </Link>
      </div>
    </article>
  );
}

function ListsTab({ lists }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("progress");
  const tones = useMemo(() => courseToneMap(lists.data), [lists.data]);

  if (lists.loading) {
    return (
      <div className="fv-grid">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    );
  }
  if (lists.error) return <LoadError error={lists.error} onRetry={lists.reload} />;
  if (!lists.data.length) {
    return (
      <section className="sx-card">
        <FxEmpty icon={IconBooks} title="Словарей пока нет" body="Когда преподаватель опубликует словарь для вашей группы, он появится здесь." />
      </section>
    );
  }

  const ratio = (item) => (item.word_count ? (item.learned_count || 0) / item.word_count : 0);
  const needle = query.trim().toLowerCase();
  const visible = lists.data
    .filter((item) => !needle || `${item.title} ${item.course_name || ""} ${item.level || ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "new") return new Date(b.created_at) - new Date(a.created_at);
      return ratio(a) - ratio(b);
    });

  return (
    <>
      <div className="fv-tools">
        <label className="fn-search fv-search">
          <IconSearch size={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск словаря" aria-label="Поиск словаря" />
        </label>
        <label className="fh-select">
          <span>Сортировка:</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORTS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="fv-grid">
          {visible.map((item) => (
            <ListCard key={item.id} item={item} tone={tones.get(String(item.course)) || "blue"} />
          ))}
        </div>
      ) : (
        <section className="sx-card">
          <FxEmpty icon={IconSearch} title="Ничего не найдено" body="Попробуйте другой запрос." />
        </section>
      )}
    </>
  );
}

function ExamsTab({ exams }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("open");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (exams.loading) return <CardSkeleton lines={3} />;
  if (exams.error) return <LoadError error={exams.error} onRetry={exams.reload} />;

  const counts = Object.fromEntries(
    EXAM_TABS.map((entry) => [entry.key, exams.data.filter((exam) => examBucket(exam) === entry.key).length]),
  );
  const time = (value, fallback) => (value ? new Date(value).getTime() : fallback);
  const list = exams.data
    .filter((exam) => examBucket(exam) === tab)
    .sort((a, b) => {
      if (tab === "open") return time(a.closes_at, Infinity) - time(b.closes_at, Infinity);
      if (tab === "upcoming") return time(a.opens_at, 0) - time(b.opens_at, 0);
      return time(b.closes_at, 0) - time(a.closes_at, 0);
    });

  const begin = async (exam) => {
    if (exam.in_progress_attempt) {
      navigate(`/student/exam/${exam.in_progress_attempt}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const attempt = await startVocabExam(exam.id);
      navigate(`/student/exam/${attempt.id}`);
    } catch (exc) {
      setError(exc.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sx-tabs fv-subtabs" role="tablist" aria-label="Экзамены">
        {EXAM_TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={`sx-tab${tab === entry.key ? " is-active" : ""}`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label} · {counts[entry.key]}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="st-exam-list fv-exams">
          {list.map((exam) => (
            <ExamCard key={exam.id} exam={exam} busy={busy} onStart={(item) => (item.in_progress_attempt ? begin(item) : setConfirm(item))} />
          ))}
        </div>
      ) : (
        <section className="sx-card">
          <FxEmpty
            icon={IconTimer}
            title={tab === "open" ? "Сейчас нет открытых экзаменов" : tab === "upcoming" ? "Запланированных экзаменов нет" : "Вы ещё не сдавали экзамены"}
            body="Преподаватель откроет экзамен по словам — вы получите уведомление."
          />
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm ? `Начать «${confirm.title}»?` : ""}
        confirmLabel="Начать экзамен"
        busy={busy}
        onCancel={() => {
          setConfirm(null);
          setError("");
        }}
        onConfirm={() => begin(confirm)}
      >
        {confirm ? (
          <>
            <p>
              На экзамен даётся <b>{durationLabel(confirm.time_limit_sec)}</b>. Таймер нельзя поставить на паузу — по его окончании ответы
              сохранятся автоматически.
            </p>
            <p>Для зачёта нужно набрать не меньше {confirm.pass_score}%.</p>
            {error ? <p className="st-field-error">{error}</p> : null}
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function StudentVocabPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("tab") === "exams" ? "exams" : "lists";
  const lists = useAsync(listVocabLists);
  const exams = useAsync(listVocabExams);
  const practice = useAsync(() => getPractice());

  const examRows = exams.data || [];
  const openExams = examRows.filter((exam) => examBucket(exam) === "open").length;
  const scored = examRows.filter((exam) => exam.best_score != null);
  const passed = scored.filter((exam) => exam.passed).length;
  const total = (lists.data || []).reduce((sum, item) => sum + (item.word_count || 0), 0);
  const learned = (lists.data || []).reduce((sum, item) => sum + (item.learned_count || 0), 0);
  const due = practice.data?.due_count ?? 0;

  useCabinetHeader(
    "Словарь",
    lists.loading ? "Слова, тренировка и экзамены" : `${pluralRu(learned, ["слово выучено", "слова выучено", "слов выучено"])} из ${total}`,
  );

  return (
    <div className="sx-page">
      <div className="sx-kpis">
        {practice.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconCards}
            tone="teal"
            label="На повторение"
            value={due}
            note={due ? "Слова ждут тренировки" : "На сегодня всё повторено"}
            tag={due ? "Сегодня" : null}
            tagTone="teal"
            to={due ? "/student/vocab/practice" : undefined}
          />
        )}
        {lists.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi icon={IconCheck} tone="blue" label="Выучено слов" value={`${learned}/${total}`} note={total ? `${Math.round((learned / total) * 100)}% словаря` : "Словарей пока нет"} />
        )}
        {lists.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi icon={IconBooks} tone="violet" label="Словарей" value={lists.data?.length ?? 0} note="Доступно вашей группе" />
        )}
        {exams.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconTimer}
            tone="amber"
            label="Экзамены"
            value={openExams}
            note={scored.length ? `Сдано ${passed} из ${scored.length}` : "Открыто сейчас"}
            tag={openExams ? "Открыт" : null}
            tagTone="amber"
            to="/student/vocab?tab=exams"
          />
        )}
      </div>

      {view === "lists" ? <PracticeHero practice={practice} lists={lists} openExams={openExams} /> : null}

      <div className="sx-tabs" role="tablist" aria-label="Раздел словаря">
        <button
          type="button"
          role="tab"
          aria-selected={view === "lists"}
          className={`sx-tab${view === "lists" ? " is-active" : ""}`}
          onClick={() => setParams({}, { replace: true })}
        >
          Словари · {lists.data?.length ?? 0}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "exams"}
          className={`sx-tab${view === "exams" ? " is-active" : ""}`}
          onClick={() => setParams({ tab: "exams" }, { replace: true })}
        >
          Экзамены · {examRows.length}
        </button>
      </div>

      {view === "lists" ? <ListsTab lists={lists} /> : <ExamsTab exams={exams} />}
    </div>
  );
}
