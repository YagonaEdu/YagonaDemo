import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LessonList, WeekGrid, WeekToolbar } from "@/components/schedule/WeekSchedule";
import { t } from "@/i18n";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import SchedulePage from "@/pages/education-admin/SchedulePage";
import { buildQuery, fetchAll } from "@/services/api/paginate";
import { shiftDays, startOfWeek } from "@/utils/format";
import { educationSegmentPath } from "@/utils/routes";

const TAB_KEY = "yagona-teacher-schedule-tab";

function readTab() {
  try {
    const value = localStorage.getItem(TAB_KEY);
    return ["week", "list", "table"].includes(value) ? value : "week";
  } catch {
    return "week";
  }
}

function WeekView({ view, onViewChange }) {
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const thisWeek = startOfWeek();
  const [weekStart, setWeekStart] = useState(thisWeek);
  const lessons = useAsync(
    () =>
      fetchAll(
        `/lessons${buildQuery({
          page_size: 100,
          ordering: "starts_at",
          starts_at_from: weekStart.toISOString(),
          starts_at_to: shiftDays(weekStart, 7).toISOString(),
        })}`,
      ),
    [weekStart.getTime()],
  );

  const open = (lesson) =>
    navigate(`${educationSegmentPath(tenantSlug, "attendance")}?lesson=${lesson.id}`);
  const renderMeta = (lesson) => lesson.room_name || "";

  let body;
  if (lessons.loading) {
    body = (
      <div className="ws-grid" aria-busy="true">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="ws-day">
            <Skeleton width="50%" height={16} />
            <Skeleton height={64} radius={12} />
          </div>
        ))}
      </div>
    );
  } else if (lessons.error) {
    body = <ErrorState message={lessons.error.message} onRetry={lessons.reload} />;
  } else if (!lessons.data.length) {
    body = (
      <div className="ta-card">
        <EmptyState title={t("tSchedule.emptyTitle")} body={t("tSchedule.emptyBody")} />
      </div>
    );
  } else if (view === "list") {
    body = <LessonList lessons={lessons.data} renderMeta={renderMeta} onSelect={open} />;
  } else {
    body = <WeekGrid weekStart={weekStart} lessons={lessons.data} renderMeta={renderMeta} onSelect={open} />;
  }

  return (
    <>
      <WeekToolbar
        weekStart={weekStart}
        onChange={setWeekStart}
        thisWeek={thisWeek}
        view={view}
        onViewChange={onViewChange}
      />
      <p className="ta-hint">{t("tSchedule.hint")}</p>
      {body}
    </>
  );
}

export default function TeacherSchedulePage() {
  const [tab, setTab] = useState(readTab);

  function choose(next) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div className="teacher-page ta-page">
      <header className="ta-head">
        <div>
          <h1>{t("tSchedule.title")}</h1>
          <p>{t("tSchedule.sub")}</p>
        </div>
        <div className="ws-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab !== "table"}
            className={`ws-tab${tab !== "table" ? " is-active" : ""}`}
            onClick={() => choose("week")}
          >
            {t("tSchedule.byWeek")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "table"}
            className={`ws-tab${tab === "table" ? " is-active" : ""}`}
            onClick={() => choose("table")}
          >
            {t("tSchedule.detailed")}
          </button>
        </div>
      </header>
      {tab === "table" ? (
        <div className="teacher-schedule-wrap">
          <SchedulePage />
        </div>
      ) : (
        <WeekView view={tab === "list" ? "list" : "week"} onViewChange={choose} />
      )}
    </div>
  );
}
