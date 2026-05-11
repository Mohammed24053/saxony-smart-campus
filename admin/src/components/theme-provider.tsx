"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type ReactNode, useEffect } from "react";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const safeStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage;

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "light" ? "dark" : "light" }),
    }),
    {
      name: "seu-theme",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? safeStorage : localStorage,
      ),
    },
  ),
);

/** Applies / removes the `dark` class on the html element. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);
  return <>{children}</>;
}
