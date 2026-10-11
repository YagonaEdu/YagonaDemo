function Svg({ size = 20, children, className = "" }) {
  return (
    <svg
      className={`y-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" />
  </Svg>
);
export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="m8 12.2 2.7 2.6L16 9.5" />
  </Svg>
);
export const IconWallet = (p) => (
  <Svg {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16.5" height="11.5" rx="2.5" />
    <path d="M16 13.8h.01" />
  </Svg>
);
export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c1.3-3.6 4.1-5.4 7.5-5.4s6.2 1.8 7.5 5.4" />
  </Svg>
);
export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Svg>
);
export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0c0 5 6.5 11 6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);
export const IconBook = (p) => (
  <Svg {...p}>
    <path d="M12 6.5C10 5 7.5 4.5 4.5 5v13c3-.5 5.5 0 7.5 1.5 2-1.5 4.5-2 7.5-1.5V5c-3-.5-5.5 0-7.5 1.5zM12 6.5v13" />
  </Svg>
);
export const IconTeacher = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6M15 5h5.5v7H16" />
  </Svg>
);
export const IconChevronLeft = (p) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);
export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);
export const IconBuilding = (p) => (
  <Svg {...p}>
    <path d="M5 20.5V8.5L12 4l7 4.5v12M3.5 20.5h17M9.5 20.5v-5h5v5M9 11h.01M15 11h.01" />
  </Svg>
);
export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.2 6.2l1.3-2 4 1.5v3A2 2 0 0 1 18.4 20 15 15 0 0 1 4.5 5.6a2 2 0 0 1 2-2.1z" />
  </Svg>
);
export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </Svg>
);
export const IconFamily = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="7.5" r="2.8" />
    <circle cx="16.5" cy="9" r="2.2" />
    <path d="M3 19c.7-3 2.6-4.7 5-4.7s4.3 1.7 5 4.7M13.5 19c.5-2.2 1.7-3.4 3-3.4s2.6 1.2 3 3.4" />
  </Svg>
);
export const IconHomework = (p) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4.5V3.5h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4" />
  </Svg>
);
export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);
export const IconFolder = (p) => (
  <Svg {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  </Svg>
);
export const IconMore = (p) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="18.5" cy="12" r="1.4" />
  </Svg>
);
export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
    <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
  </Svg>
);
export const IconVideo = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="12.5" height="12" rx="2.5" />
    <path d="m16 10.5 4.5-2.5v8L16 13.5" />
  </Svg>
);
export const IconText = (p) => (
  <Svg {...p}>
    <path d="M5 6h14M5 10.5h14M5 15h9M5 19.5h6" />
  </Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconStar = (p) => (
  <Svg {...p}>
    <path d="m12 3.8 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
  </Svg>
);
export const IconMic = (p) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />
  </Svg>
);
export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
    <path d="m6 7 .8 11.6A2 2 0 0 0 8.8 20.5h6.4a2 2 0 0 0 2-1.9L18 7" />
  </Svg>
);
export const IconImage = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m4 17.5 4.5-4.5 3 3 3-3.5 5.5 5.5" />
  </Svg>
);
export const IconStop = (p) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </Svg>
);
export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconCards = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="13" height="13" rx="2.5" />
    <path d="M8 4h10a2.5 2.5 0 0 1 2.5 2.5V16" />
  </Svg>
);
export const IconSound = (p) => (
  <Svg {...p}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const IconBooks = (p) => (
  <Svg {...p}>
    <path d="M5 4.5h4v15H5zM10 4.5h4v15h-4z" />
    <path d="m15 5.2 3.7-1 3 14.5-3.7 1z" />
  </Svg>
);
export const IconTimer = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 9.5v4l2.5 2M9.5 3h5" />
  </Svg>
);
export const IconGrades = (p) => (
  <Svg {...p}>
    <path d="m12 3.8 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
  </Svg>
);
export const IconCourses = (p) => (
  <Svg {...p}>
    <path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" />
    <path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M9 8.5h6" />
  </Svg>
);
export const IconLive = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="6.5" width="12" height="11" rx="2.5" />
    <path d="m15.5 10.5 5-3v9l-5-3" />
  </Svg>
);
