import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banner } from "@/components/ui";
import { STATUS_LABELS } from "@/constants";
import { formatDateTime } from "@/i18n";
import { useI18n } from "@/i18n/useI18n";
import { api, getSession, invalidateApiCache } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { todayLessonsPath } from "@/pages/education-admin/resepshen_yagona/receptionData";
import { isTrialLesson } from "@/pages/education-admin/resepshen_yagona/utils";
import { currentMembership } from "@/services/auth";
import { canAccessEducationSegment, isAdminRole } from "@/utils/roleAccess";
import { formatDate, formatTime, money, results } from "@/utils/format";
import PageFallback from "@/components/layout/PageFallback";
import {
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconFunnel,
  IconRefresh,
  IconUsers,
  IconWallet,
} from "@/pages/education-admin/resepshen_yagona/rxIcons";

const ReceptionDashboard = lazy(() => import("./resepshen_yagona"));

const PAID_STATUSES = new Set(["paid", "void", "canceled", "cancelled"]);
const DAY = 86400000;

function invoiceBalance(row) {
  if (row.balance != null && row.balance !== "") return Number(row.balance);
  return Number(row.amount || 0) - Number(row.paid_amount || 0);
}

function isOverdueInvoice(row) {
  if (!row?.due_at || PAID_STATUSES.has(row.status)) return false;
  if (row.status === "overdue") return true;
  return new Date(row.due_at) < new Date() && invoiceBalance(row) > 0;
}

function isSameLocalDay(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 6) return "owDash.night";
  if (hour < 12) return "owDash.morning";
  if (hour < 18) return "owDash.day";
  return "owDash.evening";
}

export default function DashboardPage() {
  const role = currentMembership(getSession())?.role || "";
  if (isAdminRole(role)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <ReceptionDashboard />
      </Suspense>
    );
  }
  return <OwnerDashboard role={role} />;
}

