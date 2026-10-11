/* Icons and tones for material kinds (library rows, type picker). */

const TONE = {
  file: "blue",
  pdf: "red",
  link: "violet",
  video: "amber",
  vocabulary: "teal",
  exam: "blue",
  text: "violet",
};

const PATHS = {
  file: (
    <>
      <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3.5V8h4.5" />
    </>
  ),
  pdf: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3M9 7.5h5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  video: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m10.5 9.5 4 2.5-4 2.5z" />
    </>
  ),
  vocabulary: (
    <>
      <path d="M4 6.5h7M7.5 4.5v2M5.5 6.5c.4 3 2.4 5.2 5 6.3M9.5 6.5c-.6 2.8-2.6 5.4-5.5 6.8" />
      <path d="m12.5 20 3.5-8.5 3.5 8.5M13.8 17h4.4" />
    </>
  ),
  exam: (
    <>
      <path d="M9 4.5h6M9.5 3h5v3h-5z" />
      <path d="M15 4.5h2A1.5 1.5 0 0 1 18.5 6v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5h2" />
      <path d="m9 13 2 2 4-4.5" />
    </>
  ),
  text: (
    <>
      <path d="M5 6h14M5 10h14M5 14h9M5 18h6" />
    </>
  ),
};

export function materialTone(kind) {
  return TONE[kind] || "blue";
}

export function MaterialKindIcon({ kind, size = 22 }) {
  return (
    <svg
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
      {PATHS[kind] || PATHS.file}
    </svg>
  );
}
