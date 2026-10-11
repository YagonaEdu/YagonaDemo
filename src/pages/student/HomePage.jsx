import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import {
  listAttendance,
  listInvoices,
  listLessons,
  listNotifications,
  listPlans,
  listSubscriptions,
  loadHomework,
} from "@/services/student";
import {
  formatDate,
  formatDayLong,
  formatTime,
  isPositiveAmount,
  moneyExact,
  pluralRu,
  sameDay,
  shiftDays,
  sumDecimal,
} from "@/utils/format";
import { IconBell, IconCalendar, IconCheck, IconHomework, IconLive, IconStar, IconWallet } from "./icons";
import { LoadError, UNPAID_STATUSES, attendanceStats, homeworkState, relativeTime, useStudentCabinet, NOTIFICATION_CATEGORY_LABELS } from "./parts";
import {
  Badge,
  CardSkeleton,
  FxEmpty,
  FxRing,
  Kpi,
  KpiSkeleton,
  averageGrade,
  courseToneMap,
  deadlineBadge,
  lessonBadge,
} from "./fx";
import { LessonDialog, lessonTitle } from "./scheduleParts";

const TO_DO = ["todo", "draft", "returned"];
const DAY = 86400000;

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function loadUpcomingLessons() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return listLessons(shiftDays(start, -1), shiftDays(start, 45));
}

function minutesBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 60000);
}

/* ── Hero (Figma 19:250) ───────────────────────────────── */
function Hero({ name, now, todayCount, dueToday, nextLesson, onOpenLesson }) {
  const first = name.split(" ")[0] || name;
  const date = formatDayLong(now);
  let summary = todayCount
    ? `Сегодня ${pluralRu(todayCount, ["урок", "урока", "уроков"])}`
    : "Сегодня уроков нет";
  summary += dueToday ? ` и ${pluralRu(dueToday, ["задание", "задания", "заданий"])} с дедлайном.` : ".";
  if (!todayCount && nextLesson) {
    summary += ` Следующий урок — ${formatDayLong(nextLesson.starts_at)} в ${formatTime(nextLesson.starts_at)}.`;
  }
  return (
    <section className="fx-hero">
      <div className="fx-hero-copy">
        <span className="fx-hero-date">{date.charAt(0).toUpperCase() + date.slice(1)}</span>
        <h2>Салам, {first}! 👋</h2>
        <p>{summary}</p>
        <div className="fx-hero-actions">
          {nextLesson ? (
            <button type="button" className="sx-btn sx-btn-teal sx-btn-sm" onClick={() => onOpenLesson(nextLesson)}>
              <IconLive size={16} />
              Ближайший урок
            </button>
          ) : null}
          <Link to="/student/schedule" className="sx-btn sx-btn-ghost-light sx-btn-sm">
            Расписание
          </Link>
        </div>
      </div>
      <div className="fx-hero-art" aria-hidden="true">
        <img className="fx-hero-arch" src="/student/hero-arch.svg" alt="" width="170" height="210" />
        <img className="fx-hero-emblem" src="/student/hero-emblem.svg" alt="" width="110" height="110" />
      </div>
    </section>
  );
}

/* ── Payment card (Figma 19:380) ───────────────────────── */
function PaymentCard({ invoices, now }) {
  if (invoices.loading) return <CardSkeleton lines={4} />;
  if (invoices.error) return <LoadError error={invoices.error} onRetry={invoices.reload} />;
  const unpaid = (invoices.data || [])
    .filter((item) => UNPAID_STATUSES.includes(item.status) && isPositiveAmount(item.balance))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  if (!unpaid.length) {
    return (
      <section className="sx-card fx-pay">
        <div className="sx-card-head">
          <h2>Оплата</h2>
          <Badge tone="teal">Всё оплачено</Badge>
        </div>
        <FxEmpty icon={IconWallet} title="Задолженностей нет" body="Новые счета появятся здесь." />
        <Link to="/student/payments" className="sx-btn sx-btn-outline">
          История платежей
        </Link>
      </section>
    );
  }

  const next = unpaid[0];
  const days = Math.ceil((new Date(next.due_at).getTime() - now) / DAY);
  const due =
    days < 0
      ? { tone: "red", label: "Просрочено" }
      : days === 0
        ? { tone: "red", label: "Сегодня" }
        : { tone: days <= 5 ? "amber" : "teal", label: `Через ${pluralRu(days, ["день", "дня", "дней"])}` };
  const total = sumDecimal(unpaid.map((item) => item.balance));
  const [amount, currency] = moneyExact(total, next.currency).split(/ (?=[^ ]+$)/);

  return (
    <section className="sx-card fx-pay">
      <div className="sx-card-head fx-pay-head">
        <h2>Оплата</h2>
        <Badge tone={due.tone}>{due.label}</Badge>
      </div>
      <div>
        <p className="sx-muted">Следующий платёж · {formatDate(next.due_at)}</p>
        <p className="fx-pay-amount">
          {amount} <small>{currency}</small>
        </p>
      </div>
      <dl className="fx-kv">
        {unpaid.slice(0, 3).map((item) => (
          <div key={item.id}>
            <dt>{item.description || `Счёт № ${item.number}`}</dt>
            <dd>{moneyExact(item.balance, item.currency).replace(/ [^ ]+$/, "")}</dd>
          </div>
        ))}
      </dl>
      <Link to="/student/payments" className="sx-btn sx-btn-primary">
        <IconWallet size={18} />
        Перейти к оплате
      </Link>
    </section>
  );
}

