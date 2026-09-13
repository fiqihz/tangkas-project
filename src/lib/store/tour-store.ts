"use client";

import { create } from "zustand";
import { TOUR_STEPS, type TourView } from "@/lib/tour/steps";

// Flag "sudah lihat tur" disimpan di localStorage (ikut pola tb.theme/tb.lang).
// Cukup ringan untuk kebanyakan kasus; tidak menambah kolom DB. Bila nanti mau
// konsisten lintas device, bisa dipindah ke Supabase per user.
const TOUR_SEEN_KEY = "tb.tourSeen";

function readSeen(): boolean {
  if (typeof window === "undefined") return true; // SSR: jangan auto-start
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function writeSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // storage penuh / diblokir — abaikan, tur cukup tampil sekali per sesi.
  }
}

interface TourState {
  /** Tur sedang berjalan. */
  active: boolean;
  /** Index langkah aktif pada TOUR_STEPS. */
  index: number;
  /**
   * Tab yang diminta tur agar anchor langkah aktif ter-render. `AppShellContent`
   * memantau nilai ini dan menyinkronkan `view` lokalnya. `null` = tak ada
   * permintaan (jangan paksa apa pun).
   */
  requestedView: TourView | null;

  /** Mulai tur dari awal (dipakai auto-start & tombol "lihat lagi"). */
  start: () => void;
  /** Lanjut ke langkah berikutnya; selesai bila sudah di langkah terakhir. */
  next: () => void;
  /** Mundur satu langkah (tidak turun di bawah 0). */
  prev: () => void;
  /** Lompat ke index tertentu (dipakai saat anchor sebuah langkah tak muncul). */
  goTo: (index: number) => void;
  /** Tutup tur & tandai sudah dilihat. */
  finish: () => void;
  /** Alias finish untuk tombol "Lewati". */
  skip: () => void;

  /**
   * Auto-start sekali bila belum pernah lihat. Aman dipanggil berulang; hanya
   * memicu saat flag belum ada. Dipanggil dari AppShell setelah mount.
   */
  maybeAutoStart: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  requestedView: null,

  start() {
    const first = TOUR_STEPS[0];
    set({ active: true, index: 0, requestedView: first?.view ?? null });
  },

  next() {
    const { index } = get();
    const nextIndex = index + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      get().finish();
      return;
    }
    set({
      index: nextIndex,
      requestedView: TOUR_STEPS[nextIndex]?.view ?? null,
    });
  },

  prev() {
    const { index } = get();
    const prevIndex = Math.max(0, index - 1);
    set({
      index: prevIndex,
      requestedView: TOUR_STEPS[prevIndex]?.view ?? null,
    });
  },

  goTo(index) {
    const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
    set({ index: clamped, requestedView: TOUR_STEPS[clamped]?.view ?? null });
  },

  finish() {
    writeSeen();
    set({ active: false, requestedView: null });
  },

  skip() {
    get().finish();
  },

  maybeAutoStart() {
    if (get().active) return;
    if (readSeen()) return;
    get().start();
  },
}));
