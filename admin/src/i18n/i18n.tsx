'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, type ReactNode } from 'react';
import en from './messages/en.json';
import ar from './messages/ar.json';

export type Locale = 'en' | 'ar';

const dictionaries: Record<Locale, Record<string, unknown>> = { en, ar };

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'seu-locale',
      storage: createJSONStorage(() => (typeof window === 'undefined' ? undefinedStorage : localStorage)),
    },
  ),
);

const undefinedStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage;

function lookup(dict: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * Translation hook. Returns a `t(key, vars?)` function and the current locale.
 * Falls back to the English value when an Arabic key is missing, then to the
 * key itself so missing-translation gaps are visible in dev.
 */
export function useT() {
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const v = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
    return v ? format(v, vars) : key;
  };
  return { t, locale, setLocale, dir: locale === 'ar' ? ('rtl' as const) : ('ltr' as const) };
}

/** Updates `<html dir>` and `<html lang>` when the locale changes. */
export function DirectionProvider({ children }: { children: ReactNode }) {
  const { locale, dir } = useT();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);
  return <>{children}</>;
}

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
];
