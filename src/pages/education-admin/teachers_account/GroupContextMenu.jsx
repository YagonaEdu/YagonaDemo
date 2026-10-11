import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";

export default function GroupContextMenu({
  onAttendance,
  onCreateAssignment,
  onAddMaterial,
  onNotify,
  onOpenSchedule,
  ariaLabel = t("tGroups.menuLabel"),
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const items = [
    { key: "attendance", label: t("tGroups.menuAttendance"), action: onAttendance },
    { key: "assignment", label: t("tGroups.menuAssignment"), action: onCreateAssignment },
    { key: "material", label: t("tGroups.menuMaterial"), action: onAddMaterial },
    { key: "notify", label: t("tGroups.menuNotify"), action: onNotify },
    { key: "schedule", label: t("tGroups.menuSchedule"), action: onOpenSchedule },
  ].filter((row) => typeof row.action === "function");

  return (
    <div className="tg-menu" ref={rootRef}>
      <button
        type="button"
        className="tg-menu-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="tg-menu-popover" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="tg-menu-item"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.action();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
