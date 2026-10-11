import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Banner, Button, CloseButton } from "@/components/ui";
import { formatBytes, formatDayShort, formatTime, today } from "@/utils/format";
import { t } from "@/i18n";
import {
  addHomeworkFile,
  addHomeworkLink,
  deleteHomeworkAttachment,
  listGroupLessons,
  saveHomework,
} from "./homeworkApi";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,.mp3,.m4a,.webm,.mp4";
const MAX_FILE = 50 * 1024 * 1024;

const EMPTY = {
  group: "",
  lesson: "",
  title: "",
  description: "",
  due_date: today(),
  due_time: "18:00",
  graded: true,
  max_score: "10",
  allow_late: true,
  allow_resubmit: false,
};

function toForm(source) {
  if (!source) return { ...EMPTY, due_date: today() };
  const due = source.due_at ? new Date(source.due_at) : null;
  const pad = (value) => String(value).padStart(2, "0");
  return {
    group: String(source.group || ""),
    lesson: source.lesson ? String(source.lesson) : "",
    title: source.title || "",
    description: source.description || "",
    due_date: due ? `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}` : today(),
    due_time: due ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : "18:00",
    graded: source.max_score != null,
    max_score: source.max_score != null ? String(source.max_score) : "10",
    allow_late: source.allow_late ?? true,
    allow_resubmit: source.allow_resubmit ?? false,
  };
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="ta-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ta-switch-track" aria-hidden="true" />
      <span className="ta-switch-copy">
        <strong>{label}</strong>
        {hint ? <em>{hint}</em> : null}
      </span>
    </label>
  );
}

