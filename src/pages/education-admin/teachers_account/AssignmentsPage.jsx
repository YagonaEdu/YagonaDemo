import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Banner, Button, EmptyState, SearchInput } from "@/components/ui";
import { t, translated } from "@/i18n";
import {
  gradeHomeworkSubmission,
  getHomeworkSubmissions,
  listTeacherHomeworks,
  remindHomework,
  returnHomeworkSubmission,
  setHomeworkPublished,
} from "./homeworkApi";
import AssignmentDetailPanel from "./AssignmentDetailPanel";
import CreateAssignmentSheet from "./CreateAssignmentSheet";
import GradeSubmissionSheet from "./GradeSubmissionSheet";
import ReminderConfirmModal from "./ReminderConfirmModal";
import {
  assignmentDueMeta,
  assignmentStatusLabel,
  buildAttentionItems,
  filterAssignmentTab,
  formatDueLabel,
  pendingReviewCount,
  sortAssignments,
} from "./assignmentHelpers";
import { asList } from "./utils";
import { IconUsers, SUMMARY_ICON_MAP } from "./tgIcons";

const TABS = [
  { id: "all", label: "t:tAsg.tabAll" },
  { id: "active", label: "t:tAsg.tabActive" },
  { id: "review", label: "t:tAsg.tabReview" },
  { id: "past", label: "t:tAsg.tabPast" },
  { id: "draft", label: "t:tAsg.tabDraft" },
].map(translated);

function ListSkeleton() {
  return (
    <div className="ta-skeleton">
      {[1, 2, 3, 4, 5].map((key) => (
        <div key={key} className="ta-skeleton-row" />
      ))}
    </div>
  );
}