/* ── «Уроки сегодня» (Figma 19:435) ────────────────────── */
function TodayLessons({ lessons, tones, now, onOpen }) {
  if (lessons.loading) return <CardSkeleton lines={4} />;
  if (lessons.error) return <LoadError error={lessons.error} onRetry={lessons.reload} />;
  const today = (lessons.data || []).filter((lesson) => sameDay(lesson.starts_at, now));
  const next = (lessons.data || []).find(
    (lesson) => new Date(lesson.starts_at).getTime() > now && lesson.status !== "cancelled",
  );

  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Уроки сегодня</h2>
        <Link to="/student/schedule" className="sx-link">
          Всё расписание →
        </Link>
      </div>
      {today.length ? (
        <ul className="sx-lessons">
          {today.map((lesson) => {
            const badge = lessonBadge(lesson, now);
            const tone = tones.get(String(lesson.course)) || "blue";
            const past = badge.label === "Прошёл";
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  className={`sx-lesson is-${tone}${past ? " is-past" : ""} fx-lesson-btn`}
                  onClick={() => onOpen(lesson)}
                >
                  <span className="sx-lesson-bar" aria-hidden="true" />
                  <span className="sx-lesson-time">
                    <strong>
                      {formatTime(lesson.starts_at)} – {formatTime(lesson.ends_at)}
                    </strong>
                    <span>{minutesBetween(lesson.starts_at, lesson.ends_at)} мин</span>
                  </span>
                  <span className="sx-lesson-copy">
                    <strong>
                      {lessonTitle(lesson)}
                      {lesson.group_name ? ` · ${lesson.group_name}` : ""}
                    </strong>
                    <span>
                      {[lesson.room_name && `Кабинет ${lesson.room_name}`, lesson.teacher_name]
                        .filter(Boolean)
                        .join(" · ") || "Детали уточняются"}
                    </span>
                  </span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <FxEmpty
          icon={IconCalendar}
          title="Сегодня уроков нет"
          body={
            next
              ? `Следующий: ${lessonTitle(next)}, ${formatDayLong(next.starts_at)} в ${formatTime(next.starts_at)}`
              : "Ближайших уроков в расписании пока нет."
          }
        />
      )}
    </section>
  );
}

/* ── «Домашние задания» widget (Figma 19:465) ──────────── */
function HomeworkCard({ homework, now }) {
  if (homework.loading) return <CardSkeleton lines={3} />;
  if (homework.error) return <LoadError error={homework.error} onRetry={homework.reload} />;
  const active = (homework.data || [])
    .filter((item) => [...TO_DO, "overdue"].includes(homeworkState(item, now)))
    .sort((a, b) => (a.due_at ? new Date(a.due_at) : Infinity) - (b.due_at ? new Date(b.due_at) : Infinity))
    .slice(0, 4);

  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Домашние задания</h2>
        <Link to="/student/homework" className="sx-link">
          Все →
        </Link>
      </div>
      {active.length ? (
        <ul className="sx-rows">
          {active.map((item, index) => {
            const badge = deadlineBadge(item, now);
            const iconTone = badge.tone === "red" ? "red" : ["blue", "teal", "violet"][index % 3];
            return (
              <li key={item.id}>
                <Link to={`/student/homework/${item.id}`} className="sx-row">
                  <span className={`sx-row-icon is-${iconTone}`}>
                    <IconHomework size={20} />
                  </span>
                  <span className="sx-row-copy">
                    <strong>{item.title}</strong>
                    <span>
                      {item.course_name || item.group_name}
                      {item.due_at
                        ? ` · до ${new Date(item.due_at).toLocaleString("ru-RU", {
                            day: sameDay(item.due_at, now) ? undefined : "2-digit",
                            month: sameDay(item.due_at, now) ? undefined : "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                    </span>
                  </span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <FxEmpty icon={IconCheck} title="Все задания сданы" body="Новые задания от преподавателя появятся здесь." />
      )}
    </section>
  );
}

/* ── «Прогресс курса» (Figma 19:497) — subscription + per-course attendance ── */
function ProgressCard({ attendance, subs, tones }) {
  if (attendance.loading || subs.loading) return <CardSkeleton lines={4} />;
  const [subscriptions = [], plans = []] = subs.data || [];
  const active = subscriptions.find((item) => item.status === "active" && item.total_lessons);
  const plan = active && plans.find((item) => String(item.id) === String(active.plan));
  const used = active ? active.total_lessons - (active.remaining_lessons ?? 0) : 0;
  const pct = active ? Math.round((used / active.total_lessons) * 100) : 0;

  const byCourse = new Map();
  for (const row of attendance.data || []) {
    if (row.lesson_status === "cancelled" || !row.course) continue;
    const entry = byCourse.get(String(row.course)) || { name: row.course_name, attended: 0, counted: 0 };
    if (["present", "late"].includes(row.status)) entry.attended += 1;
    if (["present", "late", "absent"].includes(row.status)) entry.counted += 1;
    byCourse.set(String(row.course), entry);
  }
  const courses = [...byCourse.entries()].slice(0, 4);

  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Прогресс</h2>
        <Link to="/student/grades" className="sx-link">
          Подробнее →
        </Link>
      </div>
      <div className="fx-progress">
        <FxRing value={pct} max={100} size={140} stroke={16}>
          <strong>{active ? `${pct}%` : "—"}</strong>
          <span>{active ? "абонемента" : "нет пакета"}</span>
        </FxRing>
        <div className="fx-progress-bars">
          {courses.length ? (
            courses.map(([id, entry]) => {
              const rate = entry.counted ? Math.round((entry.attended / entry.counted) * 100) : 0;
              return (
                <div key={id}>
                  <span>
                    {entry.name}
                    <b>{rate}%</b>
                  </span>
                  <div className={`sx-bar is-${tones.get(id) === "blue" ? "" : tones.get(id) || ""}`}>
                    <span style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="sx-muted">Посещаемость по курсам появится после первых уроков.</p>
          )}
          {active ? (
            <p className="sx-muted fx-progress-note">
              {plan?.name || "Абонемент"}: пройдено {used} из {active.total_lessons}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NotificationsCard({ notes, now }) {
  if (notes.loading) return <CardSkeleton lines={3} />;
  if (notes.error) return <LoadError error={notes.error} onRetry={notes.reload} />;
  const latest = (notes.data || []).slice(0, 4);
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Уведомления</h2>
        <Link to="/student/notifications" className="sx-link">
          Все →
        </Link>
      </div>
      {latest.length ? (
        <ul className="sx-rows">
          {latest.map((item) => (
            <li key={item.id}>
              <Link to="/student/notifications" className={`sx-row${item.read ? "" : " is-unread"}`}>
                <span className={`sx-row-icon ${item.read ? "" : "is-teal"}`}>
                  <IconBell size={18} />
                </span>
                <span className="sx-row-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {NOTIFICATION_CATEGORY_LABELS[item.category] || "Уведомление"} · {relativeTime(item.created_at, now)}
                  </span>
                </span>
                {item.read ? null : <span className="fx-unread-dot" aria-label="Не прочитано" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <FxEmpty icon={IconBell} title="Уведомлений пока нет" />
      )}
    </section>
  );
}

function CoursesCard({ lessons, tones, now }) {
  if (lessons.loading) return <CardSkeleton lines={3} />;
  if (lessons.error) return null;
  const courses = new Map();
  for (const lesson of lessons.data || []) {
    const key = String(lesson.course || lesson.group);
    if (!courses.has(key)) {
      courses.set(key, { name: lessonTitle(lesson), group: lesson.group_name, teacher: lesson.teacher_name, next: null });
    }
    const entry = courses.get(key);
    if (!entry.next && new Date(lesson.starts_at).getTime() > now && lesson.status !== "cancelled") entry.next = lesson;
  }
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Мои курсы</h2>
        <Link to="/student/courses" className="sx-link">
          Все →
        </Link>
      </div>
      {courses.size ? (
        <ul className="sx-rows">
          {[...courses.entries()].map(([key, entry]) => (
            <li key={key}>
              <Link to="/student/courses" className="sx-row">
                <span className={`sx-row-icon is-${tones.get(key) || "blue"}`}>
                  <IconStar size={18} />
                </span>
                <span className="sx-row-copy">
                  <strong>{entry.name}</strong>
                  <span>{[entry.group, entry.teacher].filter(Boolean).join(" · ")}</span>
                </span>
                {entry.next ? (
                  <Badge tone="blue" plain>
                    {sameDay(entry.next.starts_at, now) ? "Сегодня" : formatDate(entry.next.starts_at).slice(0, 5)}{" "}
                    {formatTime(entry.next.starts_at)}
                  </Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <FxEmpty icon={IconStar} title="Вы пока не записаны на курсы" />
      )}
    </section>
  );
}

export default function StudentHomePage() {
  const { studentName, card } = useStudentCabinet();
  const now = useNow();
  const lessons = useAsync(loadUpcomingLessons);
  const homework = useAsync(loadHomework);
  const attendance = useAsync(() => listAttendance());
  const invoices = useAsync(listInvoices);
  const subs = useAsync(() => Promise.all([listSubscriptions(), listPlans()]));
  const notes = useAsync(() => listNotifications());
  const [openLesson, setOpenLesson] = useState(null);

  const tones = useMemo(() => courseToneMap(lessons.data), [lessons.data]);
  const stats = useMemo(() => attendanceStats(attendance.data), [attendance.data]);
  const homeworkRows = homework.data || [];
  const states = homeworkRows.map((item) => homeworkState(item, now));
  const done = states.filter((state) => ["submitted", "late", "graded"].includes(state)).length;
  const inWork = states.filter((state) => TO_DO.includes(state)).length;
  const avg = averageGrade(homeworkRows);
  const todayLessons = (lessons.data || []).filter((lesson) => sameDay(lesson.starts_at, now));
  const nextLesson = (lessons.data || []).find(
    (lesson) => new Date(lesson.ends_at).getTime() > now && lesson.status !== "cancelled",
  );
  const dueToday = homeworkRows.filter(
    (item) => item.due_at && sameDay(item.due_at, now) && TO_DO.includes(homeworkState(item, now)),
  ).length;
  const [subscriptions = []] = subs.data || [];
  const activeSub = subscriptions.find((item) => item.status === "active" && item.total_lessons);

  return (
    <div className="sx-page">
      <div className="fx-home-top">
        {card.loading || lessons.loading ? (
          <div className="fx-hero">
            <div className="fx-hero-copy">
              <Skeleton width={140} height={22} radius={11} />
              <Skeleton width="60%" height={32} />
              <Skeleton width="80%" height={16} />
            </div>
          </div>
        ) : (
          <Hero
            name={studentName}
            now={now}
            todayCount={todayLessons.length}
            dueToday={dueToday}
            nextLesson={nextLesson}
            onOpenLesson={setOpenLesson}
          />
        )}
        <PaymentCard invoices={invoices} now={now} />
      </div>

      <div className="sx-kpis">
        {attendance.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconCheck}
            tone="teal"
            label="Посещаемость"
            value={stats.rate == null ? "—" : `${stats.rate}%`}
            note={stats.rate == null ? "Отметок пока нет" : `${stats.attended} из ${stats.attended + stats.missed} уроков`}
            to="/student/grades"
          />
        )}
        {homework.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconStar}
            tone="blue"
            label="Средний балл"
            value={avg == null ? "—" : String(avg).replace(".", ",")}
            note={avg == null ? "Оценок пока нет" : "из 10 баллов"}
            to="/student/grades"
          />
        )}
        {homework.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconHomework}
            tone="violet"
            label="Задания сдано"
            value={`${done}/${homeworkRows.length}`}
            note={inWork ? `${inWork} в работе` : "Все задания сданы"}
            to="/student/homework"
          />
        )}
        {subs.loading ? (
          <KpiSkeleton />
        ) : (
          <Kpi
            icon={IconWallet}
            tone="amber"
            label="Осталось уроков"
            value={activeSub ? activeSub.remaining_lessons ?? 0 : "—"}
            note={activeSub ? `из ${activeSub.total_lessons} в абонементе` : "Нет активного пакета"}
            tag={activeSub && (activeSub.remaining_lessons ?? 0) <= 2 ? "Продлите" : null}
            tagTone="amber"
            to="/student/payments"
          />
        )}
      </div>

      <div className="fx-grid-2">
        <TodayLessons lessons={lessons} tones={tones} now={now} onOpen={setOpenLesson} />
        <HomeworkCard homework={homework} now={now} />
      </div>

      <div className="fx-grid-3">
        <ProgressCard attendance={attendance} subs={subs} tones={tones} />
        <CoursesCard lessons={lessons} tones={tones} now={now} />
        <NotificationsCard notes={notes} now={now} />
      </div>

      {openLesson ? (
        <LessonDialog
          lesson={openLesson}
          homework={homeworkRows.filter((item) => String(item.lesson) === String(openLesson.id))}
          attendance={(attendance.data || []).find((row) => String(row.lesson) === String(openLesson.id))}
          now={now}
          onClose={() => setOpenLesson(null)}
        />
      ) : null}
    </div>
  );
}