/** Owner and accountant overview: the day, the money and what needs a decision. */
function OwnerDashboard({ role }) {
  const { t } = useI18n();
  const session = getSession();
  const membership = currentMembership(session);
  const showCrm = role !== "accountant";
  // Links only to sections this role may open (the accountant has no schedule or groups).
  const can = (segment) => canAccessEducationSegment(role, segment);

  const [summary, setSummary] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [attentionAll, setAttentionAll] = useState(false);

  async function load({ fresh = false } = {}) {
    setError("");
    setLoading(true);
    if (fresh) invalidateApiCache(session.tenantId);
    try {
      const [nextSummary, nextLessons, nextGroups, nextStudents, nextInvoices, nextPayments, nextLeads] =
        await Promise.all([
          api.get("/dashboard/summary", { cache: true }),
          getList(todayLessonsPath(), { cache: true }),
          getList("/groups?page_size=500", { cache: true }).catch(() => []),
          getList("/students?page_size=500", { cache: true }),
          getList("/invoices?page_size=500", { cache: true }),
          getList("/payments?page_size=500&ordering=-paid_at", { cache: true }).catch(() => []),
          showCrm ? getList("/leads?page_size=500", { cache: true }).catch(() => []) : [],
        ]);
      setSummary(nextSummary);
      setLessons(results(nextLessons));
      setGroups(results(nextGroups));
      setStudents(results(nextStudents));
      setInvoices(results(nextInvoices));
      setPayments(results(nextPayments));
      setLeads(results(nextLeads));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [session.tenantId, showCrm]);

  const studentName = useMemo(() => {
    const map = new Map(students.map((row) => [String(row.id), row.full_name]));
    return (id) => map.get(String(id)) || "—";
  }, [students]);

  const now = Date.now();
  const lessonsToday = useMemo(
    () =>
      lessons
        .filter((row) => isSameLocalDay(row.starts_at))
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [lessons],
  );
  const nextLesson = lessonsToday.find((row) => row.status !== "cancelled" && new Date(row.starts_at) > now);

  const overdueInvoices = useMemo(
    () => invoices.filter(isOverdueInvoice).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)),
    [invoices],
  );
  const dueSoon = useMemo(
    () =>
      invoices.filter((row) => {
        if (PAID_STATUSES.has(row.status) || isOverdueInvoice(row) || !row.due_at) return false;
        const due = new Date(row.due_at).getTime();
        return due >= Date.now() && due <= Date.now() + 7 * DAY && invoiceBalance(row) > 0;
      }),
    [invoices],
  );
  const followUpsDue = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return leads
      .filter((row) => !row.converted_student && row.next_follow_up_at && new Date(row.next_follow_up_at) <= end)
      .sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
  }, [leads]);
  const activeGroups = useMemo(() => groups.filter((row) => row.is_active !== false), [groups]);
  const fullGroups = useMemo(
    () => activeGroups.filter((row) => Number(row.capacity) > 0 && Number(row.active_students || 0) >= Number(row.capacity)),
    [activeGroups],
  );

  const succeeded = useMemo(() => payments.filter((row) => !row.status || row.status === "succeeded"), [payments]);
  const months = useMemo(() => {
    const list = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth(), date: d, total: 0, count: 0 });
    }
    succeeded.forEach((row) => {
      const paid = new Date(row.paid_at || row.created_at || 0);
      const slot = list.find((item) => item.year === paid.getFullYear() && item.month === paid.getMonth());
      if (slot) {
        slot.total += Number(row.amount || 0);
        slot.count += 1;
      }
    });
    return list;
  }, [succeeded]);
  const thisMonth = months[months.length - 1];
  const maxMonth = Math.max(1, ...months.map((item) => item.total));

  const currency = summary?.currency || membership?.currency || "UZS";
  const leadsInfo = summary?.leads || {};
  const stages = leadsInfo.by_stage || [];
  const maxStage = Math.max(1, ...stages.map((stage) => stage.count));

  const attention = useMemo(() => {
    const items = [];
    overdueInvoices.forEach((row) =>
      items.push({
        id: `inv-${row.id}`,
        tone: "is-red",
        title: t("owDash.aDebt", { amount: money(invoiceBalance(row), row.currency || currency) }),
        detail: t("owDash.aDebtDetail", { name: studentName(row.student), date: formatDate(row.due_at) }),
        to: "billing",
      }),
    );
    if (showCrm) {
      followUpsDue.forEach((row) =>
        items.push({
          id: `lead-${row.id}`,
          tone: "is-amber",
          title: t("owDash.aCall", { name: row.full_name }),
          detail: row.phone || row.source || "",
          to: "crm",
        }),
      );
    }
    (can("groups") ? fullGroups : []).forEach((row) =>
      items.push({
        id: `group-${row.id}`,
        tone: "is-blue",
        title: t("owDash.aFull", { name: row.name }),
        detail: t("owDash.aFullDetail", { active: row.active_students, capacity: row.capacity }),
        to: "groups",
      }),
    );
    return items;
  }, [overdueInvoices, followUpsDue, fullGroups, studentName, currency, showCrm, t, role]);

  const quick = showCrm
    ? [
        { to: "crm", tone: "is-blue", icon: IconFunnel, title: "owDash.qLead", hint: "owDash.qLeadHint" },
        { to: "billing", tone: "is-navy", icon: IconWallet, title: "owDash.qPay", hint: "owDash.qPayHint" },
        { to: "students", icon: IconUsers, title: "owDash.qStudents", hint: "owDash.qStudentsHint" },
        { to: "schedule", icon: IconCalendar, title: "owDash.qSchedule", hint: "owDash.qScheduleHint" },
        { to: "finance", icon: IconChart, title: "owDash.qFinance", hint: "owDash.qFinanceHint" },
      ]
    : [
        { to: "billing", tone: "is-blue", icon: IconWallet, title: "owDash.qPay", hint: "owDash.qPayHint" },
        { to: "finance", tone: "is-navy", icon: IconChart, title: "owDash.qFinance", hint: "owDash.qFinanceHint" },
        { to: "students", icon: IconUsers, title: "owDash.qStudents", hint: "owDash.qStudentsHint" },
      ];
  if (role === "owner") {
    quick.push({ to: "staff", icon: IconBriefcase, title: "owDash.qTeam", hint: "owDash.qTeamHint" });
  }

  function lessonState(row) {
    if (row.status === "cancelled") return { key: "is-done", pill: <span className="rx-pill is-red">{t("owDash.cancelled")}</span> };
    const start = new Date(row.starts_at).getTime();
    const end = new Date(row.ends_at || row.starts_at).getTime();
    if (end <= now) return { key: "is-done", pill: <span className="rx-pill">{t("owDash.done")}</span> };
    if (start <= now) return { key: "is-live", pill: <span className="rx-pill is-teal">{t("owDash.live")}</span> };
    if (!row.teacher) return { key: "is-noteacher", pill: <span className="rx-pill is-amber">{t("owDash.planned")}</span> };
    return { key: start - now <= 3 * 3600000 ? "is-soon" : "is-planned", pill: <span className="rx-pill">{t("owDash.planned")}</span> };
  }

  async function exportAnalytics() {
    setError("");
    setExporting(true);
    try {
      const { downloadExcelBook, excelStamp } = await import("@/utils/exportExcel");
      const center = membership?.tenant_name || membership?.tenant_slug || "center";
      const monthPayments = succeeded.filter((row) => {
        const paid = new Date(row.paid_at || row.created_at || 0);
        return paid.getFullYear() === thisMonth.year && paid.getMonth() === thisMonth.month;
      });
      downloadExcelBook(`yagona-${center}-overview_${excelStamp()}.xlsx`, [
        {
          name: t("owDash.xSummary"),
          rows: [
            { metric: t("owDash.sStudents"), value: summary?.active_students ?? "" },
            { metric: t("owDash.sLessons"), value: summary?.lessons_today ?? lessonsToday.length },
            ...(showCrm
              ? [
                  { metric: t("owDash.sLeads"), value: leadsInfo.total ?? leads.length },
                  { metric: t("owDash.xConversion"), value: leadsInfo.conversion_rate ?? "" },
                ]
              : []),
            { metric: t("owDash.xOverdueCount"), value: summary?.overdue_invoices ?? overdueInvoices.length },
            { metric: t("owDash.xOverdueSum"), value: Number(summary?.overdue_total || 0) },
            { metric: t("owDash.sCollected"), value: Number(summary?.collected_this_month || thisMonth.total) },
            { metric: t("owDash.sDueSoon"), value: dueSoon.length },
            { metric: t("owDash.xCurrency"), value: currency },
          ],
          columns: [
            { key: "metric", title: t("owDash.xMetric") },
            { key: "value", title: t("owDash.xValue") },
          ],
        },
        {
          name: t("owDash.xOverdue"),
          rows: overdueInvoices,
          columns: [
            { key: "number", title: t("owDash.xNumber"), value: (row) => row.number || "" },
            { key: "student", title: t("owDash.xStudent"), value: (row) => studentName(row.student) },
            { key: "amount", title: t("owDash.xAmount"), value: (row) => Number(row.amount || 0) },
            { key: "balance", title: t("owDash.xDebt"), value: (row) => invoiceBalance(row) },
            { key: "due_at", title: t("owDash.xDue"), value: (row) => (row.due_at ? formatDate(row.due_at) : "") },
          ],
        },
        {
          name: t("owDash.xPayments"),
          rows: monthPayments,
          columns: [
            { key: "paid_at", title: t("owDash.xDate"), value: (row) => formatDate(row.paid_at || row.created_at) },
            { key: "student", title: t("owDash.xStudent"), value: (row) => row.student_name || "" },
            { key: "amount", title: t("owDash.xAmount"), value: (row) => Number(row.amount || 0) },
            { key: "method", title: t("owDash.xMethod"), value: (row) => STATUS_LABELS[row.method] || row.method || "" },
          ],
        },
        {
          name: t("owDash.xLessons"),
          rows: lessonsToday,
          columns: [
            { key: "starts_at", title: t("owDash.xTime"), value: (row) => formatTime(row.starts_at) },
            { key: "group", title: t("owDash.xGroup"), value: (row) => row.group_name || "" },
            { key: "teacher", title: t("owDash.xTeacher"), value: (row) => row.teacher_name || "" },
            { key: "room", title: t("owDash.xRoom"), value: (row) => row.room_name || "" },
          ],
        },
      ]);
    } catch (err) {
      setError(err.message || t("owDash.excelFailed"));
    } finally {
      setExporting(false);
    }
  }

  const userName = session.user?.first_name || session.user?.full_name || session.user?.email?.split("@")[0] || "";
  const ready = summary || !loading;
  const shownAttention = attentionAll ? attention : attention.slice(0, 6);

  return (
    <div className="reception-page rx-dash ow-dash">
      <header className="rx-hero">
        <div>
          <p className="rx-hero-date">
            {formatDateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {membership?.tenant_name || ""}
          </p>
          <h1>
            {t(greetingKey())}
            {userName ? `, ${userName}` : ""}
          </h1>
        </div>
        <div className="rx-hero-actions">
          <button type="button" className="rx-btn is-outline" onClick={exportAnalytics} disabled={loading || exporting}>
            {t("owDash.excel")}
          </button>
          <button type="button" className="rx-btn is-outline" onClick={() => load({ fresh: true })} disabled={loading}>
            <IconRefresh size={18} />
            {loading ? t("owDash.refreshing") : t("owDash.refresh")}
          </button>
        </div>
      </header>

      <section className="rx-quick" aria-label={t("owDash.quick")}>
        {quick.map(({ to, tone, icon: Icon, title, hint }) => (
          <Link key={to} to={to} className={`rx-quick-card ${tone || ""}`.trim()}>
            <span className="rx-quick-icon">
              <Icon size={20} />
            </span>
            <strong>{t(title)}</strong>
            <small>{t(hint)}</small>
          </Link>
        ))}
      </section>

      {error ? <Banner>{error}</Banner> : null}

      {!ready ? (
        <p className="rx-loading">{t("owDash.loading")}</p>
      ) : (
        <>
          <section className="rx-stats" aria-label={t("owDash.glance")}>
            <article className="rx-stat">
              <span>{t("owDash.sStudents")}</span>
              <strong>{summary?.active_students ?? "—"}</strong>
              <small>{t("owDash.sStudentsHint", { count: activeGroups.length })}</small>
            </article>
            <article className="rx-stat">
              <span>{t("owDash.sLessons")}</span>
              <strong>{lessonsToday.filter((row) => row.status !== "cancelled").length}</strong>
              <small>
                {nextLesson ? t("owDash.sLessonsNext", { time: formatTime(nextLesson.starts_at) }) : t("owDash.sLessonsNone")}
              </small>
            </article>
            {showCrm ? (
              <article className="rx-stat">
                <span>{t("owDash.sLeads")}</span>
                <strong>{leadsInfo.total ?? 0}</strong>
                <small>{t("owDash.sLeadsHint", { pct: leadsInfo.conversion_rate ?? 0 })}</small>
              </article>
            ) : (
              <article className="rx-stat">
                <span>{t("owDash.sDueSoon")}</span>
                <strong className={dueSoon.length ? "is-amber" : ""}>{dueSoon.length}</strong>
                <small>{t("owDash.sDueSoonHint")}</small>
              </article>
            )}
            <article className="rx-stat">
              <span>{t("owDash.sCollected")}</span>
              <strong>{money(summary?.collected_this_month ?? thisMonth.total, currency)}</strong>
              <small>{t("owDash.sCollectedHint", { count: thisMonth.count })}</small>
            </article>
            <article className="rx-stat">
              <span>{t("owDash.sDebt")}</span>
              <strong className={Number(summary?.overdue_total) > 0 ? "is-red" : ""}>
                {money(summary?.overdue_total ?? 0, currency)}
              </strong>
              <small>{t("owDash.sDebtHint", { count: summary?.overdue_invoices ?? overdueInvoices.length })}</small>
            </article>
          </section>

          <div className="rx-grid">
            <div className="rx-col">
              <section className="rx-card">
                <div className="rx-card-head">
                  <div>
                    <h2>
                      {t("owDash.lessonsToday")} <span className="rx-count">{lessonsToday.length}</span>
                    </h2>
                    <p>{t("owDash.lessonsTodayHint")}</p>
                  </div>
                </div>
                {lessonsToday.length ? (
                  <ul className="rx-lessons ow-lessons">
                    {lessonsToday.map((row) => {
                      const state = lessonState(row);
                      return (
                        <li key={row.id}>
                          <Link to={can("schedule") ? "schedule" : "."} className={`rx-lesson ${state.key}`}>
                            <span className="rx-lesson-time">{formatTime(row.starts_at)}</span>
                            <span className="rx-lesson-copy">
                              <strong>
                                {row.group_name || "—"}
                                {row.course_name && row.course_name !== row.group_name ? <em>{row.course_name}</em> : null}
                                {isTrialLesson(row) ? <em className="is-trial">{t("owDash.trial")}</em> : null}
                              </strong>
                              <small className={row.teacher ? "" : "is-red"}>
                                {row.teacher_name || t("owDash.noTeacher")}
                                {row.room_name ? ` · ${row.room_name}` : ""}
                              </small>
                            </span>
                            {state.pill}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rx-empty">{t("owDash.noLessons")}</p>
                )}
                {can("schedule") ? (
                  <Link className="rx-link" to="schedule">
                    {t("owDash.openSchedule")} <IconArrowRight size={14} />
                  </Link>
                ) : null}
              </section>

              <section className="rx-card">
                <div className="rx-card-head">
                  <div>
                    <h2>{t("owDash.income")}</h2>
                    <p>{t("owDash.incomeHint")}</p>
                  </div>
                  <Link className="rx-link is-head" to="billing">
                    {t("owDash.openBilling")}
                  </Link>
                </div>
                {months.some((item) => item.total > 0) ? (
                  <ol className="ow-bars">
                    {months.map((item) => (
                      <li key={`${item.year}-${item.month}`} className={item === thisMonth ? "is-current" : ""}>
                        <b>{item.total ? money(item.total, currency) : "—"}</b>
                        <span className="ow-bar">
                          <i style={{ height: `${Math.max(item.total ? 4 : 0, Math.round((item.total / maxMonth) * 100))}%` }} />
                        </span>
                        <small>{formatDateTime(item.date, { month: "short" })}</small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rx-empty">{t("owDash.incomeEmpty")}</p>
                )}
              </section>
            </div>

            <div className="rx-col">
              <section className="rx-card">
                <div className="rx-card-head">
                  <h2>
                    {t("owDash.attention")}{" "}
                    <span className={`rx-count${attention.length ? " is-red" : ""}`}>{attention.length}</span>
                  </h2>
                </div>
                {attention.length ? (
                  <ul className="rx-attn">
                    {shownAttention.map((item) => (
                      <li key={item.id}>
                        <span className={`rx-attn-icon ${item.tone}`} aria-hidden="true">
                          !
                        </span>
                        <span className="rx-hit-copy">
                          <strong>{item.title}</strong>
                          {item.detail ? <small>{item.detail}</small> : null}
                        </span>
                        <Link className="rx-btn is-outline is-sm" to={item.to}>
                          {t("owDash.open")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rx-empty">{t("owDash.attentionNone")}</p>
                )}
                {attention.length > 6 ? (
                  <button type="button" className="rx-link" onClick={() => setAttentionAll((value) => !value)}>
                    {attentionAll ? t("owDash.showLess") : t("owDash.showAll", { count: attention.length })}
                  </button>
                ) : null}
              </section>

              {showCrm ? (
                <section className="rx-card">
                  <div className="rx-card-head">
                    <div>
                      <h2>{t("owDash.funnel")}</h2>
                      <p>{t("owDash.funnelHint", { converted: leadsInfo.converted ?? 0, calls: followUpsDue.length })}</p>
                    </div>
                    <Link className="rx-link is-head" to="crm">
                      {t("owDash.openCrm")}
                    </Link>
                  </div>
                  {stages.length ? (
                    <ul className="ow-meter">
                      {stages.map((stage) => (
                        <li key={stage.id}>
                          <span>{stage.name}</span>
                          <i className="rx-bar">
                            <i style={{ width: `${Math.round((stage.count / maxStage) * 100)}%` }} />
                          </i>
                          <b>{stage.count}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rx-empty">{t("owDash.funnelEmpty")}</p>
                  )}
                </section>
              ) : null}

              <section className="rx-card">
                <div className="rx-card-head">
                  <h2>{t("owDash.groupsCard")}</h2>
                  {can("groups") ? (
                    <Link className="rx-link is-head" to="groups">
                      {t("owDash.openGroups")}
                    </Link>
                  ) : null}
                </div>
                {activeGroups.length ? (
                  <ul className="ow-meter">
                    {[...activeGroups]
                      .sort((a, b) => (Number(b.active_students) || 0) - (Number(a.active_students) || 0))
                      .slice(0, 6)
                      .map((row) => {
                        const active = Number(row.active_students || 0);
                        const cap = Number(row.capacity || 0);
                        const pct = cap ? Math.min(100, Math.round((active / cap) * 100)) : 0;
                        return (
                          <li key={row.id} className={cap && active >= cap ? "is-full" : ""}>
                            <span>{row.name}</span>
                            <i className="rx-bar">
                              <i style={{ width: `${pct}%` }} />
                            </i>
                            <b>{cap ? `${active}/${cap}` : active}</b>
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <p className="rx-empty">{t("owDash.groupsEmpty")}</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
