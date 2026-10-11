import { Link, useOutletContext } from "react-router-dom";
import { ErrorState, Skeleton } from "@/components/ui";
import { t } from "@/i18n";
import { isTenantAccessError } from "@/services/student";
import { useCabinetHeader } from "@/hooks/useCabinetHeader";

export { useCabinetHeader };

export const ATTENDANCE_LABELS = {
  present: "Присутствовал",
  late: "Опоздал",
  absent: "Пропустил",
  excused: "Уважительная",
};

export const INVOICE_LABELS = {
  draft: "Черновик",
  issued: "К оплате",
  partially_paid: "Оплачен частично",
  paid: "Оплачен",
  void: "Аннулирован",
  overdue: "Просрочен",
};

export const SUBSCRIPTION_LABELS = {
  active: "Активен",
  expired: "Истёк",
  cancelled: "Отменён",
};

export const PAYMENT_METHOD_LABELS = {
  cash: "Наличные",
  card: "Карта",
  bank_transfer: "Перевод",
  click: "Click",
  payme: "Payme",
};

export const PAYMENT_STATUS_LABELS = {
  pending: "В обработке",
  succeeded: "Проведён",
  failed: "Ошибка",
  refunded: "Возврат",
  reversed: "Отменён",
};

export const UNPAID_STATUSES = ["issued", "partially_paid", "overdue"];

export function useStudentCabinet() {
  return useOutletContext();
}

export { lessonDisplayState as lessonState } from "@/components/schedule/WeekSchedule";

export function attendanceStats(rows) {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const row of rows || []) {
    if (row.lesson_status === "cancelled") continue;
    if (counts[row.status] != null) counts[row.status] += 1;
  }
  const attended = counts.present + counts.late;
  const counted = attended + counts.absent;
  const rate = counted ? Math.round((attended / counted) * 100) : null;
  return { ...counts, attended, missed: counts.absent, rate, total: counted + counts.excused };
}

export function Ring({ value, max, size = 132, stroke = 12, children, tone = "teal" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`st-ring is-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="st-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="st-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="st-ring-label">{children}</div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="st-card st-card-skeleton" aria-busy="true">
      <Skeleton width="40%" height={18} />
      <Skeleton lines={lines} />
    </div>
  );
}

export function LoadError({ error, onRetry }) {
  if (isTenantAccessError(error)) {
    return (
      <ErrorState
        title={t("tDialogs.noAccessTitle")}
        message={t("tDialogs.noAccessBody")}
        action={
          <Link className="y-btn y-btn-primary" to="/student/profile">
            {t("tDialogs.pickCentre")}
          </Link>
        }
      />
    );
  }
  const offline = error instanceof TypeError || /fetch|network/i.test(error?.message || "");
  return (
    <ErrorState
      message={offline ? t("tDialogs.offline") : error?.message}
      onRetry={onRetry}
    />
  );
}


/** Title lives in the top bar; only page actions render in the content. */
export function PageTitle({ title, subtitle, actions }) {
  useCabinetHeader(title, subtitle);
  return actions ? <div className="sx-page-actions">{actions}</div> : null;
}

export const HOMEWORK_LABELS = {
  todo: "Не сдано",
  draft: "Черновик",
  overdue: "Просрочено",
  submitted: "Сдано",
  late: "Сдано с опозданием",
  returned: "На доработке",
  graded: "Проверено",
};

function hasContent(submission) {
  return Boolean(submission?.text?.trim() || submission?.link || submission?.files?.length);
}

/** Student-facing state of one homework row from /homeworks (with my_submission). */
export function homeworkState(item, now = Date.now()) {
  const submission = item.my_submission;
  const status = submission?.status;
  if (["graded", "returned", "submitted", "late"].includes(status)) return status;
  if (item.due_at && new Date(item.due_at).getTime() < now) return "overdue";
  return hasContent(submission) ? "draft" : "todo";
}

export function homeworkLabel(item, state) {
  const submission = item.my_submission;
  if (state === "graded" && item.max_score && submission?.score != null) {
    return `Проверено · ${submission.score} из ${item.max_score}`;
  }
  return HOMEWORK_LABELS[state];
}

export function HomeworkPill({ item, state }) {
  return <span className={`y-pill is-hw-${state}`}>{homeworkLabel(item, state)}</span>;
}

export const NOTIFICATION_CATEGORY_LABELS = {
  announcement: "Объявление",
  payment: "Оплата",
  attendance: "Посещаемость",
  schedule: "Расписание",
  students: "Учёба",
  system: "Система",
  crm: "Центр",
  staff: "Центр",
};

export function relativeTime(value, now = Date.now()) {
  if (!value) return "";
  const diff = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
