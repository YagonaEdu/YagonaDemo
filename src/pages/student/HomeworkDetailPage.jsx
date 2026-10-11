import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useToast } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import {
  deleteSubmissionFile,
  getHomework,
  saveHomeworkDraft,
  submitHomework,
  uploadSubmissionFile,
} from "@/services/student";
import {
  formatBytes,
  formatDeadline,
  formatWhen,
  relativeDue,
  shortCountdown,
} from "@/utils/format";
import ConfirmDialog from "./ConfirmDialog";
import {
  IconArrowLeft,
  IconClock,
  IconFile,
  IconImage,
  IconLink,
  IconTrash,
  IconUpload,
} from "./icons";
import { CardSkeleton, HomeworkPill, LoadError, Ring, homeworkState } from "./parts";
import VoiceRecorder from "./VoiceRecorder";

const DAY = 86400000;
const SAVE_DELAY = 800;
const IMAGE_EXT = [".jpg", ".jpeg", ".png"];
const AUDIO_EXT = [".mp3", ".m4a", ".webm"];

function extOf(name) {
  const match = /\.[^.]+$/.exec(name || "");
  return match ? match[0].toLowerCase() : "";
}

function validLink(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ---------- left column ---------- */

function DeadlineBlock({ homework, now }) {
  const due = homework.due_at ? new Date(homework.due_at).getTime() : null;
  const left = due ? due - now : null;
  const tone = left == null ? "" : left < 0 ? " is-late" : left < DAY ? " is-urgent" : "";
  return (
    <div className={`st-hwd-deadline${tone}`}>
      <span className="st-hwd-deadline-icon">
        <IconClock size={20} />
      </span>
      <div>
        <span className="st-overline">Срок сдачи</span>
        <strong>{formatDeadline(homework.due_at)}</strong>
        {due ? (
          <span>
            {left > 0 && left < DAY
              ? `осталось ${shortCountdown(homework.due_at, now)}`
              : relativeDue(homework.due_at, now)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Rules({ homework }) {
  const rules = [
    homework.max_score ? `Оценка до ${homework.max_score} баллов` : "Без оценки — зачёт",
    homework.allow_late
      ? "Можно сдать после срока — с отметкой «с опозданием»"
      : "После срока сдать нельзя",
    homework.allow_resubmit ? "Можно пересдать до проверки" : "Сдаётся один раз",
  ];
  return (
    <ul className="st-hwd-rules">
      {rules.map((rule) => (
        <li key={rule}>{rule}</li>
      ))}
    </ul>
  );
}

function Materials({ items }) {
  if (!items?.length) return null;
  return (
    <section className="st-hwd-section">
      <h2>Материалы преподавателя</h2>
      <ul className="st-hwd-materials">
        {items.map((item) => {
          const isLink = Boolean(item.url);
          const href = isLink ? item.url : item.download_url;
          return (
            <li key={item.id}>
              <a href={href} target="_blank" rel="noreferrer" className="st-hwd-material">
                <span className="st-hwd-material-icon">
                  {isLink ? <IconLink size={18} /> : <IconFile size={18} />}
                </span>
                <span className="st-hwd-material-copy">
                  <strong>{item.title || item.original_name}</strong>
                  <span>{isLink ? new URL(item.url).hostname : formatBytes(item.size)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- files ---------- */

function FileTile({ file, onDelete, busy }) {
  const ext = extOf(file.original_name);
  const pending = file.status === "uploading";
  return (
    <li className={`st-file${pending ? " is-pending" : ""}${file.error ? " is-error" : ""}`}>
      <div className="st-file-preview">
        {IMAGE_EXT.includes(ext) && file.download_url ? (
          <img src={file.download_url} alt="" loading="lazy" />
        ) : (
          <span className="st-file-icon">
            {IMAGE_EXT.includes(ext) || ext === ".heic" ? <IconImage size={20} /> : <IconFile size={20} />}
            <small>{ext.slice(1).toUpperCase()}</small>
          </span>
        )}
      </div>
      <div className="st-file-copy">
        {file.download_url ? (
          <a href={file.download_url} target="_blank" rel="noreferrer">
            {file.original_name}
          </a>
        ) : (
          <strong>{file.original_name}</strong>
        )}
        <span>
          {file.error ? file.error : pending ? "Загружается…" : formatBytes(file.size)}
        </span>
        {pending ? <span className="st-file-bar" aria-hidden="true" /> : null}
        {AUDIO_EXT.includes(ext) && file.download_url ? (
          <audio controls preload="none" src={file.download_url} aria-label={file.original_name} />
        ) : null}
      </div>
      {onDelete && !pending ? (
        <button
          type="button"
          className="st-icon-btn st-file-remove"
          onClick={onDelete}
          disabled={busy}
          aria-label={file.error ? `Убрать ${file.original_name}` : `Удалить ${file.original_name}`}
        >
          <IconTrash size={18} />
        </button>
      ) : null}
    </li>
  );
}

function rulesText(rules) {
  const kinds = [...new Set(rules.extensions.map((ext) => ext.slice(1).toUpperCase()))]
    .filter((ext) => ext !== "JPEG")
    .join(", ");
  return `До ${rules.max_files} файлов, каждый до ${Math.round(rules.max_file_size / 1048576)} МБ: ${kinds}`;
}

function checkFile(file, rules, taken) {
  const ext = extOf(file.name);
  if (!rules.extensions.includes(ext)) {
    return `«${file.name}»: такой тип не поддерживается.`;
  }
  if (file.size > rules.max_file_size) {
    return `«${file.name}» больше ${Math.round(rules.max_file_size / 1048576)} МБ.`;
  }
  if (file.size === 0) return `«${file.name}» пустой.`;
  if (taken >= rules.max_files) return `Можно прикрепить не больше ${rules.max_files} файлов.`;
  return null;
}

/* ---------- submission ---------- */

function GradeBlock({ homework, submission }) {
  const max = homework.max_score;
  return (
    <div className="st-hwd-grade">
      {max ? (
        <Ring value={submission.score ?? 0} max={max} size={120} stroke={11}>
          <strong>{submission.score}</strong>
          <span>из {max}</span>
        </Ring>
      ) : (
        <span className="st-hwd-accepted">Зачёт</span>
      )}
      <div className="st-hwd-grade-copy">
        <span className="st-overline">Работа проверена</span>
        {submission.feedback ? (
          <blockquote>{submission.feedback}</blockquote>
        ) : (
          <p className="st-muted">Преподаватель не оставил комментарий.</p>
        )}
        {submission.graded_at ? (
          <span className="st-muted">{formatWhen(submission.graded_at)}</span>
        ) : null}
      </div>
    </div>
  );
}

function SubmittedSummary({ submission }) {
  return (
    <div className="st-hwd-summary">
      <p>
        Сдано {formatWhen(submission.submitted_at)}
        {submission.attempt > 1 ? ` · попытка ${submission.attempt}` : ""}
      </p>
      {submission.text ? <p className="st-hwd-answer">{submission.text}</p> : null}
      {submission.link ? (
        <a href={submission.link} target="_blank" rel="noreferrer" className="st-text-link">
          {submission.link}
        </a>
      ) : null}
      {submission.files?.length ? (
        <ul className="st-files">
          {submission.files.map((file) => (
            <FileTile key={file.id} file={file} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmissionPanel({ homework, onChanged, now }) {
  const [submission, setSubmission] = useState(homework.my_submission);
  const [text, setText] = useState(homework.my_submission?.text || "");
  const [link, setLink] = useState(homework.my_submission?.link || "");
  const [save, setSave] = useState("idle"); // idle | dirty | saving | saved | error
  const [uploads, setUploads] = useState([]);
  const [fileError, setFileError] = useState("");
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState(null); // "submit" | "resubmit"
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [toast, showToast] = useToast();
  const timer = useRef(null);
  const draftPromise = useRef(null);
  const latest = useRef({ text, link });
  latest.current = { text, link };

  const rules = homework.upload_rules;
  const status = submission?.status;
  const handedIn = status === "submitted" || status === "late";
  const overdue = homework.is_overdue || (homework.due_at && new Date(homework.due_at) < now);
  const blockedWithoutDraft = !submission && overdue && !homework.allow_late;
  const canEdit = submission ? submission.can_edit : !blockedWithoutDraft;
  const blockReason = submission?.edit_block_reason
    || (blockedWithoutDraft ? "Срок сдачи истёк, сдача после дедлайна не разрешена." : "");
  const formOpen = canEdit && (!handedIn || editing) && status !== "graded";
  const uploading = uploads.some((item) => item.status === "uploading");
  const linkInvalid = !validLink(link.trim());

  useUnsavedChanges(save === "dirty" || save === "saving" || uploading);

  const persist = useCallback(async () => {
    clearTimeout(timer.current);
    const fields = { text: latest.current.text };
    const nextLink = latest.current.link.trim();
    if (validLink(nextLink)) fields.link = nextLink;
    setSave("saving");
    try {
      const saved = await saveHomeworkDraft(homework.id, fields);
      setSubmission(saved);
      setSave("saved");
      return saved;
    } catch (error) {
      setSave("error");
      throw error;
    }
  }, [homework.id]);

  // Flush a pending autosave when leaving the page.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persist().catch(() => {});
      }
    },
    [persist],
  );

  const schedule = () => {
    setSave("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      persist().catch(() => {});
    }, SAVE_DELAY);
  };

  /** Files need a submission id: create/reopen the draft once, shared by parallel uploads. */
  const ensureDraft = async () => {
    if (submission && (status === "draft" || status === "returned")) return submission;
    if (!draftPromise.current) {
      draftPromise.current = persist().finally(() => {
        draftPromise.current = null;
      });
    }
    return draftPromise.current;
  };

  const addFiles = async (fileList) => {
    setFileError("");
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    let taken = (submission?.files?.length || 0) + uploads.filter((u) => !u.error).length;
    const accepted = [];
    const rejected = [];
    for (const file of picked) {
      const problem = checkFile(file, rules, taken);
      if (problem) rejected.push(problem);
      else {
        accepted.push(file);
        taken += 1;
      }
    }
    if (rejected.length) setFileError(rejected.join(" "));
    if (!accepted.length) return;

    const pending = accepted.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      original_name: file.name,
      size: file.size,
      status: "uploading",
    }));
    setUploads((list) => [...list, ...pending]);

    let draft;
    try {
      draft = await ensureDraft();
    } catch (error) {
      setUploads((list) => list.filter((item) => !pending.includes(item)));
      setFileError(error.message);
      return;
    }
    await Promise.all(
      pending.map(async (item) => {
        try {
          const saved = await uploadSubmissionFile(draft.id, item.file);
          setUploads((list) => list.filter((row) => row.key !== item.key));
          setSubmission((current) => ({
            ...current,
            status: current.status === "returned" ? "returned" : "draft",
            files: [...(current.files || []), saved],
          }));
        } catch (error) {
          setUploads((list) =>
            list.map((row) =>
              row.key === item.key ? { ...row, status: "error", error: error.message } : row,
            ),
          );
        }
      }),
    );
  };

  const removeFile = async (file) => {
    setFileError("");
    try {
      await deleteSubmissionFile(submission.id, file.id);
      setSubmission((current) => ({
        ...current,
        files: current.files.filter((row) => row.id !== file.id),
      }));
    } catch (error) {
      setFileError(error.message);
    }
  };

  const doSubmit = async () => {
    setBusy(true);
    setSubmitError("");
    try {
      // Handed-in work must be reopened as a draft before it can be handed in again.
      const stale = timer.current || save === "dirty" || !submission || handedIn;
      const draft = stale ? await persist() : submission;
      const result = await submitHomework(draft.id);
      setSubmission(result);
      setEditing(false);
      setDialog(null);
      showToast(result.status === "late" ? "Работа сдана с опозданием" : "Работа сдана");
      onChanged?.();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const current = { ...homework, my_submission: submission };
  const hasAnswer = Boolean(
    text.trim() || (link.trim() && !linkInvalid) || submission?.files?.length,
  );
  const lateWarning = overdue && homework.allow_late;

  return (
    <section className="st-card st-hwd-panel" aria-labelledby="hw-answer-title">
      <header className="st-hwd-panel-head">
        <h2 id="hw-answer-title">Моя работа</h2>
        <HomeworkPill item={current} state={homeworkState(current, now)} />
      </header>

      {status === "graded" ? <GradeBlock homework={homework} submission={submission} /> : null}

      {status === "returned" ? (
        <div className="st-hwd-returned" role="note">
          <strong>Преподаватель вернул работу на доработку</strong>
          {submission.feedback ? <blockquote>{submission.feedback}</blockquote> : null}
        </div>
      ) : null}

      {(handedIn && !editing) || status === "graded" ? (
        <>
          <SubmittedSummary submission={submission} />
          {handedIn && canEdit ? (
            <button
              type="button"
              className="y-btn y-btn-secondary"
              onClick={() => setDialog("resubmit")}
            >
              Пересдать
            </button>
          ) : null}
        </>
      ) : null}

      {!canEdit && !handedIn && status !== "graded" ? (
        <p className="st-hwd-blocked" role="alert">
          {blockReason}
        </p>
      ) : null}

      {formOpen ? (
        <div className="st-hwd-form">
          <label className="st-field">
            <span>Ответ</span>
            <textarea
              rows={6}
              value={text}
              maxLength={20000}
              placeholder="Напишите ответ или комментарий к файлам"
              onChange={(event) => {
                setText(event.target.value);
                schedule();
              }}
            />
          </label>

          <label className="st-field">
            <span>Ссылка (Google Docs, видео и т. п.)</span>
            <input
              type="url"
              inputMode="url"
              value={link}
              placeholder="https://"
              aria-invalid={linkInvalid}
              aria-describedby={linkInvalid ? "hw-link-error" : undefined}
              onChange={(event) => {
                setLink(event.target.value);
                schedule();
              }}
            />
            {linkInvalid ? (
              <small id="hw-link-error" className="st-field-error">
                Ссылка должна начинаться с http:// или https://
              </small>
            ) : null}
          </label>

          <div
            className={`st-drop${dragOver ? " is-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <IconUpload size={24} />
            <p>
              Перетащите файлы сюда или{" "}
              <label className="st-drop-pick">
                выберите на устройстве
                <input
                  type="file"
                  multiple
                  accept={rules.extensions.join(",")}
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </p>
            <small>{rulesText(rules)}</small>
          </div>

          <VoiceRecorder disabled={uploading} onRecorded={(file) => addFiles([file])} />

          {fileError ? (
            <p className="st-field-error" role="alert">
              {fileError}
            </p>
          ) : null}

          {submission?.files?.length || uploads.length ? (
            <ul className="st-files">
              {(submission?.files || []).map((file) => (
                <FileTile key={file.id} file={file} onDelete={() => removeFile(file)} />
              ))}
              {uploads.map((item) => (
                <FileTile
                  key={item.key}
                  file={item}
                  onDelete={() => setUploads((list) => list.filter((row) => row.key !== item.key))}
                />
              ))}
            </ul>
          ) : null}

          {lateWarning ? (
            <p className="st-hwd-late" role="note">
              Срок уже прошёл — работа будет отмечена как сданная с опозданием.
            </p>
          ) : null}

          <footer className="st-hwd-actions">
            <span className={`st-save is-${save}`} role="status" aria-live="polite">
              {save === "saving" || save === "dirty"
                ? "Сохраняем…"
                : save === "saved"
                  ? "Черновик сохранён"
                  : save === "error"
                    ? "Не удалось сохранить — проверьте интернет"
                    : ""}
            </span>
            {editing ? (
              <button type="button" className="y-btn y-btn-ghost" onClick={() => setEditing(false)}>
                Отмена
              </button>
            ) : null}
            <button
              type="button"
              className="y-btn y-btn-primary"
              disabled={!hasAnswer || uploading || busy}
              onClick={() => setDialog("submit")}
            >
              Сдать работу
            </button>
          </footer>
          {submitError ? (
            <p className="st-field-error" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog === "submit"}
        title="Сдать работу?"
        confirmLabel="Сдать"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={doSubmit}
      >
        <p>
          {homework.allow_resubmit
            ? "Работу можно будет пересдать, пока преподаватель её не проверил."
            : "После сдачи изменить работу будет нельзя."}
        </p>
        {lateWarning ? <p className="st-hwd-late">Работа будет отмечена как сданная с опозданием.</p> : null}
        {submitError ? <p className="st-field-error">{submitError}</p> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "resubmit"}
        title="Пересдать работу?"
        confirmLabel="Изменить работу"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          setEditing(true);
        }}
      >
        <p>
          После первого изменения работа снова станет черновиком — не забудьте сдать её ещё раз
          {homework.due_at ? ` до ${formatDeadline(homework.due_at)}` : ""}.
        </p>
      </ConfirmDialog>
      {toast}
    </section>
  );
}

/* ---------- page ---------- */

export default function StudentHomeworkDetailPage() {
  const { id } = useParams();
  const homework = useAsync(() => getHomework(id), [id]);
  const now = useNow();
  const data = homework.data;
  const paragraphs = useMemo(
    () => (data?.description || "").split(/\n{2,}/).filter(Boolean),
    [data?.description],
  );

  return (
    <div className="st-page">
      <Link to="/student/homework" className="st-back">
        <IconArrowLeft size={18} />
        Все задания
      </Link>

      {homework.loading && !data ? (
        <div className="st-hwd">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={4} />
        </div>
      ) : homework.error ? (
        <LoadError error={homework.error} onRetry={homework.reload} />
      ) : (
        <div className="st-hwd">
          <article className="st-card st-hwd-task">
            <span className="st-hw-course">
              {data.course_name}
              {data.group_name ? ` · ${data.group_name}` : ""}
            </span>
            <h1>{data.title}</h1>
            <DeadlineBlock homework={data} now={now} />
            <Rules homework={data} />
            {paragraphs.length ? (
              <section className="st-hwd-section">
                <h2>Задание</h2>
                {paragraphs.map((text, index) => (
                  <p key={index} className="st-hwd-text">
                    {text}
                  </p>
                ))}
              </section>
            ) : null}
            <Materials items={data.attachments} />
          </article>

          <SubmissionPanel key={data.id} homework={data} now={now} />
        </div>
      )}
    </div>
  );
}
