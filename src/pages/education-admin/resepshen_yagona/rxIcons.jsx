/* Line icons for the reception cabinet (Figma «Кабинет ресепшн»): 24px grid, 1.8 stroke. */
function Svg({ size = 20, children, className = "" }) {
  return (
    <svg
      className={`rx-icon ${className}`.trim()}
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

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
  </Svg>
);
export const IconFunnel = (p) => (
  <Svg {...p}>
    <path d="M4 5h16l-6.2 7.4V18l-3.6 1.8v-7.4z" />
  </Svg>
);
export const IconStar = (p) => (
  <Svg {...p}>
    <path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" />
  </Svg>
);
export const IconList = (p) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
  </Svg>
);
export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6M16 5.6a3 3 0 0 1 0 5.6M17.5 14.8c1.5.6 2.6 2 3 4.2" />
  </Svg>
);
export const IconWallet = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
    <circle cx="12" cy="12.2" r="2.2" />
    <path d="M6.5 9.2v.01M17.5 15.2v.01" />
  </Svg>
);
export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M8 3.5v4M16 3.5v4M4 10h16" />
  </Svg>
);
export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c1.1-3.6 3.8-5.4 7-5.4s5.9 1.8 7 5.4" />
  </Svg>
);
export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.8H5z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconCheckSquare = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12.2 2.4 2.4 4.8-5" />
  </Svg>
);
export const IconBook = (p) => (
  <Svg {...p}>
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" />
    <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5" />
  </Svg>
);
export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
  </Svg>
);
export const IconDoor = (p) => (
  <Svg {...p}>
    <path d="M6 20.5V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5v16M3.5 20.5h17" />
    <path d="M14.5 12h.01" />
  </Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <circle cx="12" cy="12" r="6.2" />
    <path d="M12 3v2.8M12 18.2V21M3 12h2.8M18.2 12H21M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" />
  </Svg>
);
export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h9" />
  </Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
    <path d="M19.5 4.5V9H15" />
  </Svg>
);
export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M6.6 3.8 9 4.2l1.3 3.4-1.8 1.3a10 10 0 0 0 6.6 6.6l1.3-1.8 3.4 1.3.4 2.4a1.8 1.8 0 0 1-1.9 2C10.4 19.1 4.9 13.6 4.6 5.7a1.8 1.8 0 0 1 2-1.9z" />
  </Svg>
);
export const IconUserPlus = (p) => (
  <Svg {...p}>
    <circle cx="10" cy="8.5" r="3.5" />
    <path d="M3.5 20c1-3.6 3.6-5.4 6.5-5.4 1.4 0 2.6.3 3.7 1M18 13v6M15 16h6" />
  </Svg>
);
export const IconCard = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.2" />
  </Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
  </Svg>
);
export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </Svg>
);
export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
  </Svg>
);
export const IconMore = (p) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18.5" cy="12" r="1.2" />
  </Svg>
);
export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </Svg>
);
export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 16v-4M12 16V8M17 16v-7" />
  </Svg>
);
export const IconBriefcase = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.2" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17" />
  </Svg>
);
