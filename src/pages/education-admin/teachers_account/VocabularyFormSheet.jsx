import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Banner, Button, CloseButton, Field } from "@/components/ui";
import { t } from "@/i18n";
import {
  addVocabWord,
  deleteVocabWord,
  importVocabWords,
  listVocabWords,
  saveVocabList,
  updateVocabWord,
} from "./vocabApi";

const EMPTY_FORM = { title: "", level: "", description: "", group: "", course: "" };
const EMPTY_WORD = { term: "", translation: "", transcription: "", example: "" };
const WORD_FIELDS = ["term", "translation", "transcription", "example"];

function sameWord(a, b) {
  return WORD_FIELDS.every((key) => (a[key] || "") === (b[key] || ""));
}

export default function VocabularyFormSheet({ open, vocabulary, groups = [], courses = [], onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [words, setWords] = useState([]);
  const [original, setOriginal] = useState({});
  const [removed, setRemoved] = useState([]);
  const [bulkText, setBulkText] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingWords, setLoadingWords] = useState(false);
  const fileRef = useRef(null);
  const isEdit = Boolean(vocabulary?.id);

  useEffect(() => {
    if (!open) return;
    setForm(
      vocabulary
        ? {
            title: vocabulary.title || "",
            level: vocabulary.level || "",
            description: vocabulary.description || "",
            group: vocabulary.group ? String(vocabulary.group) : "",
            course: vocabulary.course ? String(vocabulary.course) : "",
          }
        : EMPTY_FORM,
    );
    setRemoved([]);
    setBulkText("");
    setBulkFile(null);
    setReport(null);
    setError("");
    if (!isEdit) {
      setWords([{ ...EMPTY_WORD }]);
      setOriginal({});
      return;
    }
    setLoadingWords(true);
    listVocabWords(vocabulary.id)
      .then((rows) => {
        setWords(rows.map((row) => ({ ...row })));
        setOriginal(Object.fromEntries(rows.map((row) => [row.id, row])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingWords(false));
  }, [open, vocabulary, isEdit]);

  if (!open) return null;

  const filledWords = words.filter((row) => row.term.trim() || row.translation.trim());

  function updateWord(index, patch) {
    setWords((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeWord(index) {
    const row = words[index];
    if (row.id) setRemoved((ids) => [...ids, row.id]);
    setWords((rows) => rows.filter((_, i) => i !== index));
  }

  async function submit(publish) {
    setError("");
    setReport(null);
    if (!form.title.trim()) {
      setError(t("tMat.listNeedTitle"));
      return;
    }
    const incomplete = filledWords.find((row) => !row.term.trim() || !row.translation.trim());
    if (incomplete) {
      setError(t("tMat.listIncomplete"));
      return;
    }
    setSaving(true);
    try {
      const group = groups.find((row) => String(row.id) === form.group);
      const saved = await saveVocabList(vocabulary?.id, {
        title: form.title.trim(),
        level: form.level.trim(),
        description: form.description,
        group: form.group || null,
        course: form.course || group?.course || null,
        ...(publish ? { is_published: true } : {}),
      });
      for (const id of removed) await deleteVocabWord(saved.id, id);
      let order = 0;
      for (const row of filledWords) {
        order += 1;
        const payload = {
          term: row.term.trim(),
          translation: row.translation.trim(),
          transcription: row.transcription?.trim() || "",
          example: row.example?.trim() || "",
          order,
        };
        if (!row.id) await addVocabWord(saved.id, payload);
        else if (!sameWord(row, original[row.id]) || original[row.id].order !== order) {
          await updateVocabWord(saved.id, row.id, payload);
        }
      }
      let result = null;
      if (bulkFile || bulkText.trim()) {
        result = await importVocabWords(saved.id, { file: bulkFile, text: bulkText });
      }
      onSaved?.();
      if (result && (result.errors.length || result.skipped)) {
        // Keep the sheet open so the teacher sees which lines were not imported.
        setReport(result);
        setBulkText("");
        setBulkFile(null);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={saving ? undefined : onClose} role="presentation">
      <aside
        className="drawer teacher-drawer teacher-drawer-wide tm-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t(isEdit ? "tMat.listEdit" : "tMat.listNew")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ta-create-head">
          <div>
            <h2>{t(isEdit ? "tMat.listEdit" : "tMat.listNew")}</h2>
            <p className="tg-muted">
              {t("plural.words", { count: filledWords.length })}
              {vocabulary?.is_published ? t("tMat.listPublished") : ""}
            </p>
          </div>
          <CloseButton onClick={onClose} disabled={saving} />
        </header>
        <div className="tm-form-body">
          {error ? <Banner>{error}</Banner> : null}
          {report ? (
            <Banner tone="warn">
              {t("tMat.importReport", { created: report.created, skipped: report.skipped })}
              {report.errors.length
                ? t("tMat.importErrors", { lines: report.errors.map((row) => row.line).join(", ") })
                : ""}
              .
            </Banner>
          ) : null}
          <div className="tm-form-grid">
            <Field label={t("tMat.listName")}>
              <input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label={t("tMat.listLevel")}>
              <input value={form.level} maxLength={40} placeholder="A2, B1…" onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </Field>
          </div>
          <Field label={t("tMat.listDescription")}>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="tm-form-grid">
            <Field label={t("tMat.listGroup")}>
              <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                <option value="">{t("tMat.wholeCourse")}</option>
                {groups.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("tMat.listCourse")}>
              <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} disabled={Boolean(form.group)}>
                <option value="">{t(form.group ? "tMat.groupCourse" : "tMat.notChosenM")}</option>
                {courses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="tm-vocab-toolbar">
            <strong>{t("tMat.words")}</strong>
            <Button variant="ghost" onClick={() => setWords((rows) => [...rows, { ...EMPTY_WORD }])}>
              {t("tMat.addWord")}
            </Button>
          </div>
          {loadingWords ? <p className="tg-muted">{t("tMat.loadingWords")}</p> : null}
          <div className="tm-vocab-list">
            {words.map((row, index) => (
              <div key={row.id || `new-${index}`} className="tm-vocab-row tm-vocab-row-4">
                <span className="tm-vocab-num">{index + 1}</span>
                <input aria-label={t("tMat.term")} placeholder={t("tMat.termRequired")} value={row.term} onChange={(e) => updateWord(index, { term: e.target.value })} />
                <input aria-label={t("tMat.translation")} placeholder={t("tMat.translationRequired")} value={row.translation} onChange={(e) => updateWord(index, { translation: e.target.value })} />
                <input aria-label={t("tMat.transcription")} placeholder={t("tMat.transcription")} value={row.transcription || ""} onChange={(e) => updateWord(index, { transcription: e.target.value })} />
                <input aria-label={t("tMat.example")} placeholder={t("tMat.example")} value={row.example || ""} onChange={(e) => updateWord(index, { example: e.target.value })} />
                <button type="button" className="tm-icon-btn" onClick={() => removeWord(index)} aria-label={t("tMat.removeWord", { term: row.term || t("tMat.wordFallback") })}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="tm-bulk-box">
            <Field label={t("tMat.bulkLabel")}>
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={t("tMat.bulkExample")}
              />
            </Field>
            <div className="tm-bulk-actions">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="ta-upload-input"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                {bulkFile ? `CSV: ${bulkFile.name}` : t("tMat.uploadCsv")}
              </Button>
              {bulkFile ? (
                <Button variant="ghost" onClick={() => setBulkFile(null)}>
                  {t("tMat.removeFile")}
                </Button>
              ) : null}
              <span className="tg-muted">{t("tMat.csvHint")}</span>
            </div>
          </div>
        </div>
        <footer className="ta-create-foot">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="ghost" onClick={() => submit(false)} disabled={saving}>
            {t("common.save")}
          </Button>
          {!vocabulary?.is_published ? (
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
