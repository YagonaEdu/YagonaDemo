import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";

/** Pushes the page title/subtitle into the cabinet top bar (student + teacher shells). */
export function useCabinetHeader(title, subtitle) {
  const { setHeader } = useOutletContext() || {};
  useEffect(() => {
    if (!setHeader || !title) return;
    setHeader({ title, subtitle: subtitle || "" });
  }, [setHeader, title, subtitle]);
}
