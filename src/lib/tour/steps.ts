// ============================================================================
// Definisi langkah walkthrough (spotlight / coach-marks) — "Opsi A" hybrid.
//
// Tiap langkah menyorot SATU elemen UI asli lewat atribut `data-tour`, dengan
// tooltip singkat. Karena TangkasBoard app berbasis alur & data-nya di-load
// client-side, tiap langkah bisa:
//   - `view`: tab yang harus aktif dulu (overlay akan minta ganti tab), dan
//   - anchor bisa BELUM ada di DOM (mis. tab Courts saat belum ada lapangan).
// Langkah yang anchornya tak muncul dalam batas waktu akan di-skip otomatis,
// sehingga tur tetap mengalir walau sesi masih kosong.
// ============================================================================

import type { DictKey } from "@/lib/i18n/dict";

/** Tab board yang bisa diminta tur. `sessions` = daftar mabar (belum buka sesi). */
export type TourView =
  | "sessions"
  | "players"
  | "courts"
  | "leaderboard"
  | "finish";

/** Sisi tooltip relatif ke elemen yang disorot. */
export type TourPlacement = "top" | "bottom" | "auto";

export interface TourStep {
  /** Nilai `data-tour` pada elemen yang disorot. */
  anchor: string;
  /** Kunci i18n judul & isi tooltip. */
  titleKey: DictKey;
  bodyKey: DictKey;
  /** Tab yang harus aktif agar anchor ter-render (opsional). */
  view?: TourView;
  /** Preferensi posisi tooltip; default "auto" (dihitung dari ruang layar). */
  placement?: TourPlacement;
}

/**
 * Urutan langkah mengikuti alur host: bikin mabar → tambah pemain → atur
 * lapangan → susun match → pantau skor → selesai. Anchor sudah diverifikasi
 * ke source (lihat catatan di masing-masing screen).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "create-session",
    titleKey: "tour.createTitle",
    bodyKey: "tour.createBody",
    view: "sessions",
    placement: "top",
  },
  {
    anchor: "add-player",
    titleKey: "tour.playersTitle",
    bodyKey: "tour.playersBody",
    view: "players",
    placement: "top",
  },
  {
    anchor: "add-court",
    titleKey: "tour.courtsTitle",
    bodyKey: "tour.courtsBody",
    view: "courts",
    placement: "top",
  },
  {
    anchor: "smart-matchmaking",
    titleKey: "tour.matchTitle",
    bodyKey: "tour.matchBody",
    view: "courts",
    placement: "auto",
  },
  {
    anchor: "leaderboard",
    titleKey: "tour.scoreTitle",
    bodyKey: "tour.scoreBody",
    view: "leaderboard",
    placement: "bottom",
  },
  {
    anchor: "finish-session",
    titleKey: "tour.finishTitle",
    bodyKey: "tour.finishBody",
    view: "finish",
    placement: "auto",
  },
];
