import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Banner, Button, CloseButton, EmptyState, Field, SearchInput } from "@/components/ui";
import { api } from "@/services/api/client";
import { formatWhen } from "@/utils/format";
import { t, translated } from "@/i18n";
import { IconCalendar, IconEye, IconSend, IconUsers } from "./tgIcons";
import { asList } from "./utils";

const CATEGORY_LABELS = translated({
  announcement: "t:tNotif.catAnnouncement",
  schedule: "t:tNotif.catSchedule",
  attendance: "t:tNotif.catAttendance",
  students: "t:tNotif.catStudents",
  system: "t:tNotif.catSystem",
});

const CATEGORY_VALUES = ["announcement", "schedule", "attendance", "students"];

const RECIPIENT_LABELS = translated({
  group: "t:tNotif.toGroup",
  students: "t:tNotif.toStudents",
  student: "t:tNotif.toStudent",
});

const TEMPLATES = [
  { id: "homework", title: "t:tNotif.tplHomeworkTitle", message: "t:tNotif.tplHomeworkText", category: "students" },
  { id: "schedule", title: "t:tNotif.tplScheduleTitle", message: "t:tNotif.tplScheduleText", category: "schedule" },
  { id: "materials", title: "t:tNotif.tplMaterialsTitle", message: "t:tNotif.tplMaterialsText", category: "announcement" },
].map(translated);

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || value || CATEGORY_LABELS.announcement;
}

function recipientsLabel(count) {
  return t("plural.recipients", { count: Number(count) || 0 });
}

function isThisWeek(iso) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

function NotificationsSkeleton() {
  return (
    <div className="tn-page" aria-busy="true">
      <div className="tn-skeleton tn-skeleton-head" />
      <div className="tn-summary">
        <div className="tn-skeleton tn-skeleton-stat" />
        <div className="tn-skeleton tn-skeleton-stat" />
        <div className="tn-skeleton tn-skeleton-stat" />
      </div>
      <div className="tn-skeleton tn-skeleton-list" />
    </div>
  );
}

