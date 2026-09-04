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

  "courts.emptyPlayers": {
    id: "Belum ada pemain. Tap tombol + untuk menambah.",
    en: "No players yet. Tap the + button to add.",
  },
  "courts.emptyNoCourt": {
    id: "Belum ada lapangan. Tap tombol + untuk menambah.",
    en: "No courts yet. Tap the + button to add.",
  },
  "courts.summary": {
    id: "{active} aktif · {playing} main · {waiting} menunggu",
    en: "{active} active · {playing} playing · {waiting} waiting",
  },
  "courts.matchNo": { id: "Match ke-{n}", en: "Match #{n}" },
  "courts.notStarted": { id: "belum mulai", en: "not started" },
  "courts.running": { id: "sedang berjalan", en: "in progress" },
  "courts.teamA": { id: "Tim A", en: "Team A" },
  "courts.teamB": { id: "Tim B", en: "Team B" },
  "courts.firstMatch": {
    id: "Match Pertama (urut check-in)",
    en: "First Match (by check-in order)",
  },
  "courts.nextLocked": {
    id: "⏭️ Main berikutnya (terkunci — tap pemain untuk ganti)",
    en: "⏭️ Up next (locked — tap a player to change)",
  },
  "courts.deletedCourt": { id: "Lapangan (dihapus)", en: "Court (deleted)" },
  "courts.renameCourt": { id: "Ubah nama lapangan", en: "Rename court" },
  "courts.deleteCourt": { id: "Hapus lapangan", en: "Delete court" },
  "courts.renameTitle": { id: "Ubah Nama Lapangan", en: "Rename Court" },
  "courts.renamePlaceholder": {
    id: "Nama lapangan (mis. Lapangan 14)",
    en: "Court name (e.g. Court 14)",
  },
  "courts.saving": { id: "Menyimpan…", en: "Saving…" },

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
  "players.setLevel": { id: "Set level", en: "Set level" },
  "players.setGender": { id: "Set gender", en: "Set gender" },
  "players.notSet": { id: "(belum di-set)", en: "(not set)" },
  "players.empty": {
    id: "Belum ada pemain. Tap tombol + Pemain untuk menambah dari roster atau buat pemain baru.",
    en: "No players yet. Tap the + Player button to add from the roster or create a new one.",
  },
  "players.noMatch": {
    id: "Tidak ada pemain cocok.",
    en: "No players match your search.",
  },
  "players.playing": { id: "Main", en: "Playing" },
  "players.gamesSuffix": { id: "x", en: "x" },

  // History screen
  "history.title": { id: "History Match", en: "Match History" },
  "history.subtitle": {
    id: "Semua match yang sudah berlalu per lapangan. Tap ikon pensil untuk edit skor.",
    en: "All past matches per court. Tap the pencil icon to edit the score.",
  },
  "history.empty": {
    id: "Belum ada match yang selesai.",
    en: "No finished matches yet.",
  },
  "history.unfinished": { id: "tidak selesai", en: "unfinished" },
  "history.editScore": { id: "Edit skor", en: "Edit score" },

  // Leaderboard / Livescore
  "leaderboard.title": { id: "Livescore", en: "Livescore" },
  "leaderboard.subtitle": {
    id: "Update otomatis tiap match selesai. Urut: menang → selisih poin → total poin. +M = bonus poin untuk jatah main yang tertinggal.",
    en: "Updates automatically after each match. Sorted by: wins → point diff → total points. +M = bonus points for missed play turns.",
  },
  "leaderboard.empty": { id: "Belum ada hasil match.", en: "No match results yet." },
  "leaderboard.colPlayer": { id: "Pemain", en: "Player" },
  "leaderboard.winRate": { id: "Win rate", en: "Win rate" },
  "leaderboard.bonusTitle": {
    id: "Bonus poin jatah main tertinggal",
    en: "Bonus points for missed play turns",
  },

  // Finish screen
  "finish.title": { id: "Selesai Mabar", en: "Finish Session" },
  "finish.subtitle": {
    id: "Tekan tombol di bawah untuk mengunci hasil akhir & menampilkan juara.",
    en: "Press the button below to lock the final result & show the champion.",
  },
  "finish.leader": { id: "Pemuncak sementara", en: "Current leader" },
  "finish.winsPoints": {
    id: "{wins} menang · diff {diff} · {points} poin",
    en: "{wins} wins · diff {diff} · {points} points",
  },
  "finish.noResult": {
    id: "Belum ada hasil match. Selesaikan minimal satu match dulu.",
    en: "No match results yet. Finish at least one match first.",
  },
  "finish.finishButton": { id: "SELESAI MABAR", en: "FINISH SESSION" },
  "finish.confirmTitle": { id: "Selesaikan mabar?", en: "Finish this session?" },
  "finish.confirmBody": {
    id: "Hasil akhir akan ditampilkan & sesi diarsipkan. Roster, level, dan hitungan \"ikut mabar\" pemain tetap tersimpan untuk mabar berikutnya.",
    en: "The final result will be shown & the session archived. Roster, levels, and each player's \"sessions joined\" count stay saved for the next session.",
  },
  "finish.finishing": { id: "Menyelesaikan…", en: "Finishing…" },
  "finish.confirmYes": { id: "Ya, selesai", en: "Yes, finish" },

  // Common
  "common.cancel": { id: "Batal", en: "Cancel" },
  "common.back": { id: "Kembali", en: "Back" },
  "common.save": { id: "Simpan", en: "Save" },
  "common.delete": { id: "Hapus", en: "Delete" },
  "common.noPlayers": { id: "Tidak ada pemain.", en: "No players." },

  // Mode picker (Smart Matchmaking)
  "mode.title": { id: "Pilih Mode Match", en: "Choose Match Mode" },
  "mode.subtitle": {
    id: "Mode menentukan cara pemain disusun untuk preview berikutnya.",
    en: "The mode determines how players are arranged for the next preview.",
  },
  "mode.firstMatch": {
    id: "Match Pertama (urut check-in)",
    en: "First Match (by check-in order)",
  },
  "mode.firstMatchDescOk": {
    id: "Susun 4 pemain yang belum pernah main, urut kedatangan. Abaikan level.",
    en: "Arrange 4 players who haven't played yet, by arrival order. Ignores level.",
  },
  "mode.firstMatchDescNo": {
    id: "Butuh min. 4 pemain yang belum pernah main (0x).",
    en: "Needs at least 4 players who haven't played yet (0x).",
  },
  "mode.firstMatchAlert": {
    id: "⚠️ Mode Match Pertama tidak bisa dipakai: pemain yang belum pernah main (0x) kurang dari 4. Pilih mode lain di bawah.",
    en: "⚠️ First Match mode unavailable: fewer than 4 players who haven't played (0x). Choose another mode below.",
  },
  "mode.balanced": { id: "Seimbang", en: "Balanced" },
  "mode.balancedDesc": {
    id: "Default. Susun tim seimbang, minimalkan selisih level.",
    en: "Default. Build balanced teams, minimize level gap.",
  },
  "mode.mixed": { id: "Campuran", en: "Mixed" },
  "mode.mixedDesc": {
    id: "Ganda campuran: tiap tim 1 cowok + 1 cewek (best-effort).",
    en: "Mixed doubles: each team 1 male + 1 female (best-effort).",
  },
  "mode.ladies": { id: "Ganda Putri", en: "Ladies Doubles" },
  "mode.ladiesDesc": {
    id: "Semua pemain cewek. Aturan Newbie+Newbie dilonggarkan.",
    en: "All female players. Newbie+Newbie rule relaxed.",
  },
  "mode.gendongan": { id: "Gendongan", en: "Carry" },
  "mode.gendonganDesc": {
    id: "Tiap tim 1 kuat + 1 lemah, dua tim dibuat seimbang.",
    en: "Each team 1 strong + 1 weak, both teams balanced.",
  },
  "mode.kelas": { id: "Sesuai Kelas", en: "By Class" },
  "mode.kelasDesc": {
    id: "Pasangkan pemain dengan level yang sama.",
    en: "Pair players of the same level.",
  },

  // Delete court dialog
  "deleteCourt.title": { id: "Hapus {label}?", en: "Delete {label}?" },
  "deleteCourt.playing": {
    id: "⚠️ Ada match yang sedang berjalan di lapangan ini. Menghapus lapangan akan membatalkan match tersebut — skor yang belum di-input hilang dan pemainnya dikembalikan ke status aktif. Tindakan ini tidak bisa dibatalkan.",
    en: "⚠️ A match is in progress on this court. Deleting it will cancel that match — unsaved scores are lost and its players return to active status. This cannot be undone.",
  },
  "deleteCourt.proposed": {
    id: "Ada preview match berikutnya di lapangan ini. Menghapus lapangan akan membatalkan preview tersebut. Tindakan ini tidak bisa dibatalkan.",
    en: "There is a next-match preview on this court. Deleting it will cancel that preview. This cannot be undone.",
  },
  "deleteCourt.plain": {
    id: "Lapangan ini akan dihapus dari sesi. Tindakan ini tidak bisa dibatalkan.",
    en: "This court will be removed from the session. This cannot be undone.",
  },
  "deleteCourt.deleting": { id: "Menghapus…", en: "Deleting…" },
  "deleteCourt.confirm": { id: "Hapus lapangan", en: "Delete court" },

  // Complete info dialog
  "completeInfo.title": { id: "Lengkapi data pemain", en: "Complete player data" },
  "completeInfo.body": {
    id: "Match ini sudah selesai — set level & gender pemain yang belum terisi sebelum input skor. Data tersimpan ke roster.",
    en: "This match is finished — set level & gender for players still missing them before entering the score. Data is saved to the roster.",
  },
  "completeInfo.done": { id: "✓ lengkap", en: "✓ complete" },
  "completeInfo.continue": { id: "Lanjut ke Skor", en: "Continue to Score" },
  "completeInfo.incomplete": { id: "Lengkapi dulu", en: "Complete first" },

  // Player action dialog
  "playerAction.gamesPlayed": { id: "x main", en: "x played" },
  "playerAction.restAuto": {
    id: "Istirahatkan (pengganti otomatis)",
    en: "Rest (auto substitute)",
  },
  "playerAction.restPick": {
    id: "Istirahatkan — pilih pengganti",
    en: "Rest — pick substitute",
  },
  "playerAction.swap": { id: "Ganti / tukar pemain", en: "Change / swap player" },
  "playerAction.pickRest": {
    id: "Pilih pengganti — {name} akan istirahat.",
    en: "Pick a substitute — {name} will rest.",
  },
  "playerAction.pickFor": {
    id: "Pilih pengganti untuk {name}.",
    en: "Pick a substitute for {name}.",
  },
  "playerAction.searchName": { id: "Cari nama…", en: "Search name…" },
  "playerAction.waiting": { id: "Menunggu", en: "Waiting" },
  "playerAction.playingSection": {
    id: "Sedang bermain (di-booking untuk match ini)",
    en: "Currently playing (booked for this match)",
  },
  "playerAction.playingTag": { id: "sedang bermain", en: "playing" },
  "playerAction.swapSamePreview": {
    id: "Tukar posisi di preview ini",
    en: "Swap position in this preview",
  },
  "playerAction.previewThis": { id: "preview ini", en: "this preview" },
  "playerAction.swapOtherPreview": {
    id: "Tukar dengan preview lapangan lain",
    en: "Swap with another court's preview",
  },
  "playerAction.previewOther": { id: "preview lain", en: "other preview" },
  "playerAction.suggested": { id: "⭐ Disarankan", en: "⭐ Suggested" },
  "playerAction.allAvailable": { id: "Semua pemain tersedia", en: "All available players" },
  "playerAction.swapThisCourt": {
    id: "Tukar posisi di lapangan ini",
    en: "Swap position on this court",
  },
  "playerAction.thisCourt": { id: "lapangan ini", en: "this court" },
  "playerAction.swapPlaying": {
    id: "Tukar dengan yang sedang main (lapangan lain)",
    en: "Swap with someone playing (another court)",
  },
  "playerAction.playingShort": { id: "main", en: "playing" },
  "playerAction.failed": { id: "Gagal.", en: "Failed." },

  // Manual fill dialog
  "manual.title": { id: "Isi Manual", en: "Manual Fill" },
  "manual.subtitle": {
    id: "Pilih 4 pemain (urutan: 2 pertama = Tim A, 2 berikutnya = Tim B).",
    en: "Pick 4 players (order: first 2 = Team A, next 2 = Team B).",
  },
  "manual.noIdle": {
    id: "Tidak ada pemain aktif yang menganggur.",
    en: "No idle active players available.",
  },
  "manual.ruleViolation": {
    id: "Melanggar aturan: Newbie tidak boleh setim dengan Newbie.",
    en: "Rule violation: Newbie can't be paired with Newbie.",
  },
  "manual.start": { id: "Mulai ({n}/4)", en: "Start ({n}/4)" },
  "manual.saving": { id: "Menyimpan…", en: "Saving…" },

  // Sessions list (landing)
  "sessions.subtitle": { id: "Daftar Mabar", en: "Session List" },
  "sessions.roster": { id: "Roster", en: "Roster" },
  "sessions.empty": {
    id: "Belum ada mabar. Tap tombol + Mabar untuk mulai atau menjadwalkan.",
    en: "No sessions yet. Tap the + Session button to start or schedule one.",
  },
  "sessions.status.ongoing": { id: "Sedang Berjalan", en: "Ongoing" },
  "sessions.status.scheduled": { id: "Dijadwalkan", en: "Scheduled" },
  "sessions.status.finished": { id: "Selesai", en: "Finished" },
  "sessions.fab": { id: "Mabar", en: "Session" },
  "sessions.courtsSuffix": { id: "lapangan", en: "courts" },
  "sessions.deleteTitle": { id: "Hapus mabar?", en: "Delete session?" },
  "sessions.deleteBody": {
    id: "Mabar {name} beserta semua match & skornya akan dihapus permanen. Roster & level pemain tetap aman. Tindakan ini tidak bisa dibatalkan.",
    en: "Session {name} and all its matches & scores will be permanently deleted. Player roster & levels stay safe. This cannot be undone.",
  },
  "sessions.deleteYes": { id: "Ya, hapus", en: "Yes, delete" },
  "sessions.deleteAria": { id: "Hapus mabar", en: "Delete session" },
  "sessions.open": { id: "Buka", en: "Open" },
  "sessions.start": { id: "Mulai", en: "Start" },
  "sessions.viewResult": { id: "Lihat hasil", en: "View result" },
  "sessions.reactivate": { id: "Aktifkan", en: "Activate" },
  "sessions.failed": { id: "Gagal.", en: "Failed." },

  // Create session dialog
  "createSession.title": { id: "Mabar Baru", en: "New Session" },
  "createSession.defaultName": { id: "Mabar", en: "Session" },
  "createSession.name": { id: "Nama mabar", en: "Session name" },
  "createSession.courts": { id: "Jumlah lapangan", en: "Number of courts" },
  "createSession.courtNames": { id: "Nama lapangan (opsional)", en: "Court names (optional)" },
  "createSession.courtPlaceholder": { id: "Lapangan {n}", en: "Court {n}" },
  "createSession.schedule": {
    id: "Jadwal (opsional — isi jika ingin dijadwalkan)",
    en: "Schedule (optional — fill in to schedule it)",
  },
  "createSession.startNow": { id: "Mulai Sekarang 🏸", en: "Start Now 🏸" },
  "createSession.scheduleBtn": { id: "Simpan sebagai Jadwal", en: "Save as Schedule" },
  "createSession.creating": { id: "Membuat…", en: "Creating…" },

  // Finish match (score) dialog
  "finishMatch.title": { id: "Input Skor · Match ke-{n}", en: "Enter Score · Match #{n}" },
  "finishMatch.subtitle": {
    id: "Setelah disimpan, lapangan bisa diisi pemain berikutnya.",
    en: "After saving, the court can be filled with the next players.",
  },
  "finishMatch.draw": {
    id: "Skor seri — akan dicatat sebagai draw.",
    en: "Tied score — will be recorded as a draw.",
  },
  "finishMatch.winner": { id: "🏆 Pemenang: {name}", en: "🏆 Winner: {name}" },
  "finishMatch.saving": { id: "Menyimpan…", en: "Saving…" },
  "finishMatch.save": { id: "Simpan", en: "Save" },

  // Edit score dialog
  "editScore.title": { id: "Edit Skor", en: "Edit Score" },
  "editScore.subtitle": {
    id: "Statistik & leaderboard otomatis dihitung ulang.",
    en: "Stats & leaderboard are recalculated automatically.",
  },
  "editScore.failed": { id: "Gagal menyimpan.", en: "Failed to save." },

  // Level badge
  "level.notSet": { id: "belum di-set", en: "not set" },

  // Read-only result (finished session view)
  "result.readonly": {
    id: "Hasil akhir (read-only) · aktifkan lagi untuk edit",
    en: "Final result (read-only) · reactivate to edit",
  },
  "result.share": { id: "Bagikan hasil", en: "Share result" },
  "result.copied": { id: "Hasil disalin ke clipboard.", en: "Result copied to clipboard." },
  "result.shareFailed": {
    id: "Gagal membagikan hasil. Coba lagi.",
    en: "Failed to share result. Try again.",
  },
  "result.noPlayers": {
    id: "Tidak ada pemain yang bermain di sesi ini.",
    en: "No players took part in this session.",
  },
} as const;

export type DictKey = keyof typeof DICT;
