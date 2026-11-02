"use client";

import * as React from "react";

export type Theme = "dark" | "light";
const KEY = "gos-theme";

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const listeners = new Set<() => void>();

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** Current theme, kept in sync across components. */
export function useTheme(): Theme {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => "dark",
  );
}
