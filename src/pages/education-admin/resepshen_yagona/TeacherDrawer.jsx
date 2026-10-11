import { Avatar, Button } from "@/components/ui";
import { formatTime } from "@/utils/format";
import { Link } from "react-router-dom";
import { t } from "@/i18n";
import { staffLabel } from "./utils";

export default function TeacherDrawer({
  open,
  teacher,
  courses,
  onClose,
  schedulePath,
  groupsPath,
}) {
  if (!open || !teacher) return null;

  const courseMap = Object.fromEntries((courses || []).map((c) => [String(c.id), c]));
  const phone = teacher.phone || teacher.user?.phone || "";
  const email = teacher.email || teacher.user?.email || "";
  const name = teacher.name || staffLabel(teacher);
  const groups = teacher.groups || [];
  const todayLessons = teacher.todayLessons || [];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aTd.teacher")}>
      <button type="button" className="overlay-backdrop" aria-label={t("aTd.close")} onClick={onClose} />
      <div className="sheet sheet-detail reception-sheet">
        <div className="sheet-head">
          <div className="teachers-drawer-head">
            <Avatar name={name} size="lg" />
            <div>
              <h2>{name}</h2>
              <p className="muted">
                {phone || t("aTd.noPhone")}
                {email ? ` · ${email}` : ""}
              </p>
              <span className={`status ${teacher.is_active === false ? "inactive" : "active"}`}>
                {teacher.is_active === false ? t("aTd.inactive") : t("aTd.active")}
              </span>
            </div>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label={t("aTd.close")}>
            ×
          </button>
        </div>

        <div className="sheet-body reception-card-grid">
          <section>
            <h3>{t("aTd.courses")}</h3>
            <p>{(teacher.courseNames || []).join(", ") || "—"}</p>
          </section>

          <section>
            <h3>{t("aTd.today")}</h3>
            {todayLessons.length ? (
              <ul className="reception-att-list">
                {todayLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <span>
                      {formatTime(lesson.starts_at)}{" "}
                      {groups.find((g) => String(g.id) === String(lesson.group))?.name ||
                        lesson.topic ||
                        t("aTd.lesson")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("aTd.noLessonsToday")}</p>
            )}
          </section>

          <section className="span-2">
            <h3>{t("aTd.groups")}</h3>
            {groups.length ? (
              <ul className="reception-list">
                {groups.map((group) => (
                  <li key={group.id}>
                    <div>
                      <strong>{group.name}</strong>
                      <p className="muted">
                        {courseMap[String(group.course)]?.name || "—"}
                        {group.active_students != null
                          ? t("aTd.studentsShort", { active_students: group.active_students, p: group.capacity ? ` / ${group.capacity}` : "" })
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("aTd.noGroupsYet")}</p>
            )}
          </section>
        </div>

        <div className="sheet-foot reception-card-actions">
          {phone ? (
            <a className="btn btn-ghost" href={`tel:${phone}`}>
              {t("aTd.call")}
            </a>
          ) : null}
          <Link className="btn btn-primary" to={schedulePath} onClick={onClose}>
            {t("aTd.openSchedule")}
          </Link>
          <Link className="btn btn-ghost" to={groupsPath} onClick={onClose}>
            {t("aTd.groups")}
          </Link>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("aTd.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