function SendSheet({
  open,
  onClose,
  onSent,
  groups,
  students,
  enrollments,
  initialGroupId = "",
}) {
  const [mode, setMode] = useState("group");
  const [groupId, setGroupId] = useState(initialGroupId || "");
  const [selectedIds, setSelectedIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("announcement");
  const [sendPush, setSendPush] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("group");
    setGroupId(initialGroupId || (groups[0]?.id ? String(groups[0].id) : ""));
    setSelectedIds([]);
    setStudentSearch("");
    setTitle("");
    setMessage("");
    setCategory("announcement");
    setSendPush(true);
    setError("");
  }, [open, initialGroupId, groups]);

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((row) => [String(row.id), row])),
    [groups],
  );

  const studentsInScope = useMemo(() => {
    const allowedGroups = new Set(groups.map((row) => String(row.id)));
    const byStudent = new Map();
    enrollments
      .filter((row) => row.status === "active" && allowedGroups.has(String(row.group)))
      .forEach((row) => {
        const key = String(row.student);
        if (!byStudent.has(key)) byStudent.set(key, []);
        byStudent.get(key).push(String(row.group));
      });
    return students
      .filter((row) => byStudent.has(String(row.id)))
      .map((row) => ({
        ...row,
        groupIds: byStudent.get(String(row.id)) || [],
      }));
  }, [students, enrollments, groups]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return studentsInScope.filter((row) => {
      if (groupId && !row.groupIds.includes(String(groupId))) return false;
      if (!q) return true;
      return (row.full_name || "").toLowerCase().includes(q);
    });
  }, [studentsInScope, studentSearch, groupId]);

  const recipientCount = useMemo(() => {
    if (mode === "group" && groupId) {
      return enrollments.filter(
        (row) => row.status === "active" && String(row.group) === String(groupId),
      ).length;
    }
    if (mode === "students") return selectedIds.length;
    return 0;
  }, [mode, groupId, selectedIds, enrollments]);

  function applyTemplate(template) {
    setTitle(template.title);
    setMessage(template.message);
    setCategory(template.category);
  }

  function toggleStudent(id) {
    const key = String(id);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError(t("tNotif.needTitleText"));
      return;
    }
    if (recipientCount <= 0) {
      setError(t("tNotif.needRecipients"));
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: title.trim(),
      message: message.trim(),
      category,
      priority: "normal",
      send_push: sendPush,
    };
    if (mode === "group") {
      payload.recipient_type = "group";
      payload.group_id = groupId;
    } else {
      payload.recipient_type = "students";
      payload.student_ids = selectedIds;
    }
    try {
      await api.post("/notifications/send", payload);
      onSent?.(recipientCount);
      onClose();
    } catch (err) {
      setError(err.message || t("tNotif.sendFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="tn-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-send-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tn-sheet-head">
          <div>
            <h2 id="tn-send-title">{t("tNotif.sendTitle")}</h2>
            <p className="muted">{t("tNotif.sendLead")}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>

        <form className="tn-sheet-body" onSubmit={submit}>
          {error ? <Banner>{error}</Banner> : null}

          <div className="tn-templates">
            {TEMPLATES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tn-template"
                onClick={() => applyTemplate(item)}
              >
                {item.title}
              </button>
            ))}
          </div>

          <div className="tn-mode-tabs" role="tablist" aria-label={t("tNotif.recipientType")}>
            <button
              type="button"
              className={mode === "group" ? "is-active" : ""}
              onClick={() => setMode("group")}
            >
              {t("tNotif.group")}
            </button>
            <button
              type="button"
              className={mode === "students" ? "is-active" : ""}
              onClick={() => setMode("students")}
            >
              {t("tNotif.students")}
            </button>
          </div>

          {mode === "group" ? (
            <Field label={t("tNotif.group")}>
              <select
                required
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">{t("tNotif.pickGroup")}</option>
                {groups.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                    {row.active_students != null ? ` · ${row.active_students}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="tn-students-picker">
              <Field label={t("tNotif.groupFilter")}>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">{t("tNotif.allMyGroups")}</option>
                  {groups.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <SearchInput
                value={studentSearch}
                onChange={setStudentSearch}
                placeholder={t("tNotif.findStudent")}
              />
              <div className="tn-students-list" role="listbox" aria-label={t("tNotif.students")}>
                {filteredStudents.length ? (
                  filteredStudents.map((row) => {
                    const checked = selectedIds.includes(String(row.id));
                    const groupNames = row.groupIds
                      .map((id) => groupMap[id]?.name)
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <label key={row.id} className={`tn-student-row ${checked ? "is-checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(row.id)}
                        />
                        <span>
                          <strong>{row.full_name || t("tNotif.student")}</strong>
                          {groupNames ? <span className="muted">{groupNames}</span> : null}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="muted">{t("tNotif.noStudentsFilter")}</p>
                )}
              </div>
              <div className="tn-picker-actions">
                <button
                  type="button"
                  className="tn-text-btn"
                  onClick={() => setSelectedIds(filteredStudents.map((row) => String(row.id)))}
                >
                  {t("tNotif.selectVisible")}
                </button>
                <button
                  type="button"
                  className="tn-text-btn"
                  onClick={() => setSelectedIds([])}
                >
                  {t("common.reset")}
                </button>
              </div>
            </div>
          )}

          <Field label={t("tNotif.category")}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_VALUES.map((value) => [value, CATEGORY_LABELS[value]]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("tNotif.heading")}>
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tNotif.headingPlaceholder")}
            />
          </Field>
          <Field label={t("tNotif.message")}>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("tNotif.messagePlaceholder")}
            />
          </Field>
          <label className="tn-check">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
            />
            <span>{t("tNotif.sendPush")}</span>
          </label>

          <div className="tn-sheet-foot">
            <p className="muted">{recipientsLabel(recipientCount)}</p>
            <div className="tn-sheet-actions">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving || recipientCount <= 0}>
                {t(saving ? "tNotif.sending" : "tNotif.send")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function DetailDrawer({ item, groupName, onClose }) {
  if (!item) return null;
  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="tn-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tn-detail-head">
          <div>
            <p className="tn-card-label">{categoryLabel(item.category)}</p>
            <h2 id="tn-detail-title">{item.title}</h2>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="tn-detail-body">
          <p className="tn-detail-message">{item.message}</p>
          <dl className="tn-dl">
            <div>
              <dt>{t("tNotif.when")}</dt>
              <dd>{formatWhen(item.created_at)}</dd>
            </div>
            <div>
              <dt>{t("tNotif.toWhom")}</dt>
              <dd>
                {RECIPIENT_LABELS[item.recipient_type] || item.recipient_type}
                {groupName ? ` · ${groupName}` : ""}
              </dd>
            </div>
            <div>
              <dt>{t("tNotif.recipients")}</dt>
              <dd>{recipientsLabel(item.recipients_count)}</dd>
            </div>
            <div>
              <dt>{t("tNotif.read")}</dt>
              <dd>
                {t("tNotif.readOf", { read: Number(item.read_count || 0), total: Number(item.recipients_count || 0) })}
              </dd>
            </div>
            <div>
              <dt>Push</dt>
              <dd>{t(item.send_push ? "common.yes" : "common.no")}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function TeacherNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroup = searchParams.get("group") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sent, setSent] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [sendOpen, setSendOpen] = useState(Boolean(initialGroup));
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState(initialGroup);
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sentRows, groupRows, studentRows, enrollmentRows] = await Promise.all([
        asList("/notifications/sent?page_size=100"),
        asList("/groups?page_size=100"),
        asList("/students?page_size=500"),
        asList("/enrollments?page_size=500"),
      ]);
      setSent(sentRows);
      setGroups(groupRows);
      setStudents(studentRows);
      setEnrollments(enrollmentRows);
    } catch (err) {
      setError(err.message || t("tNotif.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const groupNameById = useMemo(
    () => Object.fromEntries(groups.map((row) => [String(row.id), row.name])),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sent.filter((row) => {
      if (groupFilter && String(row.group) !== String(groupFilter)) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (row.title || "").toLowerCase().includes(q) ||
        (row.message || "").toLowerCase().includes(q)
      );
    });
  }, [sent, query, groupFilter, categoryFilter]);

  const stats = useMemo(() => {
    const week = sent.filter((row) => isThisWeek(row.created_at));
    const recipients = sent.reduce((sum, row) => sum + Number(row.recipients_count || 0), 0);
    const read = sent.reduce((sum, row) => sum + Number(row.read_count || 0), 0);
    return {
      total: sent.length,
      week: week.length,
      recipients,
      read,
    };
  }, [sent]);

  function openSend(groupId = "") {
    if (groupId) {
      setGroupFilter(groupId);
      setSearchParams({ group: groupId });
    }
    setSendOpen(true);
  }

  function closeSend() {
    setSendOpen(false);
    if (searchParams.get("group")) {
      setSearchParams({});
    }
  }

  if (loading) return <NotificationsSkeleton />;

  return (
    <div className="tn-page">
      <header className="tn-page-head">
        <div>
          <h1>{t("tNotif.title")}</h1>
          <p className="muted">{t("tNotif.sub")}</p>
        </div>
        <Button type="button" onClick={() => openSend(groupFilter)}>
          {t("tNotif.compose")}
        </Button>
      </header>

      {error ? <Banner>{error}</Banner> : null}
      {toast ? (
        <Banner tone="ok" role="status">
          {toast}
        </Banner>
      ) : null}

      <section className="tg-summary tg-summary-4" aria-label={t("tNotif.summary")}>
        {[
          { key: "sent", label: t("tNotif.statSent"), value: stats.total, Icon: IconSend },
          { key: "week", label: t("tNotif.statWeek"), value: stats.week, Icon: IconCalendar },
          { key: "students", label: t("tNotif.statRecipients"), value: stats.recipients, Icon: IconUsers },
          { key: "read", label: t("tNotif.statRead"), value: stats.read, Icon: IconEye },
        ].map(({ key, label, value, Icon }) => (
          <div key={key} className={`tg-summary-item tg-summary-${key}`}>
            <span className="tg-summary-icon">
              <Icon size={16} />
            </span>
            <div>
              <strong>{value}</strong>
              <span className="tg-summary-label">{label}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="tn-toolbar card">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("tNotif.searchPlaceholder")}
        />
        <label className="tn-filter">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label={t("tNotif.groupFilter")}
          >
            <option value="">{t("common.allGroups")}</option>
            {groups.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="tn-filter">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={t("tNotif.categoryFilter")}
          >
            <option value="">{t("tNotif.allCategories")}</option>
            {CATEGORY_VALUES.map((value) => [value, CATEGORY_LABELS[value]]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {filtered.length ? (
        <ul className="tn-feed">
          {filtered.map((row) => {
            const groupName = groupNameById[String(row.group)] || "";
            const read = Number(row.read_count || 0);
            const total = Number(row.recipients_count || 0);
            const readPct = total ? Math.round((read / total) * 100) : 0;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="tn-card card"
                  onClick={() => setSelected(row)}
                >
                  <div className="tn-card-top">
                    <span className="tn-badge">{categoryLabel(row.category)}</span>
                    <time className="muted" dateTime={row.created_at}>
                      {formatWhen(row.created_at)}
                    </time>
                  </div>
                  <h3>{row.title}</h3>
                  <p className="tn-card-preview">{row.message}</p>
                  <div className="tn-card-meta">
                    <span>
                      {RECIPIENT_LABELS[row.recipient_type] || t("tNotif.recipients")}
                      {groupName ? ` · ${groupName}` : ""}
                    </span>
                    <span>{recipientsLabel(total)}</span>
                    <span>
                      {t("tNotif.readShort", { read, total })}
                      {total ? ` · ${readPct}%` : ""}
                    </span>
                    {row.send_push ? <span className="tn-push">Push</span> : null}
                  </div>
                  {total ? (
                    <span className="tn-read-bar" aria-hidden="true">
                      <span style={{ width: `${readPct}%` }} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={t(sent.length ? "tNotif.nothingFound" : "tNotif.nothingSent")}
          body={
            sent.length
              ? t("tNotif.nothingFoundBody")
              : t("tNotif.nothingSentBody")
          }
          action={
            <Button type="button" onClick={() => openSend(groupFilter)}>
              {t("tNotif.sendTitle")}
            </Button>
          }
        />
      )}

      <SendSheet
        open={sendOpen}
        onClose={closeSend}
        groups={groups}
        students={students}
        enrollments={enrollments}
        initialGroupId={groupFilter || initialGroup}
        onSent={(count) => {
          setToast(t("tNotif.sentToast", { recipients: recipientsLabel(count) }));
          load();
        }}
      />

      <DetailDrawer
        item={selected}
        groupName={selected ? groupNameById[String(selected.group)] || "" : ""}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
