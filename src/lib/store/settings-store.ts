"use client";

import { create } from "zustand";
import { DICT, type DictKey, type Lang } from "@/lib/i18n/dict";

export type Theme = "light" | "dark";

/** Nilai untuk interpolasi placeholder {name} di string terjemahan. */
export type TVars = Record<string, string | number>;

/** Ganti placeholder {key} dengan nilai dari vars. Aman bila vars kosong. */
function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m,
  );
}

/** Resolusi kunci terjemahan sesuai bahasa + interpolasi. */
function translate(key: DictKey, lang: Lang, vars?: TVars): string {
  const entry = DICT[key];
  if (!entry) return key;
  const raw = entry[lang] ?? entry.id ?? key;
  return interpolate(raw, vars);
}

const THEME_KEY = "tb.theme";
const LANG_KEY = "tb.lang";

/** Baca nilai awal dari localStorage (aman di server: default). */
function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // Fallback: ikuti preferensi OS saat pertama kali (belum pernah memilih).
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "id";
  const saved = window.localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "id";
}

/** Terapkan/lepas class `dark` pada <html>. */
function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

interface SettingsState {
  theme: Theme;
  lang: Lang;
  /** Sudah di-hydrate dari localStorage (hindari mismatch SSR). */
  hydrated: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  /** Sinkronkan state dari localStorage + terapkan class tema. */
  hydrate: () => void;
  /** Terjemahkan sebuah kunci sesuai bahasa aktif (opsional interpolasi). */
  t: (key: DictKey, vars?: TVars) => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "light",
  lang: "id",
  hydrated: false,

  hydrate() {
    const theme = readInitialTheme();
    const lang = readInitialLang();
    applyThemeClass(theme);
    set({ theme, lang, hydrated: true });
  },

  setTheme(theme) {
    if (typeof window !== "undefined")
      window.localStorage.setItem(THEME_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },

  toggleTheme() {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },

  setLang(lang) {
    if (typeof window !== "undefined")
      window.localStorage.setItem(LANG_KEY, lang);
    if (typeof document !== "undefined")
      document.documentElement.lang = lang;
    set({ lang });
  },

  t(key, vars) {
    return translate(key, get().lang, vars);
  },
}));

/**
 * Hook praktis: kembalikan fungsi t() yang RE-RENDER saat bahasa berganti.
 * Penting: subscribe ke `lang` (bukan hanya ke fungsi `t` yang ref-nya stabil),
 * supaya komponen yang memakai t() ikut ter-render ulang ketika bahasa diubah.
 */
export function useT() {
  const lang = useSettingsStore((s) => s.lang);
  return (key: DictKey, vars?: TVars) => translate(key, lang, vars);
}