function AssignmentRow({ row, onOpen, onReview, onMenuAction }) {
  const pending = pendingReviewCount(row);
  const status = assignmentStatusLabel(row);
  const total = Number(row.total_students || 0);
  const submitted = Number(row.handed_count || 0);
  const pct = total ? Math.round((submitted / total) * 100) : 0;

  return (
    <article className="ta-row">
      <button type="button" className="ta-row-main" onClick={() => onOpen(row)}>
        <div className="ta-row-head">
          <div>
            <strong>{row.title}</strong>
            <p className="tg-muted">
              {row.groupName}
              {row.courseName ? ` · ${row.courseName}` : ""}
            </p>
          </div>
          <div className="ta-row-badges">
            <span className={`tg-pill tg-pill-${statusTone(status.tone)}`}>{status.label}</span>
          </div>
        </div>
        <div className="ta-row-meta">
          <span>{t("tAsg.due", { date: formatDueLabel(row.due_at) })}</span>
          <span>
            {t("tAsg.handed", { done: submitted, total: total || "—" })}
          </span>
          {pending > 0 ? <span className="ta-meta-warn">{t("tAsg.toReview", { count: pending })}</span> : null}
          {row.missing_count > 0 ? <span className="ta-meta-warn">{t("tAsg.notHanded", { count: row.missing_count })}</span> : null}
        </div>
        <div className="ta-row-progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </button>
      <div className="ta-row-actions">
        {pending > 0 ? (
          <Button onClick={() => onReview(row)}>{t("tAsg.reviewCount", { count: pending })}</Button>
        ) : (
          <Button variant="ghost" onClick={() => onOpen(row)}>
            {t("common.open")}
          </Button>
        )}
        <div className="ta-menu-wrap">
          <button
            type="button"
            className="ta-menu-btn"
            aria-label={t("tAsg.menuLabel")}
            onClick={(e) => {
              e.stopPropagation();
              onMenuAction(row, "menu");
            }}
          >
            ⋯
          </button>
          <div className="ta-menu">
            <button type="button" onClick={() => onMenuAction(row, "open")}>
              {t("common.open")}
            </button>
            <button type="button" onClick={() => onMenuAction(row, "edit")}>
              {t("common.edit")}
            </button>
            <button type="button" onClick={() => onMenuAction(row, "duplicate")}>
              {t("common.duplicate")}
            </button>
            {row.status === "published" ? (
              <button type="button" onClick={() => onMenuAction(row, "unpublish")}>
                {t("common.unpublish")}
              </button>
            ) : (
              <button type="button" onClick={() => onMenuAction(row, "publish")}>
                {t("common.publish")}
              </button>
            )}
            {row.missing_count > 0 ? (
              <button type="button" onClick={() => onMenuAction(row, "remind")}>
                {t("tAsg.remind")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function statusTone(tone) {
  if (tone === "active") return "green";
  if (tone === "overdue") return "red";
  if (tone === "today") return "warn";
  return "muted";
}

export default function TeacherAssignmentsPage() {
  const [searchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState(null);
  const [duplicateSeed, setDuplicateSeed] = useState(null);
  const [grading, setGrading] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, g, c, s] = await Promise.all([
        listTeacherHomeworks(),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
        asList("/students?page_size=500"),
      ]);
      setAssignments(a);
      setGroups(g);
      setCourses(c);
      setStudents(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const group = searchParams.get("group");
    const status = searchParams.get("status");
    if (group) setGroupFilter(group);
    if (status === "review") setTab("review");
  }, [searchParams]);

  const groupMap = useMemo(() => new Map(groups.map((row) => [String(row.id), row])), [groups]);
  const courseMap = useMemo(() => new Map(courses.map((row) => [String(row.id), row.name])), [courses]);
  const studentMap = useMemo(() => new Map(students.map((row) => [String(row.id), row])), [students]);

  const enriched = useMemo(
    () =>
      assignments.map((row) => ({
        ...row,
        groupName: row.group_name || groupMap.get(String(row.group))?.name || "—",
        courseName: row.course_name || courseMap.get(String(row.course)) || "—",
      })),
    [assignments, groupMap, courseMap],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortAssignments(
      enriched.filter((row) => {
        if (!filterAssignmentTab(tab, row)) return false;
        if (groupFilter && String(row.group) !== groupFilter) return false;
        if (courseFilter && String(row.course) !== courseFilter) return false;
        if (q && !row.title.toLowerCase().includes(q) && !row.groupName.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [enriched, tab, query, groupFilter, courseFilter, groupMap]);

  const summary = useMemo(() => {
    const active = enriched.filter((row) => row.status === "published").length;
    const pending = enriched.reduce((sum, row) => sum + pendingReviewCount(row), 0);
    const missing = enriched.reduce((sum, row) => sum + Number(row.missing_count || 0), 0);
    const dueSoon = enriched.filter(
      (row) => row.status === "published" && assignmentDueMeta(row.due_at, row.status)?.tone === "today",
    ).length;
    return [
      { key: "groups", label: t("tAsg.statActive"), value: active },
      { key: "reviews", label: t("tAsg.statReview"), value: pending },
      { key: "students", label: t("tAsg.statMissing"), value: missing },
      { key: "week", label: t("tAsg.statSoon"), value: dueSoon },
    ];
  }, [enriched]);

  const attentionItems = useMemo(() => buildAttentionItems(enriched, groupMap), [enriched, groupMap]);

  async function openAssignment(row) {
    setSelected(row);
    try {
      setSubmissions(await getHomeworkSubmissions(row.id));
    } catch {
      setSubmissions([]);
    }
  }

  async function handlePublished(id, isPublished) {
    try {
      await setHomeworkPublished(id, isPublished);
      await load();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, is_published: isPublished, status: isPublished ? "published" : "draft" } : prev));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmRemind() {
    if (!reminderTarget) return;
    setReminderBusy(true);
    try {
      const { sent } = await remindHomework(reminderTarget.id);
      setReminderTarget(null);
      setNotice(t("tAsg.reminderSent", { count: sent }));
    } catch (err) {
      setError(err.message);
    } finally {
      setReminderBusy(false);
    }
  }

  async function handleGrade(payload, { goNext = false, returnWork = false } = {}) {
    if (!grading) return;
    if (returnWork) await returnHomeworkSubmission(grading.id, payload.feedback);
    else await gradeHomeworkSubmission(grading.id, payload);
    const data = await getHomeworkSubmissions(selected.id);
    setSubmissions(data);
    await load();
    if (goNext) {
      const idx = data.findIndex((row) => row.id === grading.id);
      const next = data.slice(idx + 1).find((row) => ["submitted", "late"].includes(row.status));
      setGrading(next || null);
    } else {
      setGrading(null);
    }
  }

  function startReview(row, subs = submissions) {
    const first = subs.find((item) => ["submitted", "late"].includes(item.status));
    if (first) setGrading(first);
    else openAssignment(row);
  }

  function handleMenuAction(row, action) {
    if (action === "open") openAssignment(row);
    if (action === "edit") {
      setEditAssignment(row);
      setCreateOpen(true);
    }
    if (action === "duplicate") {
      setDuplicateSeed({
        group: row.group,
        title: t("tAsg.copySuffix", { title: row.title }),
        description: row.description,
        due_at: null,
        max_score: row.max_score,
        allow_late: row.allow_late,
        allow_resubmit: row.allow_resubmit,
        // Links carry over; files would need re-uploading.
        attachments: (row.attachments || []).filter((item) => item.url),
      });
      setEditAssignment(null);
      setCreateOpen(true);
    }
    if (action === "unpublish") handlePublished(row.id, false);
    if (action === "publish") handlePublished(row.id, true);
    if (action === "remind") setReminderTarget(row);
  }

  function handleAttention(item) {
    openAssignment(item.assignment).then(() => {
      if (item.mode === "review") startReview(item.assignment);
      if (item.mode === "missing") setReminderTarget(item.assignment);
    });
  }

  const hasFilters = Boolean(query || groupFilter || courseFilter);

  return (
    <div className="ta-page">
      <header className="tg-header ta-header">
        <div>
          <h1>{t("tAsg.title")}</h1>
          <p className="tg-sub">{t("tAsg.sub")}</p>
        </div>
        <Button onClick={() => { setEditAssignment(null); setDuplicateSeed(null); setCreateOpen(true); }}>
          {t("tAsg.create")}
        </Button>
      </header>

      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      {error ? (
        <Banner>
          {error}{" "}
          <Button variant="ghost" onClick={load}>
            {t("common.retry")}
          </Button>
        </Banner>
      ) : null}

      <div className="tg-summary tg-summary-4">
        {summary.map((item) => {
          const Icon = SUMMARY_ICON_MAP[item.key] || IconUsers;
          return (
            <div key={item.key} className={`tg-summary-item tg-summary-${item.key}`}>
              <span className="tg-summary-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{loading ? "…" : item.value}</strong>
                <span className="tg-summary-label">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ta-split">
        <section className="ta-main">
          <div className="tg-student-tabs ta-tabs" role="tablist" aria-label={t("tAsg.tabsLabel")}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="ta-toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder={t("tAsg.searchPlaceholder")} />
            <button
              type="button"
              className="ts-filters-toggle"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              {t("common.filters")}
            </button>
            <div className={`ts-toolbar-filters${filtersOpen ? " is-open" : ""}`}>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label={t("tAsg.group")}>
                <option value="">{t("common.allGroups")}</option>
                {groups.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label={t("tAsg.course")}>
                <option value="">{t("common.allCourses")}</option>
                {courses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              {hasFilters ? (
                <button
                  type="button"
                  className="ts-reset-btn"
                  onClick={() => {
                    setQuery("");
                    setGroupFilter("");
                    setCourseFilter("");
                  }}
                >
                  {t("common.reset")}
                </button>
              ) : null}
            </div>
          </div>

          {loading ? <ListSkeleton /> : null}
          {!loading && !rows.length ? (
            <EmptyState
              title={t("tAsg.emptyTitle")}
              body={t("tAsg.emptyBody")}
              action={
                <Button onClick={() => setCreateOpen(true)}>{t("tAsg.createPlain")}</Button>
              }
            />
          ) : null}

          <div className="ta-list">
            {rows.map((row) => (
              <AssignmentRow
                key={row.id}
                row={row}
                onOpen={openAssignment}
                onReview={(item) => openAssignment(item).then(() => startReview(item))}
                onMenuAction={handleMenuAction}
              />
            ))}
          </div>
        </section>

        <aside className="ta-aside">
          <h2 className="ta-aside-title">{t("tAsg.attentionTitle")}</h2>
          {!attentionItems.length ? (
            <p className="tg-muted">{t("tAsg.attentionNone")}</p>
          ) : (
            <ul className="ta-attention-list">
              {attentionItems.map((item) => (
                <li key={item.key}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="tg-muted">{item.subtitle}</p>
                  </div>
                  <Button variant="ghost" onClick={() => handleAttention(item)}>
                    {item.action}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <CreateAssignmentSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditAssignment(null);
          setDuplicateSeed(null);
        }}
        groups={groups}
        courses={courses}
        initialGroup={searchParams.get("group") || ""}
        assignment={editAssignment}
        duplicateSeed={duplicateSeed}
        onSaved={async () => {
          setCreateOpen(false);
          setEditAssignment(null);
          setDuplicateSeed(null);
          await load();
        }}
      />

      <AssignmentDetailPanel
        assignment={selected}
        submissions={submissions.map((row) => ({
          ...row,
          studentName: row.student_name || studentMap.get(String(row.student))?.full_name || "—",
        }))}
        groupName={selected ? groupMap.get(String(selected.group))?.name : ""}
        courseName={selected?.courseName || ""}
        onClose={() => {
          setSelected(null);
          setSubmissions([]);
        }}
        onGrade={(row) => setGrading(row)}
        onRemind={() => selected && setReminderTarget(selected)}
        onPublish={() => selected && handlePublished(selected.id, true)}
        onEdit={() => {
          setEditAssignment(selected);
          setCreateOpen(true);
        }}
        onDuplicate={() => selected && handleMenuAction(selected, "duplicate")}
        onCloseAssignment={() => selected && handlePublished(selected.id, false)}
        onReviewFirst={(row, subs) => startReview(row, subs)}
      />

      <GradeSubmissionSheet
        submission={grading}
        assignment={selected}
        studentName={grading ? grading.student_name || studentMap.get(String(grading.student))?.full_name : ""}
        onClose={() => setGrading(null)}
        onSave={handleGrade}
      />

      <ReminderConfirmModal
        open={Boolean(reminderTarget)}
        recipients={reminderTarget?.missing_count || 0}
        assignmentTitle={reminderTarget?.title || ""}
        busy={reminderBusy}
        onCancel={() => setReminderTarget(null)}
        onConfirm={confirmRemind}
      />
    </div>
  );
}
