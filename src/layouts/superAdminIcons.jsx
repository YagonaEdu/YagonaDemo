function Svg({ children, size = 18 }) {
  return (
    <svg
      className="sa-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconOverview(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </Svg>
  );
}

export function IconBuilding(props) {
  return (
    <Svg {...props}>
      <path d="M4 20.5h16" />
      <path d="M6 20.5V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5v15" />
      <path d="M15 9.5h2.5A1.5 1.5 0 0 1 19 11v9.5" />
      <path d="M9 8h3M9 11.5h3M9 15h3" />
    </Svg>
  );
}

export function IconStudents(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.8-3 3-4.7 5.5-4.7s4.7 1.7 5.5 4.7" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17 14.9c1.8.5 3 1.9 3.5 4.6" />
    </Svg>
  );
}

export function IconLayers(props) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" />
      <path d="m3.5 12.2 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.2 8.5 4.3 8.5-4.3" />
    </Svg>
  );
}

export function IconLicense(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M6.2 16c.5-1.3 1.6-2 2.8-2s2.3.7 2.8 2M14 9.5h3.5M14 13h3.5" />
    </Svg>
  );
}

export function IconWallet(props) {
  return (
    <Svg {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1.5 1.5 0 0 1 1.5 1.5V8" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M16 13.5h.01" strokeWidth="2.6" />
    </Svg>
  );
}

export function IconChart(props) {
  return (
    <Svg {...props}>
      <path d="M4 20.5h16" />
      <path d="M7 16.5v-5M12 16.5V7.5M17 16.5v-8" />
    </Svg>
  );
}

export function IconMenu(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconClose(props) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconChevronDown(props) {
  return (
    <Svg {...props}>
      <path d="m7 10 5 5 5-5" />
    </Svg>
  );
}

export function IconLogout(props) {
  return (
    <Svg {...props}>
      <path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </Svg>
  );
}

export function IconEnter(props) {
  return (
    <Svg {...props}>
      <path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10" />
      <path d="m14 8 4 4-4 4M18 12H9" />
    </Svg>
  );
}

export const SUPER_NAV_ICONS = {
  "/super": IconOverview,
  "/super/centers": IconBuilding,
  "/super/students": IconStudents,
  "/super/plans": IconLayers,
  "/super/licenses": IconLicense,
  "/super/wallet": IconWallet,
  "/super/analytics": IconChart,
};
