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
  "courts.setBadge": { id: "Set {s}/{n}", en: "Set {s}/{n}" },
  "courts.finishSet": { id: "Selesai Set", en: "Finish Set" },
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
  "players.editName": { id: "Edit nama", en: "Edit name" },
  "players.remove": { id: "Hapus pemain", en: "Remove player" },
  "players.paid": { id: "Lunas", en: "Paid" },
  "players.paidStatus": { id: "Sudah bayar", en: "Paid" },
  "players.removeConfirm": {
    id: "Hapus pemain ini dari sesi? Statistik di sesi ini akan hilang. Roster tidak terpengaruh.",
    en: "Remove this player from the session? Their stats in this session will be lost. The roster is not affected.",
  },
  "players.namePlaceholder": { id: "Nama pemain", en: "Player name" },
  "players.notSet": { id: "(belum di-set)", en: "(not set)" },
  "players.emptyTitle": { id: "Lapangan masih sepi", en: "The court is empty" },
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
  "history.draw": { id: "Seri", en: "Draw" },
  "history.setsLabel": { id: "Set: {sets}", en: "Sets: {sets}" },

  // Leaderboard / Livescore
  "leaderboard.title": { id: "Livescore", en: "Livescore" },
  "leaderboard.subtitle": {
    id: "Update otomatis tiap match selesai. Urut: total poin → selisih poin. +M = bonus poin untuk jatah main yang tertinggal.",
    en: "Updates automatically after each match. Sorted by: total points → point diff. +M = bonus points for missed play turns.",
  },
  "leaderboard.emptyTitle": { id: "Papan skor menunggu", en: "Scoreboard awaits" },
  "leaderboard.empty": { id: "Belum ada hasil match.", en: "No match results yet." },
  "leaderboard.colPlayer": { id: "Pemain", en: "Player" },
  "leaderboard.drawTitle": { id: "Seri (draw)", en: "Draws" },
  "leaderboard.winRate": { id: "Win rate", en: "Win rate" },
  "leaderboard.cockTitle": {
    id: "Total kok yang dipakai pemain ini",
    en: "Total shuttlecocks used by this player",
  },
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
  "finish.cockTotal": { id: "Total kok kepakai", en: "Total shuttlecocks used" },
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
  "mode.needsBorrow": { id: "perlu pinjam", en: "needs borrow" },
  "mode.unavailable": { id: "belum bisa", en: "unavailable" },

  // Reserve confirm (Poin D — pinjam pemain dari lapangan lain)
  "reserve.title": {
    id: "Pinjam pemain dari lapangan lain?",
    en: "Borrow players from other courts?",
  },
  "reserve.body": {
    id: "Mode ini belum bisa disusun dari pemain yang menunggu. Pinjam pemain berikut untuk match berikutnya:",
    en: "This mode can't be arranged from waiting players. Borrow the following players for the next match:",
  },
  "reserve.playing": { id: "main", en: "playing" },
  "reserve.note": {
    id: "Pemain tetap menyelesaikan match yang sedang berjalan dulu. Preview ini baru bisa dimulai setelah match mereka selesai.",
    en: "These players finish their current match first. This preview can only start after their match ends.",
  },
  "reserve.confirm": { id: "Pinjam & susun", en: "Borrow & arrange" },
  "reserve.arranging": { id: "Menyusun…", en: "Arranging…" },

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
  "sessions.emptyTitle": { id: "Belum ada mabar", en: "No sessions yet" },
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
  "createSession.trackShuttlecocks": {
    id: "Gunakan perhitungan kok?",
    en: "Track shuttlecock usage?",
  },
  "createSession.trackShuttlecocksDesc": {
    id: "Catat pemakaian kok tiap match. Aktifkan bila kok dibayar terpisah dari lapangan.",
    en: "Record shuttlecock usage per match. Turn on if shuttlecocks are paid separately from the court.",
  },
  "createSession.schedule": {
    id: "Jadwal (opsional — isi jika ingin dijadwalkan)",
    en: "Schedule (optional — fill in to schedule it)",
  },
  "createSession.startNow": { id: "Mulai Sekarang 🏸", en: "Start Now 🏸" },
  "createSession.scheduleBtn": { id: "Simpan sebagai Jadwal", en: "Save as Schedule" },
  "createSession.creating": { id: "Membuat…", en: "Creating…" },
  "createSession.setsFormat": { id: "Format set per match", en: "Sets per match" },
  "createSession.setsFormatDesc": {
    id: "Berapa set tiap match. Best of 2/3 = pemenang ditentukan mayoritas set.",
    en: "How many sets each match has. Best of 2/3 = winner decided by set majority.",
  },
  "createSession.bestOf": { id: "Best of {n}", en: "Best of {n}" },
  "createSession.oneSet": { id: "1 set", en: "1 set" },

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
  "finishMatch.shuttlecocks": { id: "Kok kepakai", en: "Shuttlecocks used" },
  "finishMatch.shuttlecocksHint": { id: "per biji (opsional)", en: "per piece (optional)" },
  "finishMatch.shuttlecocksCarry": {
    id: "Total kok match ini (sudah termasuk set sebelumnya) — tambah bila ada kok baru.",
    en: "Total shuttlecocks for this match (includes earlier sets) — add more if new ones were used.",
  },
  // Multi-set (Best of 2/3)
  "finishMatch.setTitle": { id: "Skor Set {s} · Match ke-{n}", en: "Set {s} Score · Match #{n}" },
  "finishMatch.setSubtitle": {
    id: "Isi skor set ini. Bila match belum selesai, lanjut ke set berikutnya.",
    en: "Enter this set's score. If the match isn't over, continue to the next set.",
  },
  "finishMatch.setTie": {
    id: "Satu set tidak boleh imbang — harus ada pemenang.",
    en: "A set can't be tied — there must be a winner.",
  },
  "finishMatch.setWinner": { id: "Set ini: {name}", en: "This set: {name}" },
  "finishMatch.setProgress": { id: "Set menang — {a} : {b}", en: "Sets won — {a} : {b}" },
  "finishMatch.saveSet": { id: "Simpan Set", en: "Save Set" },
  "finishMatch.bestOf": { id: "Best of {n}", en: "Best of {n}" },

  // Edit score dialog
  "editScore.title": { id: "Edit Skor", en: "Edit Score" },
  "editScore.subtitle": {
    id: "Statistik & leaderboard otomatis dihitung ulang.",
    en: "Stats & leaderboard are recalculated automatically.",
  },
  "editScore.failed": { id: "Gagal menyimpan.", en: "Failed to save." },
  "editScore.setLabel": { id: "Set {s}", en: "Set {s}" },
  "editScore.setTie": {
    id: "Set {s} tidak boleh imbang.",
    en: "Set {s} can't be tied.",
  },

  // Level badge
  "level.notSet": { id: "belum di-set", en: "not set" },

  // Gender
  "gender.male": { id: "Cowok", en: "Male" },
  "gender.female": { id: "Cewek", en: "Female" },

  // Add player dialog
  "addPlayer.title": { id: "Tambah Pemain", en: "Add Player" },
  "addPlayer.fromRoster": { id: "Dari Roster", en: "From Roster" },
  "addPlayer.newPlayer": { id: "Pemain Baru", en: "New Player" },
  "addPlayer.searchRoster": { id: "Cari nama pemain…", en: "Search player name…" },
  "addPlayer.rosterEmpty": {
    id: "Semua pemain roster sudah ditambahkan, atau roster masih kosong.",
    en: "All roster players are already added, or the roster is empty.",
  },
  "addPlayer.noMatch": { id: "Tidak ada yang cocok.", en: "No matches." },
  "addPlayer.sessionsPlayed": { id: "{n}x mabar", en: "{n} sessions" },
  "addPlayer.adding": { id: "Menambahkan…", en: "Adding…" },
  "addPlayer.addN": { id: "Tambah {n} pemain", en: "Add {n} players" },
  "addPlayer.pickFirst": { id: "Pilih pemain dulu", en: "Select players first" },
  "addPlayer.deleteAria": { id: "Hapus {name} dari roster", en: "Remove {name} from roster" },
  "addPlayer.deleteTitle": {
    id: "Hapus {name} dari roster?",
    en: "Remove {name} from roster?",
  },
  "addPlayer.deleteBody": {
    id: "Pemain ini akan dihapus permanen dari roster (daftar pemain tersimpan). Riwayat mabar yang sudah lewat tetap aman. Tindakan ini tidak bisa dibatalkan.",
    en: "This player will be permanently removed from the roster (saved player list). Past session history stays safe. This cannot be undone.",
  },
  "addPlayer.deleting": { id: "Menghapus…", en: "Deleting…" },
  "addPlayer.playerName": { id: "Nama pemain", en: "Player name" },
  "addPlayer.dupName": { id: "Nama ini sudah ada di sesi.", en: "This name already exists in the session." },
  "addPlayer.levelHint": {
    id: "Level (Dapat diganti kapan aja)",
    en: "Level (Can be changed anytime)",
  },
  "addPlayer.genderHint": {
    id: "Gender (Dapat diganti kapan aja)",
    en: "Gender (Can be changed anytime)",
  },
  "addPlayer.submit": { id: "Tambah pemain", en: "Add player" },

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
  "result.tabResult": { id: "Hasil", en: "Result" },
  "result.tabHistory": { id: "History", en: "History" },

  // ==========================================================================
  // LANDING PAGE
  // ==========================================================================
  // Navbar
  "landing.nav.how": { id: "Cara Kerja", en: "How It Works" },
  "landing.nav.features": { id: "Fitur", en: "Features" },
  "landing.nav.feedback": { id: "Masukan", en: "Feedback" },
  "landing.nav.openApp": { id: "Buka Aplikasi", en: "Open App" },
  "landing.langToggle": { id: "EN", en: "ID" },

  // Hero
  "landing.hero.badge": { id: "Matchmaking adil untuk mabar badminton", en: "Fair matchmaking for badminton sessions" },
  "landing.hero.title": {
    id: "Atur mabar. Bagi lapangan. Adil.",
    en: "Run sessions. Split courts. Fairly.",
  },
  "landing.hero.subtitle": {
    id: "TangkasBoard menyusun tim, mencatat skor, dan menentukan juara secara otomatis — biar kamu tinggal main.",
    en: "TangkasBoard builds teams, records scores, and crowns the champion automatically — so you can just play.",
  },
  "landing.hero.ctaPrimary": { id: "Mulai", en: "Get started" },
  "landing.hero.ctaSecondary": { id: "Lihat cara kerja", en: "See how it works" },
  "landing.hero.note": { id: "Bisa dipasang di HP · Dipakai langsung di GOR", en: "Installs on your phone · Built for the court" },

  // What is it
  "landing.what.title": { id: "Apa itu TangkasBoard?", en: "What is TangkasBoard?" },
  "landing.what.body": {
    id: "Aplikasi manajemen sesi main bareng (mabar) badminton ganda untuk host komunitas. Bagi pemain ke lapangan dengan adil berdasarkan level & jatah main, catat skor per set (1 set, best of 2, atau best of 3), dan lihat leaderboard langsung sampai penentuan juara.",
    en: "A session manager for community badminton doubles hosts. Split players onto courts fairly based on level & play turns, record scores per set (single, best of 2, or best of 3), and watch a live leaderboard through to the champion.",
  },

  // How it works
  "landing.how.title": { id: "Cara Kerjanya", en: "How It Works" },
  "landing.how.subtitle": {
    id: "Lima langkah sederhana dari daftar pemain sampai juara.",
    en: "Five simple steps from player list to champion.",
  },
  "landing.how.step1.title": { id: "Buat mabar & daftar pemain", en: "Create a session & add players" },
  "landing.how.step1.body": {
    id: "Bikin sesi mabar, tentukan jumlah lapangan, lalu daftarkan pemain dari roster atau tambah pemain baru.",
    en: "Create a session, set the number of courts, then add players from your roster or create new ones.",
  },
  "landing.how.step2.title": { id: "Smart Matchmaking", en: "Smart Matchmaking" },
  "landing.how.step2.body": {
    id: "Satu tap menyusun tim seimbang: mempertimbangkan level, jatah main, waktu tunggu, dan menghindari lawan yang itu-itu terus.",
    en: "One tap builds balanced teams: considering level, play turns, waiting time, and avoiding repeat opponents.",
  },
  "landing.how.step3.title": { id: "Catat skor per set", en: "Record scores per set" },
  "landing.how.step3.body": {
    id: "Isi skor tiap set selesai. Untuk best of 2/3, match lanjut ke set berikutnya sampai pemenangnya jelas. Leaderboard update otomatis di semua perangkat.",
    en: "Enter each set's score as it finishes. For best of 2/3, the match continues to the next set until a winner emerges. The leaderboard updates instantly across all devices.",
  },
  "landing.how.step4.title": { id: "Tentukan juara", en: "Crown the champion" },
  "landing.how.step4.body": {
    id: "Akhiri mabar untuk melihat podium juara & ranking lengkap, lalu bagikan hasilnya ke grup.",
    en: "End the session to see the champion podium & full ranking, then share the result to your group.",
  },

  // Features
  "landing.features.title": { id: "Fitur Unggulan", en: "Key Features" },
  "landing.features.matchmaking.title": { id: "Matchmaking Adil", en: "Fair Matchmaking" },
  "landing.features.matchmaking.body": {
    id: "Algoritma menyeimbangkan level tim & meratakan jatah main tanpa melanggar aturan pasangan.",
    en: "The algorithm balances team levels & evens out play turns without breaking pairing rules.",
  },
  "landing.features.level.title": { id: "Level Dinamis", en: "Dynamic Levels" },
  "landing.features.level.body": {
    id: "Atur level pemain lewat observasi. Level tersimpan permanen untuk mabar berikutnya.",
    en: "Set player levels by observation. Levels are saved permanently for future sessions.",
  },
  "landing.features.multicourt.title": { id: "Multi-Lapangan", en: "Multi-Court" },
  "landing.features.multicourt.body": {
    id: "Kelola banyak lapangan sekaligus, tiap lapangan berjalan independen dengan rotasi lintas lapangan.",
    en: "Manage many courts at once, each running independently with cross-court rotation.",
  },
  "landing.features.livescore.title": { id: "Livescore Realtime", en: "Realtime Livescore" },
  "landing.features.livescore.body": {
    id: "Leaderboard & skor per set update otomatis di semua perangkat yang membuka sesi yang sama.",
    en: "The leaderboard & per-set scores update automatically on every device viewing the same session.",
  },
  "landing.features.sets.title": { id: "Format Set Fleksibel", en: "Flexible Set Format" },
  "landing.features.sets.body": {
    id: "Pilih 1 set, best of 2, atau best of 3 tiap mabar. Skor diisi per set; pemenang dari mayoritas set, seri pun tercatat.",
    en: "Choose single set, best of 2, or best of 3 per session. Scores are entered per set; winner by set majority, and draws are recorded too.",
  },
  "landing.features.modes.title": { id: "Mode Match Beragam", en: "Varied Match Modes" },
  "landing.features.modes.body": {
    id: "Seimbang, Campuran, Ganda Putri, Gendongan, atau Sesuai Kelas — pilih sesuai suasana.",
    en: "Balanced, Mixed, Ladies, Carry, or By Class — pick to suit the vibe.",
  },
  "landing.features.pwa.title": { id: "PWA Mobile-First", en: "Mobile-First PWA" },
  "landing.features.pwa.body": {
    id: "Pasang di layar utama HP seperti aplikasi biasa. Ringan & cepat.",
    en: "Install it to your phone's home screen like a native app. Light & fast.",
  },

  // Feedback section
  "landing.feedback.title": { id: "Masukan & Temuan", en: "Feedback & Findings" },
  "landing.feedback.subtitle": {
    id: "Punya ide, kritik, atau nemu bug? Kabari kami — masukan kamu bantu TangkasBoard makin baik.",
    en: "Got an idea, critique, or found a bug? Let us know — your feedback helps TangkasBoard improve.",
  },
  "landing.feedback.messageLabel": { id: "Pesan", en: "Message" },
  "landing.feedback.messagePlaceholder": {
    id: "Tulis masukan, ide, atau temuan kamu di sini…",
    en: "Write your feedback, idea, or finding here…",
  },
  "landing.feedback.contactLabel": { id: "Kontak (opsional)", en: "Contact (optional)" },
  "landing.feedback.contactPlaceholder": {
    id: "Email / WhatsApp — jika ingin kami balas",
    en: "Email / WhatsApp — if you'd like a reply",
  },
  "landing.feedback.submit": { id: "Kirim Masukan", en: "Send Feedback" },
  "landing.feedback.sending": { id: "Mengirim…", en: "Sending…" },
  "landing.feedback.success": {
    id: "Terima kasih! Masukan kamu sudah terkirim. 🙏",
    en: "Thank you! Your feedback has been sent. 🙏",
  },
  "landing.feedback.error": {
    id: "Gagal mengirim. Coba lagi sebentar lagi.",
    en: "Failed to send. Please try again shortly.",
  },
  "landing.feedback.emptyError": { id: "Pesan tidak boleh kosong.", en: "Message can't be empty." },

  // Footer
  "landing.footer.tagline": {
    id: "Manajemen mabar badminton yang adil & menyenangkan.",
    en: "Fair & fun badminton session management.",
  },
  "landing.footer.openApp": { id: "Buka Aplikasi", en: "Open App" },
  "landing.footer.rights": { id: "Dibuat untuk komunitas badminton.", en: "Made for badminton communities." },

  // Langkah baru #1: daftar akun & buat komunitas (register + create community)
  "landing.how.step0.title": { id: "Daftar & buat komunitas", en: "Sign up & create a community" },
  "landing.how.step0.body": {
    id: "Bikin akun host, lalu buat komunitas badminton kamu. Semua mabar & pemain bernaung di sana.",
    en: "Create a host account, then set up your badminton community. All sessions & players live under it.",
  },

  // Fitur PWA di-reframe dari sudut pandang user (bukan jargon "PWA")
  "landing.features.install.title": { id: "Pasang di HP, siap di lapangan", en: "Install on your phone, ready on-court" },
  "landing.features.install.body": {
    id: "Tambahkan ke layar utama seperti aplikasi biasa. Ringan, cepat, dan tetap responsif saat sinyal GOR pas-pasan.",
    en: "Add it to your home screen like a native app. Light, fast, and responsive even on shaky venue signal.",
  },

  // Chip stat pada kartu featured matchmaking
  "landing.features.chipLevel": { id: "Seimbang per level", en: "Balanced by level" },
  "landing.features.chipTurns": { id: "Jatah main merata", en: "Even play turns" },
  "landing.features.chipRepeat": { id: "Anti lawan berulang", en: "No repeat opponents" },

  // ── FAQ ──
  "landing.nav.faq": { id: "FAQ", en: "FAQ" },
  "landing.faq.title": { id: "Pertanyaan yang sering muncul", en: "Frequently asked questions" },
  "landing.faq.subtitle": {
    id: "Hal-hal yang biasa ditanyakan host sebelum mulai.",
    en: "What hosts usually ask before getting started.",
  },
  "landing.faq.q1": { id: "Perlu install aplikasi?", en: "Do I need to install an app?" },
  "landing.faq.a1": {
    id: "Tidak wajib. TangkasBoard jalan langsung di browser, tapi bisa dipasang ke layar utama HP (PWA) agar terbuka seperti aplikasi biasa saat di GOR.",
    en: "Not required. TangkasBoard runs right in the browser, but you can install it to your phone's home screen (PWA) so it opens like a native app at the court.",
  },
  "landing.faq.q2": { id: "Apakah mendukung tunggal (single)?", en: "Does it support singles?" },
  "landing.faq.a2": {
    id: "Belum. Untuk saat ini TangkasBoard fokus pada ganda (2 lawan 2), format paling umum di mabar komunitas. Dukungan tunggal sedang kami pertimbangkan.",
    en: "Not yet. For now TangkasBoard focuses on doubles (2v2), the most common format in community sessions. Singles support is on our radar.",
  },
  "landing.faq.q3": { id: "Berapa set per match yang bisa dicatat?", en: "How many sets per match can I record?" },
  "landing.faq.a3": {
    id: "Bebas pilih saat bikin mabar: 1 set, best of 2, atau best of 3. Skor diisi per set begitu set selesai; pemenang match ditentukan dari mayoritas set menang, dan skor imbang tercatat sebagai seri.",
    en: "Your choice when you create a session: single set, best of 2, or best of 3. Scores are entered per set as each one finishes; the match winner is decided by set majority, and a tied result is recorded as a draw.",
  },
  "landing.faq.q4": { id: "Bagaimana matchmaking menjaga keadilan?", en: "How does matchmaking stay fair?" },
  "landing.faq.a4": {
    id: "Sistem menyeimbangkan level tim, mendahulukan pemain dengan jatah main paling sedikit, mempertimbangkan waktu tunggu, dan menghindari pasangan/lawan yang berulang.",
    en: "The system balances team levels, prioritizes players with the fewest games, weighs waiting time, and avoids repeat partners and opponents.",
  },
  "landing.faq.q5": { id: "Bisakah beberapa host mengelola satu komunitas?", en: "Can several hosts manage one community?" },
  "landing.faq.a5": {
    id: "Bisa. Pemilik komunitas dapat mengundang host lain sebagai admin lewat email untuk mengelola komunitas bersama.",
    en: "Yes. A community owner can invite other hosts as admins via email to manage the community together.",
  },

  // ==========================================================================
  // AUTH & MULTI-TENANT (Phase 2)
  // ==========================================================================
  // Auth — login/register
  "auth.login": { id: "Masuk", en: "Sign in" },
  "auth.register": { id: "Daftar", en: "Sign up" },
  "auth.email": { id: "Email", en: "Email" },
  "auth.password": { id: "Kata sandi", en: "Password" },
  "auth.loginGoogle": { id: "Masuk dengan Google", en: "Sign in with Google" },
  "auth.registerGoogle": { id: "Daftar dengan Google", en: "Sign up with Google" },
  "auth.toRegister": { id: "Belum punya akun? Daftar", en: "No account? Sign up" },
  "auth.toLogin": { id: "Sudah punya akun? Masuk", en: "Have an account? Sign in" },
  "auth.invalidCredentials": { id: "Email atau kata sandi salah.", en: "Invalid email or password." },
  "auth.genericError": { id: "Terjadi kesalahan. Coba lagi.", en: "Something went wrong. Please try again." },
  "auth.rateLimited": { id: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.", en: "Too many attempts. Please wait a moment and try again." },
  "auth.signOut": { id: "Keluar", en: "Sign out" },
  "auth.signingIn": { id: "Memproses…", en: "Signing in…" },

  // Onboarding
  "onboarding.title": { id: "Buat komunitas pertamamu", en: "Create your first community" },
  "onboarding.communityName": { id: "Nama komunitas", en: "Community name" },
  "onboarding.namePlaceholder": { id: "mis. Mabar Jumat Malam", en: "e.g. Friday Night Badminton" },
  "onboarding.create": { id: "Buat komunitas", en: "Create community" },
  "onboarding.creating": { id: "Membuat…", en: "Creating…" },

  // Community switcher
  "community.switch": { id: "Ganti komunitas", en: "Switch community" },
  "community.active": { id: "Komunitas aktif", en: "Active community" },

  // Kelola admin
  "admin.manage": { id: "Kelola admin", en: "Manage admins" },
  "admin.inviteEmail": { id: "Email admin yang diundang", en: "Invited admin email" },
  "admin.sendInvite": { id: "Kirim undangan", en: "Send invite" },
  "admin.generateLink": { id: "Buat link", en: "Generate link" },
  "admin.inviteEmailBoundHint": { id: "Link hanya bisa dipakai oleh email ini.", en: "The link only works for this email." },
  "admin.inviteSent": { id: "Undangan terkirim.", en: "Invite sent." },
  "admin.inviteLink": { id: "Link undangan (bagikan manual)", en: "Invite link (share manually)" },
  "admin.copyLink": { id: "Salin link", en: "Copy link" },
  "admin.linkCopied": { id: "Link tersalin.", en: "Link copied." },
  "admin.inviteLinkHint": { id: "Bagikan link ini ke calon admin (mis. lewat WhatsApp). Email undangan juga terkirim otomatis bila domain sudah diverifikasi.", en: "Share this link with the prospective admin (e.g. via WhatsApp). An invite email is also sent automatically once your domain is verified." },
  "admin.members": { id: "Anggota", en: "Members" },
  "admin.kick": { id: "Keluarkan", en: "Remove" },
  "admin.ownerBadge": { id: "Pemilik", en: "Owner" },
  "admin.adminBadge": { id: "Admin", en: "Admin" },
  "admin.deleteCommunity": { id: "Hapus komunitas", en: "Delete community" },
  "admin.deleteConfirm": { id: "Hapus komunitas ini beserta semua datanya?", en: "Delete this community and all its data?" },

  // Invite (redeem)
  "invite.expired": { id: "Undangan sudah kedaluwarsa.", en: "This invite has expired." },
  "invite.used": { id: "Undangan sudah dipakai.", en: "This invite has already been used." },
  "invite.invalid": { id: "Undangan tidak valid.", en: "Invalid invite." },
  "invite.accepted": { id: "Kamu kini admin komunitas ini.", en: "You are now an admin of this community." },
  "invite.emailMismatch": { id: "Undangan ini ditujukan untuk email lain. Masuk dengan email yang diundang.", en: "This invite is for a different email. Sign in with the invited email." },
  "invite.accepting": { id: "Memproses undangan…", en: "Processing invite…" },
  "invite.acceptedGoApp": { id: "Undangan diterima. Membuka aplikasi…", en: "Invite accepted. Opening app…" },
  "invite.title": { id: "Terima undangan", en: "Accept invite" },
  "invite.needLogin": { id: "Masuk atau daftar untuk menerima undangan.", en: "Sign in or sign up to accept the invite." },
} as const;

export type DictKey = keyof typeof DICT;
