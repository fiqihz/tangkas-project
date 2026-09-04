// ============================================================================
// Kamus terjemahan ringan (ID/EN) — tanpa dependensi eksternal.
// Kunci diorganisir per area. t() akan fallback ke Bahasa Indonesia lalu ke
// kunci mentah bila terjemahan belum ada, sehingga cakupan parsial tetap aman.
// ============================================================================

export type Lang = "id" | "en";

export const DICT = {
  // Navigasi bawah (bottom nav)
  "nav.players": { id: "Pemain", en: "Players" },
  "nav.courts": { id: "Lapangan", en: "Courts" },
  "nav.leaderboard": { id: "Skor", en: "Score" },
  "nav.history": { id: "History", en: "History" },
  "nav.finish": { id: "Selesai", en: "Finish" },

  // Header umum
  "header.backToList": { id: "Kembali ke daftar mabar", en: "Back to session list" },
  "header.scheduled": { id: "Terjadwal · belum mulai", en: "Scheduled · not started" },
  "header.roundCourts": { id: "Ronde", en: "Round" },
  "header.courts": { id: "lapangan", en: "courts" },

  // Menu Pengaturan
  "settings.title": { id: "Pengaturan", en: "Settings" },
  "settings.open": { id: "Buka pengaturan", en: "Open settings" },
  "settings.close": { id: "Tutup pengaturan", en: "Close settings" },
  "settings.appearance": { id: "Tampilan", en: "Appearance" },
  "settings.darkMode": { id: "Mode gelap", en: "Dark mode" },
  "settings.darkModeDesc": {
    id: "Aktifkan tema gelap untuk kondisi minim cahaya.",
    en: "Enable dark theme for low-light conditions.",
  },
  "settings.language": { id: "Bahasa", en: "Language" },
  "settings.languageDesc": {
    id: "Pilih bahasa tampilan aplikasi.",
    en: "Choose the app display language.",
  },
  "settings.langId": { id: "Indonesia", en: "Indonesian" },
  "settings.langEn": { id: "Inggris", en: "English" },

  // Courts screen
  "courts.smartMatchmaking": { id: "Smart Matchmaking", en: "Smart Matchmaking" },
  "courts.regenerate": { id: "Susun Ulang", en: "Regenerate" },
  "courts.finishScore": { id: "Finish & Skor", en: "Finish & Score" },
  "courts.startMatch": { id: "Mulai Main", en: "Start Match" },
  "courts.fillManual": { id: "Isi manual", en: "Fill manually" },
  "courts.emptyCourt": { id: "Lapangan kosong.", en: "Court is empty." },
  "courts.addCourt": { id: "Lapangan", en: "Court" },

  // Players screen
  "players.searchPlaceholder": { id: "Cari nama pemain…", en: "Search player name…" },
  "players.setActive": { id: "Set Active", en: "Set Active" },
  "players.setInactive": { id: "Set Inactive", en: "Set Inactive" },
  "players.checkIn": { id: "Check-in / Aktif", en: "Check-in / Active" },
  "players.status.registered": { id: "Belum check-in", en: "Not checked in" },
  "players.status.active": { id: "Main (Active)", en: "Playing (Active)" },
  "players.status.resting": { id: "Istirahat", en: "Resting" },
  "players.status.left": { id: "Pulang", en: "Left" },
  "players.addFab": { id: "Pemain", en: "Player" },
} as const;

export type DictKey = keyof typeof DICT;