export default function CreateAssignmentSheet({
  open,
  onClose,
  groups = [],
  initialGroup = "",
  initialLesson = "",
  lockGroup = false,
  assignment = null,
  duplicateSeed = null,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY);
  const [lessons, setLessons] = useState([]);
  const [existing, setExisting] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkDraft, setLinkDraft] = useState({ url: "", title: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const source = assignment || duplicateSeed;
  const isEdit = Boolean(assignment?.id);
  const published = Boolean(assignment?.is_published);

  useEffect(() => {
    if (!open) return;
    const base = toForm(source);
    setForm({
      ...base,
      group: initialGroup ? String(initialGroup) : base.group,
      lesson: initialLesson ? String(initialLesson) : base.lesson,
    });
    setExisting(isEdit ? assignment.attachments || [] : []);
    setLinks(!isEdit ? (duplicateSeed?.attachments || []).map(({ url, title }) => ({ url, title })) : []);
    setRemoved([]);
    setNewFiles([]);
    setLinkDraft({ url: "", title: "" });
    setError("");
  }, [open, source, initialGroup, initialLesson, isEdit, assignment, duplicateSeed]);

  useEffect(() => {
    if (!open || !form.group) {
      setLessons([]);
      return undefined;
    }
    let alive = true;
    listGroupLessons(form.group)
      .then((rows) => alive && setLessons(rows.filter((row) => row.status !== "cancelled")))
      .catch(() => alive && setLessons([]));
    return () => {
      alive = false;
    };
  }, [open, form.group]);

  // Lessons around now are the useful ones: two weeks back, a month ahead.
  const lessonOptions = useMemo(() => {
    const from = Date.now() - 14 * 86400000;
    const to = Date.now() + 31 * 86400000;
    return lessons.filter((row) => {
      const at = new Date(row.starts_at).getTime();
      return (at >= from && at <= to) || String(row.id) === form.lesson;
    });
  }, [lessons, form.lesson]);

  if (!open) return null;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickFiles(list) {
    const picked = Array.from(list || []);
    const tooBig = picked.filter((file) => file.size > MAX_FILE);
    if (tooBig.length) setError(t("tCreate.fileTooBig", { name: tooBig[0].name }));
    else setError("");
    setNewFiles((prev) => [...prev, ...picked.filter((file) => file.size <= MAX_FILE)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addLink() {
    const url = linkDraft.url.trim();
    if (!validUrl(url)) {
      setError(t("tCreate.badLink"));
      return;
    }
    setError("");
    setLinks((prev) => [...prev, { url, title: linkDraft.title.trim() }]);
    setLinkDraft({ url: "", title: "" });
  }

  async function submit(publish) {
    setError("");
    if (!form.group || !form.title.trim()) {
      setError(t("tCreate.needGroupTitle"));
      return;
    }
    if (!form.due_date) {
      setError(t("tCreate.needDue"));
      return;
    }
    const maxScore = form.graded ? Number(form.max_score) : null;
    if (form.graded && (!Number.isInteger(maxScore) || maxScore < 1)) {
      setError(t("tCreate.badMax"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        group: form.group,
        lesson: form.lesson || null,
        title: form.title.trim(),
        description: form.description,
        due_at: new Date(`${form.due_date}T${form.due_time || "23:59"}:00`).toISOString(),
        max_score: maxScore,
        allow_late: form.allow_late,
        allow_resubmit: form.allow_resubmit,
      };
      // Publish only after materials are attached, so students get the full task at once.
      const saved = await saveHomework(isEdit ? assignment.id : null, {
        ...payload,
        is_published: isEdit ? published : false,
      });
      await Promise.all(removed.map((id) => deleteHomeworkAttachment(saved.id, id)));
      for (const file of newFiles) await addHomeworkFile(saved.id, file);
      for (const link of links) await addHomeworkLink(saved.id, link.url, link.title);
      if (publish && !saved.is_published) await saveHomework(saved.id, { is_published: true });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const visibleExisting = existing.filter((item) => !removed.includes(item.id));
  const hasMaterials = visibleExisting.length || newFiles.length || links.length;

  return createPortal(
    <div className="drawer-backdrop" onClick={saving ? undefined : onClose} role="presentation">
      <aside
        className="drawer teacher-drawer ta-create-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t(isEdit ? "tCreate.editTitle" : "tCreate.newTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-create-head">
          <div>
            <p className="ta-create-eyebrow">{t(isEdit ? "tCreate.eyebrowEdit" : "tCreate.eyebrowNew")}</p>
            <h2>{t(isEdit ? "tCreate.editTitle" : "tCreate.newTitle")}</h2>
            <p className="tg-muted">{t("tCreate.lead")}</p>
          </div>
          <CloseButton onClick={onClose} disabled={saving} />
        </header>

        <div className="ta-create-body">
          {error ? <Banner>{error}</Banner> : null}

          <section className="ta-form-card">
            <h3>{t("tCreate.basics")}</h3>
            <div className="ta-field-row">
              <label className="ta-field">
                <span>{t("tCreate.group")}</span>
                <select
                  value={form.group}
                  disabled={lockGroup || (isEdit && assignment?.handed_count > 0)}
                  onChange={(e) => setForm((prev) => ({ ...prev, group: e.target.value, lesson: "" }))}
                >
                  <option value="">{t("tCreate.pickGroup")}</option>
                  {groups.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ta-field">
                <span>{t("tCreate.lesson")}</span>
                <select
                  value={form.lesson}
                  disabled={!form.group}
                  onChange={(e) => setField("lesson", e.target.value)}
                >
                  <option value="">{t("tCreate.noLesson")}</option>
                  {lessonOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatDayShort(row.starts_at)}, {formatTime(row.starts_at)}
                      {row.topic ? ` · ${row.topic.split("·")[0].trim()}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="ta-field">
              <span>{t("tCreate.title")}</span>
              <input
                value={form.title}
                maxLength={200}
                onChange={(e) => setField("title", e.target.value)}
                placeholder={t("tCreate.titlePlaceholder")}
              />
            </label>
            <label className="ta-field">
              <span>{t("tCreate.description")}</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder={t("tCreate.descriptionPlaceholder")}
              />
            </label>
          </section>

          <section className="ta-form-card">
            <h3>{t("tCreate.dueAndScore")}</h3>
            <div className="ta-field-row">
              <label className="ta-field">
                <span>{t("tCreate.date")}</span>
                <input type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} />
              </label>
              <label className="ta-field">
                <span>{t("tCreate.time")}</span>
                <input type="time" value={form.due_time} onChange={(e) => setField("due_time", e.target.value)} />
              </label>
              {form.graded ? (
                <label className="ta-field">
                  <span>{t("tCreate.maxScore")}</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.max_score}
                    onChange={(e) => setField("max_score", e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="ta-switches">
              <Switch
                checked={form.graded}
                onChange={(value) => setField("graded", value)}
                label={t("tCreate.graded")}
                hint={t(form.graded ? "tCreate.gradedHintOn" : "tCreate.gradedHintOff")}
              />
              <Switch
                checked={form.allow_late}
                onChange={(value) => setField("allow_late", value)}
                label={t("tCreate.allowLate")}
                hint={t("tCreate.allowLateHint")}
              />
              <Switch
                checked={form.allow_resubmit}
                onChange={(value) => setField("allow_resubmit", value)}
                label={t("tCreate.allowResubmit")}
                hint={t("tCreate.allowResubmitHint")}
              />
            </div>
          </section>

          <section className="ta-form-card">
            <h3>{t("tCreate.materials")}</h3>
            <p className="ta-form-hint">{t("tCreate.materialsHint")}</p>

            <div
              className={`ta-upload${dragOver ? " is-drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="ta-upload-input"
                onChange={(e) => pickFiles(e.target.files)}
              />
              <button type="button" className="ta-upload-empty" onClick={() => fileInputRef.current?.click()}>
                <span className="ta-upload-icon" aria-hidden="true">
                  ⇪
                </span>
                <strong>{t("tCreate.dropFiles")}</strong>
                <em>{t("tCreate.orPick")}</em>
              </button>
            </div>

            <div className="ta-link-add">
              <input
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://docs.google.com/…"
                aria-label={t("tCreate.link")}
              />
              <input
                value={linkDraft.title}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t("tCreate.linkTitle")}
                aria-label={t("tCreate.linkTitleLabel")}
              />
              <Button variant="ghost" onClick={addLink} disabled={!linkDraft.url.trim()}>
                {t("tCreate.addLink")}
              </Button>
            </div>

            {hasMaterials ? (
              <ul className="ta-materials">
                {visibleExisting.map((item) => (
                  <li key={item.id}>
                    <span className="ta-materials-kind">{t(item.url ? "tCreate.link" : "tCreate.file")}</span>
                    <a href={item.url || item.download_url} target="_blank" rel="noreferrer">
                      {item.title || item.original_name || item.url}
                    </a>
                    <button type="button" onClick={() => setRemoved((prev) => [...prev, item.id])}>
                      {t("common.delete")}
                    </button>
                  </li>
                ))}
                {newFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="is-new">
                    <span className="ta-materials-kind">{t("tCreate.newFile")}</span>
                    <span>
                      {file.name} · {formatBytes(file.size)}
                    </span>
                    <button type="button" onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}>
                      {t("tCreate.remove")}
                    </button>
                  </li>
                ))}
                {links.map((link, index) => (
                  <li key={`${link.url}-${index}`} className="is-new">
                    <span className="ta-materials-kind">{t("tCreate.link")}</span>
                    <span>{link.title || link.url}</span>
                    <button type="button" onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}>
                      {t("tCreate.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <footer className="ta-create-foot">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <div className="ta-create-foot-main">
            {!published ? (
              <Button variant="ghost" onClick={() => submit(false)} disabled={saving}>
                {t("tCreate.saveDraft")}
              </Button>
            ) : null}
            <Button onClick={() => submit(true)} disabled={saving} busy={saving}>
              {t(published ? "common.save" : "common.publish")}
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
