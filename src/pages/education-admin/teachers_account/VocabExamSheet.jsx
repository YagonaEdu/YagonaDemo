import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banner, Button, CloseButton, Field } from "@/components/ui";
import { t } from "@/i18n";
import { EXAM_DIRECTIONS, EXAM_MODES, saveVocabExam } from "./vocabApi";

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm(listId) {
  const opens = new Date();
  opens.setMinutes(0, 0, 0);
  const closes = new Date(opens.getTime() + 7 * 86400000);
  return {
    list: listId ? String(listId) : "",
    group: "",
    title: "",
    mode: "mixed",
    direction: "both",
    questions_count: "20",
    minutes: "10",
    opens_at: toLocalInput(opens),
    closes_at: toLocalInput(closes),
    attempts_allowed: "2",
    pass_score: "70",
    shuffle: true,
  };
}

export default function VocabExamSheet({ open, exam, presetList, lists = [], groups = [], onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(exam?.id);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (!exam) {
      setForm(emptyForm(presetList?.id));
      return;
    }
    setForm({
      list: String(exam.list),
      group: String(exam.group),
      title: exam.title,
      mode: exam.mode,
      direction: exam.direction,
      questions_count: String(exam.questions_count),
      minutes: String(Math.round(exam.time_limit_sec / 60)),
      opens_at: toLocalInput(exam.opens_at),
      closes_at: toLocalInput(exam.closes_at),
      attempts_allowed: exam.attempts_allowed == null ? "" : String(exam.attempts_allowed),
      pass_score: String(exam.pass_score),
      shuffle: exam.shuffle,
    });
  }, [open, exam, presetList]);

  const selectedList = lists.find((row) => String(row.id) === form.list);

  // A list bound to a group can only be examined in that group; a course list — in the course's groups.
  const groupOptions = useMemo(() => {
    if (!selectedList) return groups;
    if (selectedList.group) return groups.filter((row) => String(row.id) === String(selectedList.group));
    if (selectedList.course) return groups.filter((row) => String(row.course) === String(selectedList.course));
    return groups;
  }, [groups, selectedList]);

  useEffect(() => {
    if (!open || !selectedList) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!groupOptions.some((row) => String(row.id) === prev.group)) {
        next.group = groupOptions.length === 1 ? String(groupOptions[0].id) : "";
      }
      if (!prev.title) next.title = t("tMat.examTitleSuffix", { title: selectedList.title });
      return next;
    });
  }, [open, selectedList, groupOptions]);

  if (!open) return null;

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function submit(publish) {
    setError("");
    if (!form.list || !form.group || !form.title.trim()) {
      setError(t("tMat.examNeedFields"));
      return;
    }
    const minutes = Number(form.minutes);
    if (!(minutes >= 1 && minutes <= 240)) {
      setError(t("tMat.examBadTime"));
      return;
    }
    setSaving(true);
    try {
      await saveVocabExam(exam?.id, {
        list: form.list,
        group: form.group,
        title: form.title.trim(),
        mode: form.mode,
        direction: form.direction,
        questions_count: Number(form.questions_count),
        time_limit_sec: Math.round(minutes * 60),
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        attempts_allowed: form.attempts_allowed === "" ? null : Number(form.attempts_allowed),
        pass_score: Number(form.pass_score),
        shuffle: form.shuffle,
        ...(publish ? { is_published: true } : {}),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const words = selectedList?.word_count ?? null;

  return createPortal(
    <div className="drawer-backdrop" onClick={saving ? undefined : onClose} role="presentation">
      <aside
        className="drawer teacher-drawer tm-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t(isEdit ? "tMat.examSettings" : "tMat.examNew")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-create-head">
          <div>
            <h2>{t(isEdit ? "tMat.examSettings" : "tMat.examHeading")}</h2>
            <p className="tg-muted">{t("tMat.examLead")}</p>
          </div>
          <CloseButton onClick={onClose} disabled={saving} />
        </header>
        <div className="tm-form-body">
          {error ? <Banner>{error}</Banner> : null}
          <div className="tm-form-grid">
            <Field label={t("tMat.examList")}>
              <select value={form.list} onChange={set("list")}>
                <option value="">{t("tMat.examPickList")}</option>
                {lists.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} · {t("plural.words", { count: row.word_count || 0 })}
                    {row.is_published ? "" : t("tMat.draftSuffix")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("tMat.examGroup")}>
              <select value={form.group} onChange={set("group")} disabled={!form.list}>
                <option value="">{t("tMat.examPickGroup")}</option>
                {groupOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("tMat.examName")}>
            <input value={form.title} maxLength={200} onChange={set("title")} />
          </Field>
          <div className="tm-form-grid">
            <Field label={t("tMat.examMode")}>
              <select value={form.mode} onChange={set("mode")}>
                {EXAM_MODES.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("tMat.examDirection")}>
              <select value={form.direction} onChange={set("direction")}>
                {EXAM_DIRECTIONS.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="tm-form-grid tm-form-grid-3">
            <Field label={words != null ? t("tMat.examQuestionsOf", { count: words }) : t("tMat.examQuestions")}>
              <input type="number" min="1" max="200" value={form.questions_count} onChange={set("questions_count")} />
            </Field>
            <Field label={t("tMat.examMinutes")}>
              <input type="number" min="1" max="240" value={form.minutes} onChange={set("minutes")} />
            </Field>
            <Field label={t("tMat.examPass")}>
              <input type="number" min="0" max="100" value={form.pass_score} onChange={set("pass_score")} />
            </Field>
          </div>
          <div className="tm-form-grid tm-form-grid-3">
            <Field label={t("tMat.examOpens")}>
              <input type="datetime-local" value={form.opens_at} onChange={set("opens_at")} />
            </Field>
            <Field label={t("tMat.examCloses")}>
              <input type="datetime-local" value={form.closes_at} onChange={set("closes_at")} />
            </Field>
            <Field label={t("tMat.examAttempts")}>
              <input type="number" min="1" value={form.attempts_allowed} onChange={set("attempts_allowed")} />
            </Field>
          </div>
          <label className="ta-switch">
            <input type="checkbox" checked={form.shuffle} onChange={set("shuffle")} />
            <span className="ta-switch-track" aria-hidden="true" />
            <span className="ta-switch-copy">
              <strong>{t("tMat.examShuffle")}</strong>
              <em>{t("tMat.examShuffleHint")}</em>
            </span>
          </label>
        </div>
        <footer className="ta-create-foot">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="ghost" onClick={() => submit(false)} disabled={saving}>
            {t("common.save")}
          </Button>
          {!exam?.is_published ? (
            <Button onClick={() => submit(true)} disabled={saving} busy={saving}>
              {t("common.publish")}
            </Button>
          ) : null}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
