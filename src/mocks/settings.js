/* Centre settings as the backend creates them for a new tenant
   (mirrors tenants/settings_defaults.py). */
export const DEFAULT_CENTER_SETTINGS = {
  education: {
    default_lesson_duration_minutes: 90,
    default_group_capacity: 12,
    working_days: [1, 2, 3, 4, 5, 6],
    working_hours_start: "09:00",
    working_hours_end: "21:00",
    default_schedule_view: "week",
    first_weekday: 1,
    trial_lesson_duration_minutes: 60,
  },
  finance: {
    payment_due_day: 10,
    grace_period_days: 5,
    debt_warning_threshold: 0,
    default_payment_method: "cash",
    payment_reminder_days: 3,
    allowed_payment_methods: ["cash", "card", "bank_transfer", "click", "payme"],
    payment_reminders_enabled: true,
    show_debtors_on_dashboard: true,
  },
  notifications: {
    payment: true,
    debt: true,
    attendance: true,
    schedule: true,
    crm: true,
    students: true,
    staff: true,
    system: true,
    trial: true,
    channel_in_app: true,
    channel_push: true,
    channel_email: false,
    crm_new_lead: true,
    crm_followup_today: true,
    crm_followup_overdue: true,
    students_new: true,
    attendance_unmarked: true,
    schedule_conflict: true,
    schedule_no_teacher: true,
    payment_received: true,
    payment_overdue: true,
    trial_today: true,
    trial_no_show: true,
  },
  reception: {
    default_lead_source: "manual",
    default_followup_days: 1,
    show_overdue_followups: true,
    warn_duplicate_phone: true,
    warn_duplicate_email: true,
    quick_actions: ["visitor", "student", "trial", "payment", "find_student", "find_teacher", "notify"],
    ui_language: "ru",
    date_format: "dd.mm.yyyy",
    table_density: "normal",
    default_schedule_view: "week",
    first_weekday: 1,
  },
};

/** Deep-merges a partial settings patch into the current settings (like merge_center_settings). */
export function mergeCenterSettings(current, patch) {
  const out = JSON.parse(JSON.stringify(current || DEFAULT_CENTER_SETTINGS));
  for (const [section, values] of Object.entries(patch || {})) {
    if (values && typeof values === "object" && !Array.isArray(values)) {
      out[section] = { ...(out[section] || {}), ...values };
    } else {
      out[section] = values;
    }
  }
  return out;
}
