import { Link } from "react-router-dom";
import { initialsOf } from "@/components/layout/FigmaChrome";
import { formatDateTime, t } from "@/i18n";
import { formatTime, formatUzPhone } from "@/utils/format";
import { parseTrialTopic, staffLabel } from "./utils";
import { IconCheck, IconPhone, IconStar } from "./rxIcons";
import { trialStatePill } from "./trialState";

/* Right-hand card of «Пробные уроки»: who, when, with whom — and the outcome buttons. */
export default function TrialDetailPanel({
  lesson,
  outcome,
  group,
  course,
  teacher,
  room,
  lead,
  crmPath,
  schedulePath,
  busy,
  saving,
  onMarkStatus,
  onCancel,
}) {
  if (!lesson) {
    return (
      <section className="rx-card rx-trial-detail is-empty">
        <span className="rx-empty-icon" aria-hidden="true">
          <IconStar size={22} />
        </span>
        <h2>{t("aTdp.details")}</h2>
        <p>{t("aTdp.pickATrialLesson")}</p>
      </section>
    );
  }

  const parsed = parseTrialTopic(lesson.topic);
  const name = parsed.name || t("aTdp.visitor");
  const cancelled = lesson.status === "cancelled";
  const teacherPhone = teacher?.phone || teacher?.user?.phone;

  return (
    <section className="rx-card rx-trial-detail">
      <div className="rx-sheet-person">
        <span className="rx-av is-soft">{initialsOf(name)}</span>
        <div style={{ minWidth: 0 }}>
          <h2>{name}</h2>
          <p>
            {formatDateTime(lesson.starts_at, { weekday: "short", day: "numeric", month: "long" })} ·{" "}
            {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
          </p>
          <div className="rx-sheet-tags">{trialStatePill(lesson, outcome)}</div>
        </div>
      </div>

      {!cancelled ? (
        <div className="rx-trial-actions-main">
          <button type="button" className="rx-btn is-teal" disabled={saving || outcome === "came"} onClick={() => onMarkStatus("came")}>
            <IconCheck size={18} />
            {t("aTdp.came")}
          </button>
          <button type="button" className="rx-btn is-outline" disabled={saving || outcome === "no_show"} onClick={() => onMarkStatus("no_show")}>
            {t("aTdp.noShow")}
          </button>
          {parsed.phone ? (
            <a className="rx-icon-btn is-teal" href={`tel:${parsed.phone}`} aria-label={t("aTdp.call")} title={t("aTdp.call")}>
              <IconPhone size={18} />
            </a>
          ) : null}
        </div>
      ) : (
        <p className="rx-empty">{t("aTdp.lessonCancelled")}</p>
      )}

      <div className="rx-sheet-section">
        <h3 className="rx-sheet-label">{t("aTdp.contact")}</h3>
        <dl className="rx-dl">
          <div>
            <dt>{t("aTdp.phone")}</dt>
            <dd>{parsed.phone ? <a href={`tel:${parsed.phone}`}>{formatUzPhone(parsed.phone)}</a> : "—"}</dd>
          </div>
          <div>
            <dt>{t("aTdp.crmCard")}</dt>
            <dd>
              {lead ? (
                <Link to={crmPath}>
                  {lead.full_name}
                  {lead.source_details ? ` · ${lead.source_details}` : ""}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rx-sheet-section">
        <h3 className="rx-sheet-label">{t("aTdp.lesson")}</h3>
        <dl className="rx-dl">
          <div>
            <dt>{t("aTdp.group")}</dt>
            <dd>{group?.name || "—"}</dd>
          </div>
          <div>
            <dt>{t("aTdp.course")}</dt>
            <dd>{course?.name || "—"}</dd>
          </div>
          <div>
            <dt>{t("aTdp.room")}</dt>
            <dd>{room?.name || "—"}</dd>
          </div>
          <div>
            <dt>{t("aTdp.teacher")}</dt>
            <dd>
              {teacher ? staffLabel(teacher) : "—"}
              {teacherPhone ? (
                <>
                  {" · "}
                  <a href={`tel:${teacherPhone}`}>{formatUzPhone(teacherPhone)}</a>
                </>
              ) : null}
            </dd>
          </div>
        </dl>
        {busy ? (
          <div className="rx-warn" role="status">
            <span className="rx-hit-copy">
              <strong>{t("rxTrials.teacherClash")}</strong>
              <small>{busy}</small>
            </span>
          </div>
        ) : null}
      </div>

      {parsed.comment ? (
        <div className="rx-sheet-section">
          <h3 className="rx-sheet-label">{t("aTdp.comment")}</h3>
          <p className="rx-trial-comment">{parsed.comment}</p>
        </div>
      ) : null}

      <div className="rx-card-links">
        <Link className="rx-link" to={schedulePath}>
          {t("aTdp.schedule")} →
        </Link>
        {!cancelled ? (
          <button type="button" className="rx-link is-danger" disabled={saving} onClick={onCancel}>
            {t("rxTrials.cancelLesson")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
