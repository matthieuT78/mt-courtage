import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bailleur_theme";

export function useBailleurTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem(STORAGE_KEY) === "dark");
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {}
      return next;
    });
  }, []);

  return { dark, toggle };
}
