import { useCallback, useEffect, useRef } from "react";
import { t } from "@/i18n";

const message = () => t("ui.unsavedLeave");

/**
 * Warns before losing unsaved edits: tab close/reload and in-app link clicks.
 * (The app uses <BrowserRouter>, so react-router's useBlocker is unavailable.)
 * Returns confirmLeave() for in-page switches such as changing the lesson.
 */
export function useUnsavedChanges(dirty) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message();
      return message();
    };
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.target === "_blank") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return useCallback(() => !dirtyRef.current || window.confirm(message()), []);
}
