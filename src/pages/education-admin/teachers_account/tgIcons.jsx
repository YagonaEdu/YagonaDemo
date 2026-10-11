function IconBase({ children, size = 18, className = "" }) {
  return (
    <svg
      className={`tg-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconGroups({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 4h7.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H10V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

export function IconUsers({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19c.8-2.8 3-4.5 5.5-4.5S13.7 16.2 14.5 19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 8.5a2.5 2.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 19c-.5-1.8-1.8-3-3.5-3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function IconCalendar({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

export function IconTrend({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M4 17 9 12l4 4 7-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 8h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function IconClipboard({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <rect x="6" y="5" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 5.5V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9 11h6M9 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

export function IconSend({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M20 4 10.5 13.5M20 4l-6 16-3.5-6.5L4 10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function IconEye({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
    </IconBase>
  );
}

export function IconClock({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.2l2.6 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </IconBase>
  );
}

export function IconAlert({ size, className }) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M12 8.5v4.5M12 16.2h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.3 4.5h3.4L20 18.5H4L10.3 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export const SUMMARY_ICON_MAP = {
  groups: IconGroups,
  students: IconUsers,
  week: IconCalendar,
  attendance: IconTrend,
  reviews: IconClipboard,
  attention: IconAlert,
};
