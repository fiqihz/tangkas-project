# TangkasBoard — Design & Agreement Document

Dokumen acuan resmi untuk aplikasi **TangkasBoard**. Merefleksikan kondisi
implementasi terkini (Batch A–F selesai, plus preview terkunci yang bisa
diedit & toleransi keseimbangan Advanced). **Batch G (gender + mode match
dipilih host saat Auto-fill) sudah diimplementasi** di branch
`batch-g-gender-mode` (lihat §16) — detail rancangan di
`.kiro/steering/batch-g-gender-rotation.md`.

**Go-Public Fase 1 (Landing Page + Feedback) sudah diimplementasi** di branch
`feat/landing-feedback` (lihat §17). Aplikasi inti kini berada di route `/app`;
route `/` menjadi landing page publik. **Go-Public Fase 2 (Auth + Multi-Tenant)
sudah diimplementasi & di-merge ke `main`** (lihat §18) — Supabase Auth
(Email/Password + Google), model tenant multi-komunitas (`membership`/`invite`),
role `owner`/`admin`, invite admin email-bound, dan RLS ketat per-community. Spec
lengkap di `.kiro/specs/phase-2-auth-multitenant/`.

**Enhancement Multi-Set (Best of 1/2/3) sudah diimplementasi & di-push ke `main`**
(lihat §20) — host memilih format set saat membuat mabar, skor diisi **per set**,
pemenang match ditentukan mayoritas set, dan skor imbang tercatat sebagai **seri**.

**Enhancement Scoring Adil per-Set sudah diimplementasi & di-push ke `main`**
(lihat §21) — poin & selisih (Diff) di leaderboard kini dihitung sebagai
**rata-rata per set**, bukan total mentah, agar match 2-set dan 3-set setara
skalanya. Bonus **+M** ikut disesuaikan ke rata-rata poin-per-set liga. Murni
**display-layer** (data per-set di DB tidak berubah).

---

## 1. Tujuan

Aplikasi manajemen sesi mabar (main bareng) badminton ganda (2v2) untuk host:

1. **Matchmaking adil** — bagi pemain ke lapangan dengan mempertimbangkan level & pemerataan jatah main.
2. **Scoring & leaderboard** — catat skor **per set** (1 set / best of 2 / best of 3), akumulasi menang/kalah/seri + poin, tentukan juara (hadiah voucher).
3. **Level dinamis** — level pemain ditentukan host lewat observasi; match berikutnya menyesuaikan.
4. **Manajemen multi-sesi** — daftar mabar (terjadwal/berjalan/selesai), history, edit skor.

Bentuk: **PWA** mobile-first, di-hosting gratis.

---

## 2. Keputusan Final (Locked)

| Topik | Keputusan |
|---|---|
| Nama project | **TangkasBoard** |
| Bentuk | PWA, mobile-first (Next.js App Router + TypeScript) |
| Styling | Tailwind CSS v3 + komponen ala shadcn + framer-motion + vaul (bottom sheet) |
| Data store | **Full Supabase** (roster permanen + data sesi) |
| Hosting | Vercel free tier, auto-deploy dari GitHub |
| Level system | **Full manual** (host set/edit). **Tidak ada Elo / promosi otomatis.** |
| Akses (sekarang) | **Opsi C — Supabase Auth (Email/Password + Google) + multi-komunitas + role `owner`/`admin`** (PasswordGate Opsi B sudah di-retire, lihat §18) |
| Akses (masa depan) | Role `member` **read-only** menyusul (skema sudah disiapkan, jalur masuk non-invite di luar scope Fase 2) |
| Match pertama | **Selalu manual** (first come first play) |
| Routing | **`/` = landing page publik**, **`/app` = aplikasi inti** (di balik **route guard berbasis sesi Supabase**: redirect ke `/login` bila belum auth, `/onboarding` bila belum punya community — bukan lagi password gate) |
| Landing | Mobile-first responsive, dwibahasa (ID/EN), tema light/dark bersama app |
| Font | **Space Grotesk** (display) + **Inter** (body) via `next/font` |

---

## 3. Model Level & Bobot

- 4 level: **Newbie, Beginner, Intermediate, Advanced**
- Bobot: **Newbie=1, Beginner=2, Intermediate=3, Advanced=4**
- Level di-set manual oleh host, bisa diedit kapan saja (termasuk dari popup pemain di lapangan).
- Level tersimpan permanen di **roster** (`player_profile`) → tidak perlu observasi ulang di mabar berikutnya.
- **Gender** (`male` | `female` | `null`): di-set manual (opsional, bisa `null` bila belum ketahuan saat daftar). Dipakai untuk mode match Campuran & Ganda Putri (lihat §16). Tersimpan di roster & session_player, mirip level.

### Hard rule (berlaku di semua matchmaking)
- **Newbie TIDAK boleh setim dengan Newbie**, dan tidak boleh format Newbie/Newbie vs Newbie/Newbie.
- Beginner/Intermediate/Advanced boleh sesama level maupun di-mix.
- Target tiap match: selisih total bobot antar 2 tim se-minimal mungkin.

---

## 4. Status Pemain

| Status | Arti |
|---|---|
| **Registered** | Sudah didaftarkan (mis. pra-daftar sebelum hari H), belum check-in. Tidak diperhitungkan matchmaking. |
| **Active** | Sudah check-in & siap main. Hanya status ini yang masuk pool matchmaking. |
| **Resting** | Istirahat sementara, belum pulang. |
| **Left** | Pulang / batal. Keluar permanen dari sesi; skor yang sudah tercatat tetap aman. |

Syarat masuk **auto-generate** = **Active DAN sudah punya level**.
Daftar pemain **Active** diurutkan berdasarkan **waktu check-in** (`checked_in_at`) — first come first play.

---

## 5. Matchmaking — Prioritas

1. **Hard rule**: no Newbie+Newbie.
2. Dahulukan pemain dengan **jatah main paling sedikit** (`gamesPlayed` terendah).
3. Dahulukan yang **paling lama menunggu**.
4. Hindari pemain yang **baru selesai main** (penalti, biar sempat istirahat).
5. Minimalkan **selisih bobot** antar tim (fairness), dengan **toleransi ≤2** (lihat §6).
6. Minimalkan **pengulangan** partner & lawan (anti "ketemu itu-itu terus").

Faktor digabung jadi skor berbobot (config di `src/lib/domain/types.ts` → `DEFAULT_CONFIG`).
**Fairness level > mengejar jatah main**: sistem tidak melanggar hard rule hanya demi meratakan jatah main.

---

## 6. State Machine Match

Status match: **proposed** (belum mulai) → **playing** (berjalan) → **finished** (selesai) / **unfinished** (dibatalkan saat berjalan).

- **Match pertama tiap lapangan**: host **Isi manual** (first come first play). Tidak ada tombol auto-fill.
- Alur: isi manual → match **proposed** → tap **Mulai Main** → **playing**.
- **Preview terkunci via tombol Auto-fill (manual)**: preview **tidak** di-generate otomatis saat Mulai Main/Finish. Host menekan tombol **Auto-fill** (per lapangan) untuk menyusun preview `proposed` berikutnya. Ini disengaja: dengan menyusun setelah semua lapangan ongoing, pool pemain menunggu lebih penuh → rotasi bisa mencampur pemain lintas lapangan (bukan itu-itu saja). Preview yang sudah disusun **terkunci** (tidak geser) dan **saling eksklusif** antar lapangan.
- **Tombol per lapangan (saat playing)**: **Auto-fill** (kiri, biru — disabled bila preview sudah ada) + **Finish & Skor** (kanan, oranye).
- **Aksi preview**: tap pemain di preview terkunci → buka popup aksi yang **sama seperti pemain yang sedang main** (Set Level / Istirahatkan / Ganti-tukar). Istirahatkan pemain preview → jadi `resting` + slot diisi pengganti otomatis. Ganti/tukar → pilih pemain menunggu, **tukar posisi di preview yang sama** (antar 4 pemain preview itu), atau swap dengan pemain di preview lapangan lain (tetap eksklusif).
- **Pesan gagal Auto-fill**: tampil sebagai **toast** mengambang di atas bottom-nav (auto-dismiss), dengan alasan informatif (jumlah pemain siap, berapa belum check-in, berapa belum ber-level).
- **Info statistik**: header popup pemain & tiap kandidat pengganti menampilkan **M:x K:x** (menang/kalah) + jumlah main.
- **Warning preview**: bila pemain di preview sudah `resting`/`left`, muncul peringatan agar diganti sebelum match mulai.
- **Finish & Input Skor** (hanya saat playing) → skor tercatat. Preview `proposed` yang sudah terkunci otomatis "naik" jadi match berikutnya. Preview baru **tidak** dibuat otomatis — host menekan Auto-fill lagi.
- Tiap lapangan berjalan independen; **"Match ke-N" dihitung per lapangan**.
- Warna tombol: **Mulai Main** = biru (info), **Finish** = oranye (warning).

### Matchmaking — toleransi keseimbangan
- Selisih bobot antar tim **≤2 dianggap seimbang** (tidak dihukum), agar level tinggi (mis. Advanced) bisa lawan sesama kelas, tidak selalu digendong. Selisih ≥3 tetap dihindari. Config: `imbalanceTolerance` di `DEFAULT_CONFIG`.

### Hapus lapangan saat ada match
- Match **proposed** → dibatalkan (dihapus), pemain kembali `active`.
- Match **playing** → ditandai **unfinished** (masuk history tanpa skor), pemain kembali `active`.

### Jumlah & nama lapangan
- Jumlah lapangan dinamis (tambah via FAB, hapus per kartu — hapus butuh handling di atas).
- **Nama lapangan kustom**: di-set saat membuat sesi & bisa diedit dari kartu lapangan (mis. Lapangan 14, 17, 21).

---

## 7. Popup Pemain di Lapangan (tap pemain di kartu)

Bottom sheet dengan konfirmasi eksplisit (aman dari accidental touch):

1. **Set Level** (selector, selalu tersedia — untuk observasi cepat).
2. **Istirahatkan (pengganti otomatis)** → pemain jadi `resting`, sistem cari pengganti.
3. **Istirahatkan — pilih pengganti** → pemain jadi `resting`, host pilih manual.
4. **Ganti / tukar pemain** (selalu tersedia) → pemain kembali ke antrian (`active`). Pilih pengganti:
   - **Replace** dengan pemain menunggu, atau
   - **Swap posisi di lapangan ini** (tukar antar 4 pemain di match yang sama, mis. lawan jadi partner), atau
   - **Swap dengan pemain yang sedang main di lapangan lain** (dua match ter-update).
   - Section: **⭐ Disarankan** + **Semua tersedia** (search) + **Tukar posisi di lapangan ini** + **Tukar dengan yang sedang main (lapangan lain)**.
5. **Batal**.

Semua penggantian tetap patuh hard rule (Newbie+Newbie ditolak).

---

## 8. Skenario Kehadiran

- **No-show**: tetap `Registered`, tidak ikut matchmaking.
- **Datang telat**: begitu check-in `Active`, `gamesPlayed` rendah → otomatis diprioritaskan sampai jatah menyusul (tanpa melanggar hard rule).
- **Rest**: via popup pemain (lihat §7).
- **Pulang**: set `Left` dari tab Pemain; skor tetap tercatat.

---

## 9. Scoring & Leaderboard

- **Format set dipilih host per mabar**: 1 set / best of 2 / best of 3 (`session.sets_target`). Detail multi-set di §20.
- Poin per set fleksibel (mis. 21/30) — **tidak ada validasi maksimal poin**; satu set individual tidak boleh imbang (harus ada pemenang).
- Dicatat per set (tabel `match_set`). **Pemenang match** = mayoritas set menang; set imbang total → **seri** (`draw`). Ganda → 1 hasil match (menang/kalah/seri) berlaku untuk **2 pemain** tim.
- **Poin pemain = RATA-RATA poin per set** (total poin tim di sebuah match dibagi jumlah set match itu, lalu dijumlah antar match) — lihat §21. Ini menggantikan skema total-mentah agar match 2-set & 3-set setara skalanya. Selisih (Diff) juga dinormalisasi per set. Satu match tetap = **satu** W/L/S (bukan per set). Data mentah tetap disimpan sebagai total di `points_scored`/`points_conceded` + per-set di `match_set`; normalisasi dilakukan di **display-layer** (`buildLeaderboard`).
- **Bonus poin tertinggal (+M)**: pemain yang jatah mainnya kurang dari yang terbanyak main dapat bonus = **rata-rata poin-per-set liga × selisih match** (dihitung on-the-fly, tidak dipersist; fallback 21 bila belum ada match selesai). Menggantikan flat 25 lama agar satuannya nyambung dengan poin ternormalisasi. Bonus **menambah kolom Poin** (bukan Diff).
- **Kolom leaderboard**: `#`, Pemain, **M** (menang), **K** (kalah), **S** (seri), **WR** (win rate = menang/main×100), **+M** (bonus tertinggal), **Diff** (selisih poin ternormalisasi per set), **Poin** (poin ternormalisasi + bonus).
- **Tampilan dibulatkan, sorting pakai desimal**: kolom Poin/Diff/+M ditampilkan sebagai bilangan bulat, tetapi urutan ranking memakai nilai desimal penuh agar beda tipis tidak jadi seri palsu.
- **Livescore**: leaderboard **&** skor per set update otomatis tiap set/Finish (tab Skor).
- **Tie-break ranking**: (1) total Poin (ternormalisasi + bonus) → (2) selisih poin ternormalisasi → (3) nama. Jumlah menang **tidak** dipakai sebagai penentu urutan.

### SELESAI MABAR
- Konfirmasi → counter "ikut mabar" (`sessions_played`) +1 untuk pemain yang **benar-benar main** (`gamesPlayed > 0`) → sesi jadi `finished`.
- Muncul halaman **Hasil Akhir** (podium juara 2-1-3 + ranking lengkap) → tombol **Mulai Mabar Baru** kembali ke daftar mabar.

---

## 10. Multi-Sesi (Daftar Mabar)

- **Status sesi**: `scheduled` → `ongoing` (maksimal **1** dalam satu waktu) → `finished`. `finished` bisa **di-reactivate** → `ongoing`.
- **Main page = daftar mabar**, dikelompokkan per status. Tiap kartu: buka / mulai / lihat hasil / aktifkan-lagi / hapus (hapus butuh konfirmasi).
- **Membuat mabar** (FAB + Mabar): nama, jadwal (opsional → scheduled), jumlah & nama lapangan. "Mulai Sekarang" (ongoing) atau "Simpan sebagai Jadwal" (scheduled).
- **Scheduled**: boleh pra-daftar pemain (status `registered`) sebelum hari-H.
- **Sesi finished dibuka** → tampil **read-only** (leaderboard final). Untuk mengedit harus **Aktifkan lagi** dulu.
- **Reactivate** meng-**undo** counter "ikut mabar" agar tidak dobel saat SELESAI MABAR lagi.
- **Navigasi**: daftar mabar → buka sesi → board; tombol back di header board kembali ke daftar.

---

## 11. History & Edit Skor

- Tab **History**: semua match yang sudah berlalu (`finished` & `unfinished`), dikelompokkan **per lapangan**.
- Match menyimpan **snapshot nama lapangan** (`court_label`) → history tetap menampilkan nama walau lapangan dihapus.
- **Tampilan skor**: match multi-set menampilkan **skor per set** (mis. `21-15, 18-21, 21-19`), bukan total agregat (total gabungan tak lazim di badminton). Match seri diberi badge **Seri**. Match lama / Best of 1 tanpa baris set fallback ke skor tunggal.
- **Edit skor** match `finished`: dialog mengedit **skor per set**; agregat & statistik pemain **dihitung ulang** di DB (RPC `edit_match_sets_atomic` — recompute agregat + selisih delta W/L/S & poin) agar leaderboard konsisten. Match `unfinished` tidak bisa diedit.

---

## 12. Arsitektur Data (Supabase)

Multi-tenant nyata (Opsi C aktif sejak Fase 2, lihat §18):

- **community** — tenant nyata per user. Bukan lagi "1 default digembok password":
  tiap user membuat community-nya sendiri saat onboarding dan menjadi `owner`.
  Data lama (`community_id = DEFAULT_COMMUNITY_ID`) diklaim ke community pertama
  yang dibuat user (lihat §18).
- **membership** — relasi user↔community: `user_id`, `community_id`,
  `role` (`owner`/`admin`/`member`), unik per pasangan user+community. Satu user
  bisa jadi anggota banyak community → community switcher.
- **invite** — undangan admin email-bound: `email`, `community_id`, `role` (admin),
  `token`, `status`, `expires_at`, `invited_by`. Token sekali pakai + expiry 7 hari.
- **player_profile** (roster, permanen) — nama + level + `sessions_played`. Tidak ter-reset antar mabar.
- **session** — status (scheduled/ongoing/finished), courts, current_round, scheduled_at, `track_shuttlecocks`, **`sets_target`** (1/2/3 — format set per match, default 1).
- **session_player** — state pemain per mabar: status, level, `checked_in_at`, games_played, last_played_round, available_since_round, wins/losses/draws, points_scored/conceded, `paid`, profile_id.
- **court** — lapangan (label, position).
- **match** — court_id, `court_label` (snapshot), round, 4 pemain, state, skor **agregat** (`score_a`/`score_b`/`winner` = total poin semua set + pemenang akhir), `shuttlecocks`.
- **match_set** — skor **per set** dari sebuah match: `match_id`, `set_no`, `score_a`, `score_b` (unik per `match_id`+`set_no`). Sumber detail set; agregat di `match` tetap dipakai konsumen lama (leaderboard, roster stats lintas-mabar). Lihat §20.

**RLS ketat per-community** menggantikan policy permisif anon `using(true)` lama.
Helper `is_member()` / `has_role()` (SECURITY DEFINER): tabel induk (`community`,
`player_profile`, `session`) mengecek `is_member(community_id)`; tabel anak
(`session_player`, `court`, `match`) mengecek via join ke `session.community_id`.
Write hanya untuk `authenticated`, dan operasi tulis `membership`/`invite`/pembuatan
community dilakukan lewat RPC SECURITY DEFINER. Realtime aktif di `match`,
`session_player`, `court`, `session`, `match_set`. `match_set` mengikuti pola RLS
permisif tabel data (allow-all untuk anon/authenticated) — konsisten dengan tabel
sesi lain.

Migrations (di `supabase/migrations/`): `001` sessions_played, `002` match state unfinished, `003` multi-status sesi, `004` match court_label, `005` checked_in_at, `006` gender (kolom `gender` di `player_profile` & `session_player`), `007` RPC atomik, `008` realtime filters, `009` match started_at, `010` **feedback** (tabel masukan landing + RLS anon insert-only), `011` **trigger notifikasi feedback** (via `net.http_post` → Edge Function, bypass UI Webhook), `012` **membership & invite** (enum `membership_role`/`invite_status`), `013` **RLS ketat + helper functions** (`is_member`/`has_role`), `014` **trigger `pg_net` → Edge Function `send-invite`**, `015` **RPC** (`create_community_with_owner`, `claim_legacy_data`, `redeem_invite`, `kick_member`), `016` **`redeem_invite` email-bound + `list_community_members_with_email`**, `017` **shuttlecock & paid** (`session.track_shuttlecocks`, `match.shuttlecocks`, `session_player.paid` + `finish_match_atomic` tambah `p_shuttlecocks`), `018` **multi-set** (`session.sets_target`, tabel `match_set`, RPC `finish_set_atomic` & `edit_match_sets_atomic`, realtime `match_set`), `019` **carry-over kok** (`finish_set_atomic` simpan `match.shuttlecocks` tiap set, bukan hanya saat final).

---

## 13. Halaman / Tab

- **Daftar Mabar** (main page): list sesi + buat/kelola.
- **Pemain**: tambah (dari roster searchable / pemain baru / **import daftar tempelan** — lihat §22), search, check-in, set level, rest/pulang. FAB + Pemain.
- **Lapangan**: kartu per lapangan (proposed/playing), Mulai Main / Finish, preview terkunci yang bisa diedit (tap pemain), popup aksi pemain, tambah/hapus/rename lapangan.
- **Skor**: livescore leaderboard.
- **History**: match per lapangan + edit skor.
- **Selesai**: SELESAI MABAR → Hasil Akhir (podium).

---

## 14. Logika Inti (`src/lib/domain/`, teruji)

- Bobot level & keseimbangan tim (`rules.ts`)
- Matchmaking (hard rule + skor berbobot + anti-repeat + penalti baru-main + **mode match**) (`matchmaking.ts`)
- Mode match & validasi matchup per mode (`isStrong`, `isValidMatchupForMode`) (`rules.ts`)
- Antrian jatah main (`queue.ts`)
- History anti-repeat partner/lawan (`history.ts`)
- Pengganti/substitusi (`substitute.ts`)
- Parsing daftar pemain tempelan + pencocokan nama ke roster (exact & fuzzy) (`import-players.ts`)
- Akumulasi skor, normalisasi poin/Diff **per set** (`perSetPlayerStats`), bonus tertinggal (basis rata-rata poin-per-set liga), win rate, tie-break (`leaderboard.ts` — lihat §21).
- Tes: `domain.test.ts`, `rotation.test.ts`, `modes.test.ts`, `import-players.test.ts`.

---

## 15. Roadmap

- **Go-Public Fase 1 (landing + feedback)** — ✅ **selesai** (lihat §17).
- **Go-Public Fase 2 = Opsi C** — ✅ **selesai & di-merge ke `main`** (lihat §18):
  Supabase Auth (Google + Email/Password) + multi-komunitas + role
  `owner`/`admin` + invite admin email-bound + RLS ketat + klaim data lama ke
  community pertama.
- **Enhancement UI/UX `/app`** — ✅ **selesai & di-merge ke `main`** (lihat §19).
  Menyelaraskan visual app dengan landing (token & font bersama), plus polish
  copy landing. Dikerjakan via Vibe; arah desain di
  `.kiro/steering/phase-2-auth-multitenant.md` §4 + `FE-SKILL.MD`.
- **Multi-Set (Best of 1/2/3)** — ✅ **selesai & di-push ke `main`** (lihat §20).
  Format set dipilih host per mabar, skor per set, pemenang mayoritas set, seri
  dicatat, copy landing diselaraskan.
- **Scoring Adil per-Set** — ✅ **selesai & di-push ke `main`** (lihat §21).
  Poin & Diff dinormalisasi ke rata-rata per set (2-set vs 3-set setara), bonus
  +M disesuaikan ke rata-rata poin-per-set liga, display dibulatkan dengan sort
  desimal. Display-layer, backward-compatible.
- **Import Daftar Pemain** — ✅ **selesai & di-push ke `main`** (lihat §22).
  Host menempel daftar peserta dari WhatsApp; sistem mencocokkan ke roster
  (persis & fuzzy), membuat pemain baru untuk yang belum ada, dan menandai Lunas
  dari centang ✅.
- **Dukungan tunggal (single)** — masih di roadmap (TangkasBoard fokus ganda 2v2).

---

## 16. Batch G — Gender + Mode Match (host pilih saat Auto-fill)

Status: **diimplementasi** di branch `batch-g-gender-mode` (belum merge ke `main`;
menunggu review host lewat Vercel preview). Berbeda dari rancangan awal
"rotasi per-ronde otomatis" (di steering doc): keputusan final adalah **host yang
memilih mode** saat menekan Auto-fill — bukan siklus otomatis per ronde. Alasan:
tiap lapangan berjalan independen (Batch A), jadi "ronde ke-N = mode X" otomatis
akan bentrok dan kaku.

### Gender
- Field `gender`: `male` | `female` | `null` (nullable — saat daftar pertama sering belum ketahuan).
- Di-set/-edit dari dialog **Tambah Pemain (Pemain Baru)** dan dari **popup aksi pemain** (section "Set gender").
- Badge gender kecil (♂/♀) tampil di list roster.
- Disinkron ke roster (`player_profile`) agar persisten lintas mabar.

### Alur pemilihan mode
Tap **Auto-fill** (per lapangan) → muncul **sheet pilih mode** (5 pilihan + penjelasan
singkat) → pilih mode → `generateLockedPreview(courtId, mode)` menyusun preview
`proposed`. Bila best-effort tidak terpenuhi, tampil **toast** alasan spesifik per mode.

### 5 Mode
| Mode | Value | Aturan |
|---|---|---|
| **Seimbang** | `balanced` | Default (existing). Minimalkan selisih bobot antar tim. |
| **Campuran** | `mixed` | Ganda campuran: tiap tim 1 cowok + 1 cewek (best-effort). |
| **Ganda Putri** | `ladies` | Semua pemain cewek. **Hard rule Newbie+Newbie dilonggarkan** (Opsi B) karena pool cewek bisa kecil. |
| **Gendongan** | `gendongan` | Tiap tim 1 kuat (Intermediate/Advanced) + 1 lemah (Newbie/Beginner), dua tim dibuat seimbang. |
| **Sesuai Kelas** | `kelas` | Pasangkan pemain dengan level sama. |

Catatan:
- Hanya Campuran + Ganda Putri untuk gender (Ganda Putra tidak dibuat — mayoritas pemain cowok).
- Untuk mode non-balanced, window kandidat pool diperlebar (14) agar lebih mudah menemukan komposisi yang cocok.
- Hard rule Newbie+Newbie **tetap** berlaku di semua mode **kecuali** Ganda Putri (relax).

### Implementasi teknis
- `types.ts`: tipe `Gender`, `MatchMode`; field `gender` di `PlayerProfile`/`SessionPlayer`.
- `rules.ts`: `isStrong`, `isValidMatchupForMode`.
- `matchmaking.ts`: `generateMatch(..., mode)` + scoring per mode.
- `session-store.ts`: `generateLockedPreview(courtId, mode)`, `setPlayerGender`, `addPlayer` terima gender.
- UI: `gender-select.tsx` (`GenderSelect`+`GenderBadge`), `ModePickerSheet` di `courts-screen.tsx`.
- DB: migration `006_gender.sql` — **harus dijalankan di Supabase sebelum tes gender**.

---

## 17. Go-Public Fase 1 — Landing Page + Feedback

Status: **diimplementasi** di branch `feat/landing-feedback` (belum merge ke
`main`). Langkah pertama membuka TangkasBoard untuk komunitas lain. Fase 2 (auth +
multi-tenant) menyusul — rencana di `.kiro/steering/phase-2-auth-multitenant.md`.

### Routing
- **`/`** → **Landing page publik** (marketing). Server-friendly, responsive
  desktop + mobile.
- **`/app`** → **Aplikasi inti** (board mabar), tetap di balik `PasswordGate`
  sementara sampai auth Fase 2. Layout tetap `max-w-md` mobile-native / PWA.

### Landing page (`src/components/landing/`)
- **Dwibahasa (ID/EN)** — semua wording di `src/lib/i18n/dict.ts` (prefix
  `landing.*`). Toggle bahasa di navbar, berbagi `localStorage` key `tb.lang`
  dengan app → pilihan konsisten saat masuk `/app`.
- **Tema light/dark** — menumpang sistem token `dark` + `settings-store` yang
  sama dengan app.
- **Section**: navbar → hero (SVG court diagram 2v2, satu orchestrated moment saat
  load) → "Apa itu" → **Cara Kerja (5 langkah, timeline ber-connector)** → Fitur
  (kartu featured matchmaking + grid) → **FAQ (accordion)** → Feedback → footer.
- **Cara Kerja 5 langkah**: (1) Daftar & buat komunitas, (2) buat mabar & daftar
  pemain, (3) Smart Matchmaking, (4) catat skor, (5) tentukan juara.
- **FAQ** memuat batasan yang sering ditanya: hanya **ganda** (single belum ada),
  skor **1 set** (2–3 set on roadmap), keadilan matchmaking, multi-host (Fase 2).
- **Desain** mengikuti `.claude/skills/anthropic-skills/FE-SKILL.MD`: sporty tapi
  minimalist, motif lapangan badminton, palet dark-first + aksen teal, keterbacaan
  diprioritaskan, menghindari "tell" AI-generated. Motion sekali & terarah,
  `prefers-reduced-motion` dihormati.
- **Logo**: `public/shuttlecock.png` (bukan emoji).

### Fondasi visual bersama (dipakai ulang saat enhance `/app`)
- Token warna `--accent` (teal) untuk light & dark di `globals.css`, mendampingi
  `--primary` (hijau shuttle).
- Font via `next/font`: **Space Grotesk** (`--font-display`) + **Inter**
  (`--font-sans`). Tailwind `fontFamily.display`/`.sans` map ke sana.

### Feedback
- Tabel **`feedback`** (`message`, `contact` opsional) — migration `010`. RLS:
  anon boleh **INSERT saja** (tidak bisa membaca masukan orang lain).
- Form di landing → `submitFeedback()` (`src/lib/supabase/repo.ts`). Boleh anonim.
- **Notifikasi email** ke host: trigger `AFTER INSERT` (migration `011`) memanggil
  Edge Function `notify-feedback` (`supabase/functions/`) via `net.http_post`
  (pg_net), lalu kirim email via **Resend**. Cara ini mem-bypass UI Database
  Webhook dashboard yang gagal karena schema `supabase_functions` tidak
  ter-provision di project. Secret (`RESEND_API_KEY`, `FEEDBACK_TO`,
  `FEEDBACK_FROM`) disimpan di Supabase secrets, tidak di kode.

### Catatan teknis
- `tsc` & eslint meng-exclude `supabase/functions/**` (runtime Deno, bukan Next).
- Asset landing di-serve dari `public/` (mis. `shuttlecock.png`).

---

## 18. Go-Public Fase 2 — Auth + Multi-Tenant

Status: **diimplementasi & sudah di-merge ke `main`** (branch
`feat/phase-2-auth-multitenant`). Langkah yang mengubah TangkasBoard dari satu
komunitas digembok password (Opsi B) menjadi platform multi-tenant nyata dengan
login (Opsi C). Spec lengkap (requirements/design/tasks) di
`.kiro/specs/phase-2-auth-multitenant/`.

### Autentikasi
- **Supabase Auth** — Email/Password + Google (OAuth).
- **PasswordGate lama di-retire**: `src/components/password-gate.tsx` &
  `src/lib/auth/gate.ts` **dihapus**.
- Supabase client `persistSession: true` (`client.ts`) → sesi bertahan antar reload.
- **Route guard `/app` berbasis sesi** (`src/components/auth/route-guard.tsx` +
  `guard-decision.ts`): belum auth → redirect `/login`; sudah auth tapi belum
  punya community → redirect `/onboarding`.
- **Email confirmation Supabase OFF** → register langsung punya sesi aktif.

### Model tenant
- Tabel **`membership`** (`user_id`, `community_id`, `role` `owner`/`admin`/`member`,
  unik per user+community) & **`invite`** (`email`, `community_id`, `role` admin,
  `token`, `status`, `expires_at`, `invited_by`).
- Satu user bisa berada di banyak community → **community switcher**
  (`src/components/app/community-switcher.tsx`).

### Role
- **`owner`** — pembuat community. Bisa hapus community & kelola admin. **Tidak
  bisa di-kick**.
- **`admin`** — view + edit data community.
- **`member`** — read-only. Sudah disiapkan di skema, tapi **belum ada jalur
  masuknya di Fase 2** (jalur non-invite di luar scope).

### Invite admin (email-bound)
- Owner **generate link undangan** — ditampilkan di dialog Kelola Admin untuk
  di-share manual (mis. via WhatsApp). Email otomatis **juga** terkirim via Edge
  Function bila domain Resend terverifikasi (lihat known limitations).
- Link → `/register?invite=TOKEN` atau `/invite?token=TOKEN`.
- **`redeem_invite` email-bound**: hanya bisa ditukar oleh user yang email
  login-nya **sama** dengan email di invite (`reason: email_mismatch` bila beda).
- Mendukung **user baru** (register via link) & **user existing** (sudah login →
  langsung jadi admin, auto-switch ke komunitas pengundang; komunitas lama user
  tetap utuh).
- Token **sekali pakai + expiry 7 hari**.

### Kelola admin (owner-only)
`src/components/app/manage-admins-dialog.tsx`:
- Generate link undangan.
- Daftar member — menampilkan **EMAIL** via RPC owner-only
  `list_community_members_with_email`.
- **Kick** member non-owner.
- **Hapus community**.

### RLS ketat per-community
Menggantikan policy permisif anon `using(true)` lama:
- Helper `is_member()` / `has_role()` **SECURITY DEFINER**.
- Tabel induk (`community`, `player_profile`, `session`) cek `is_member(community_id)`.
- Tabel anak (`session_player`, `court`, `match`) cek via join ke `session.community_id`.
- Write hanya `authenticated`. Operasi tulis `membership`/`invite`/pembuatan
  community lewat RPC SECURITY DEFINER.

### Migrasi data lama
Baris dengan `community_id = DEFAULT_COMMUNITY_ID`
(`00000000-0000-0000-0000-000000000001`) diklaim ke community **pertama** yang
dibuat user saat onboarding (RPC `create_community_with_owner` →
`claim_legacy_data`, **idempoten**).

### Halaman baru
- **`/login`**, **`/register`**, **`/onboarding`**, **`/auth/callback`**, **`/invite`**.
- Onboarding: user tanpa community → buat community (otomatis jadi `owner`).
- Tombol **logout** di Settings (juga bisa diakses dari header daftar mabar).
- Semua wording baru dwibahasa di `dict.ts`.

### Edge Function
- **`supabase/functions/send-invite`** (Resend, mengikuti pola `notify-feedback`).

### Testing
- **vitest + fast-check**. ~**84 test passed**.
- **Property tests**: redeem invite (expired/idempoten), klaim data (idempoten &
  preserve kolom), invite role admin-only, resolusi `active_community`.
- **Unit test**: form validation, `guard-decision`, invite-link.
- **Integration test DB**: auto-skip tanpa env.

### Migrations
- `012` membership & invite (enum `membership_role`/`invite_status`).
- `013` RLS ketat + helper functions (`is_member`/`has_role`).
- `014` trigger `pg_net` → Edge Function `send-invite`.
- `015` RPC (`create_community_with_owner`, `claim_legacy_data`, `redeem_invite`,
  `kick_member`).
- `016` `redeem_invite` email-bound + `list_community_members_with_email`.

### Known limitations
- **Email invite ke pihak ketiga butuh verifikasi domain Resend** (belum
  dilakukan). Sementara memakai `onboarding@resend.dev` yang hanya bisa mengirim
  ke email pemilik akun → untuk sekarang share link undangan manual.
- **Auth email confirmation Supabase OFF** (register langsung punya sesi).
- Halaman **`/invite`** untuk user yang sudah login kadang perlu **refresh
  manual** (known minor issue).

Rujukan spec: `.kiro/specs/phase-2-auth-multitenant/`
(requirements / design / tasks).

---

## 19. Enhancement Visual `/app` + Polish Landing

Status: **diimplementasi & di-merge ke `main`** (branch `feat/app-visual-enhance`
untuk enhancement `/app`; polish copy landing di-commit langsung). Fase terakhir
dari go-public: menyelaraskan **bahasa visual** `/app` dengan landing, tanpa
mengubah layout/struktur/alur yang sudah teruji. Mengikuti batasan di
`.kiro/steering/phase-2-auth-multitenant.md` §4 + `FE-SKILL.MD`.

### Prinsip (koridor yang dipatuhi)
- **Samakan bahasa visual (palet, tipografi, gaya komponen), BUKAN layout.**
  Landing boleh lebar/desktop; `/app` tetap sempit/mobile-native (`max-w-md`).
- **Jangan ubah** struktur/fungsi teruji (app-shell, bottom nav, alur
  matchmaking, screens) & mekanisme PWA.
- Token warna + font memang **satu sumber** (`globals.css` + `layout.tsx`) yang
  sudah dibagi landing & app → palet identik sejak awal. Yang belum nyambung
  hanya **pemakaian `font-display`** di `/app` (sebelumnya 0 pemakaian).
- Motion **tidak** ditambah — motion existing (spring tab, screen transition,
  stagger kartu, FAB) sudah disiplin sesuai FE-SKILL; menambah animasi justru
  jadi "tell" AI-generated.

### Enhancement `/app`
- **Tipografi** — `font-display` (Space Grotesk) diterapkan di heading kunci:
  nama sesi di header board (`app-shell.tsx`), judul screen
  (leaderboard/history/finish), header daftar mabar/roster/settings, kartu sesi,
  `CardTitle` (`ui/card.tsx`), `SheetTitle` (`ui/sheet.tsx` — dibungkus agar
  default `font-display`), label FAB (`ui/fab.tsx`).
- **Motif court di empty state** — komponen baru `src/components/ui/empty-court.tsx`
  (`EmptyCourt` + `CourtGlyph`): SVG lapangan mini (petak + net teal + shuttle),
  statis & ikut tema. Dipakai di empty state **Daftar Mabar**, **Pemain**, dan
  **Leaderboard** (menggantikan teks dashed polos). Membawa bahasa visual landing
  (`court-diagram.tsx`) ke tempat yang tepat, bukan dekorasi acak.
- **Ikon shuttlecock** — emoji 🏸 diganti gambar `public/shuttlecock.png` di
  header board & daftar mabar, halaman error (`error.tsx`, `global-error.tsx` —
  yang terakhir pakai `<img>` biasa, bukan `next/image`, agar root error boundary
  tetap bebas dependency), dan dialog tambah pemain. Emoji di **teks** (share
  result `share-result.ts`, label tombol `createSession.startNow`) sengaja
  dibiarkan karena itu string, bukan elemen UI.
- **Ikon Google** — tombol "Masuk/Daftar dengan Google" di `/login` & `/register`
  kini ber-ikon `public/google.png` (`{icon} teks`). Aset sumber di `asset/`.

### Fix UX — redundansi opsi "Match Pertama"
- `ModePickerSheet` (`courts-screen.tsx`) dipakai di **dua konteks**: dari kartu
  lapangan **kosong** ("Smart Matchmaking") dan dari lapangan **berjalan**
  ("Auto-fill"). Di lapangan kosong, opsi "Match Pertama" di dalam sheet
  **redundan** karena kartu sudah punya tombol First Match tersendiri.
- Solusi: prop `showFirstMatch` — sheet menyembunyikan opsi First Match **hanya
  saat dibuka dari lapangan kosong**; di lapangan berjalan tetap ditampilkan
  (di sana itu satu-satunya jalan menyusun match pertama untuk pemain gelombang
  baru). Fungsi tidak dihapus, hanya disembunyikan sesuai konteks.

### Polish copy landing (rencana monetisasi)
- **Hapus semua nuansa "gratis"** karena rencana berbayar setelah pengguna
  banyak: badge hero "Gratis untuk komunitas badminton" → "Matchmaking adil untuk
  mabar badminton"; CTA "Mulai gratis" → "Mulai"; FAQ "Apakah TangkasBoard
  gratis?" → "Perlu install aplikasi?" (jawaban PWA).
- **Fix jumlah langkah** — subtitle Cara Kerja "Empat langkah" → "**Lima
  langkah**" (sesuai 5 langkah yang ada).
- **FAQ multi-host** — jawaban "Bisakah beberapa host mengelola satu komunitas?"
  diubah dari "sedang disiapkan" → **"Bisa"** (fitur sudah ada sejak Fase 2, §18).
- Semua wording di `src/lib/i18n/dict.ts` (dwibahasa `{ id, en }`).

### Verifikasi
Tiap perubahan lolos `npm run typecheck` + `npm run lint` + `npm run build`
(exit 0). Build sekaligus memastikan `/app` tidak jebol akibat perubahan token/
komponen bersama.

---

## 20. Enhancement — Multi-Set (Best of 1 / 2 / 3)

Status: **diimplementasi & di-push ke `main`** (2 commit: fitur inti + polish copy
landing). Menambah kemampuan mencatat lebih dari satu set per match. Sebelumnya
satu match = satu skor tunggal (single set). Dikerjakan via Vibe.

### Keputusan (locked)
- **Format dipilih host saat membuat mabar**: 1 set / best of 2 / best of 3
  (`session.sets_target`, default 1). Mabar lama otomatis = Best of 1.
- **Input per set** (bukan sekali di akhir): host mengisi skor tiap set **begitu
  set itu selesai**. Alasan: host input langsung di lapangan, tidak perlu hafal
  skor beberapa set. Untuk best of 2/3, setelah simpan set match tetap `playing`
  sampai match diputus, lalu otomatis `finished`.
- **Pemenang match** = mayoritas set menang (`setsToWin = floor(target/2)+1` →
  BoF1=1, BoF2=2, BoF3=2). Diputus bila salah satu tim mencapai `setsToWin`
  **atau** semua `sets_target` set sudah dimainkan. Set imbang total → **seri**
  (`draw`).
- **Satu set individual tidak boleh imbang** — harus ada pemenang (dijaga di
  client & RPC). Ini satu-satunya validasi skor; **tidak ada validasi poin
  maksimal** (bebas 21/30/dst, akomodasi deuce & format komunitas yang beragam).
- **Poin leaderboard = TOTAL poin semua set** (skema existing dipertahankan),
  selisih total → Diff. Satu match tetap = satu W/L/S. Seri dicatat di kolom
  `draws` + kolom baru **S (Seri)** di leaderboard; ranking tetap berbasis
  Poin → Diff → nama (seri tidak mengubah cara sorting, hanya kolom info).

### Model data
- **`session.sets_target`** `int` (1/2/3, default 1, CHECK).
- **`match_set`** — satu baris per set: `id`, `match_id` (FK, ON DELETE CASCADE),
  `set_no` (≥1), `score_a`, `score_b`, `created_at`; **unique(`match_id`,`set_no`)**
  sebagai jaring pengaman anti dobel-tap.
- **`match.score_a`/`score_b`/`winner`** dipertahankan sebagai **AGREGAT** (total
  poin semua set + pemenang akhir). Jadi leaderboard (`applyMatchResult`), history
  lintas-mabar (`listResolvedMatches`/`roster-stats`), dan konsumen lama **tidak
  berubah** — mereka tetap baca agregat.
- Tipe: `DbSession.sets_target`, `DbMatchSet`, `Match.sets?: {a,b}[]` (opsional —
  kosong untuk match lama/BoF1 tanpa baris set; `mappers.toMatch(row, setRows)`
  merakit array set terurut `set_no`).

### RPC atomik (jantung fitur — `supabase/migrations/018_multi_set.sql`)
- **`finish_set_atomic(p_match_id, p_score_a, p_score_b, p_shuttlecocks)`**:
  catat satu set (nomor set = `max(set_no)+1`, server-side → aman race), tolak set
  imbang, rekap seluruh set. Bila **belum** diputus → set match `playing` saja
  (statistik tidak disentuh). Bila **diputus** → tulis agregat ke `match`, set
  `finished`, dan update statistik 4 pemain (menang/kalah/seri + total poin)
  **sekali**. Idempoten: match yang sudah `finished` di-skip.
- **`edit_match_sets_atomic(p_match_id, p_sets jsonb)`**: ganti seluruh baris
  `match_set` sebuah match `finished` dengan daftar baru, hitung ulang agregat
  match, lalu terapkan **selisih (delta)** W/L/S & poin ke 4 pemain — semua dalam
  satu transaksi. Menolak set imbang & jumlah set melebihi format.
- RPC lama `finish_match_atomic` (single-set) **tetap ada** sebagai jaring
  pengaman untuk klien versi lama selama masa transisi; bisa dibersihkan setelah
  yakin tak ada klien lama.

### Store & repo
- `repo`: `createSession` bawa `setsTarget`; `listMatchSets(sessionId)`;
  `finishSetAtomic`; `editMatchSetsAtomic`. `openSession`/`refresh` fetch
  `match_set` lalu `toMatch(m, matchSets)`.
- `session-store`: `finishMatch` → **`finishSet`** (submit satu set, kembalikan
  `{ok, reason}`, guard anti dobel-tap); `editMatchScore` → **`editMatchSets`**
  (array set); helper baru **`setProgress(matchId)`** (`current`/`target`/
  `setsWonA`/`setsWonB`) untuk judul & ringkasan progres.

### UI
- **Create session dialog**: selector segmented **1 set / Best of 2 / Best of 3**.
- **Finish dialog**: judul **"Skor Set N · Match ke-M"** untuk multi-set, badge
  "Best of N" + "Set menang — a:b", menolak set imbang, tombol **Simpan Set**.
  Single-set tetap tampil seperti sebelumnya.
- **Kartu lapangan** (`courts-screen`): badge **Set s/N**, chip skor tiap set yang
  sudah selesai, label tombol **Selesai Set** (multi-set).
- **Edit score dialog**: baris input skor **per set**; menolak set imbang.
- **History**: skor **per set** sebagai tampilan utama (total agregat disembunyikan
  — tak lazim di badminton), badge **Seri** bila draw; fallback skor tunggal untuk
  match lama.
- **Leaderboard**: kolom baru **S** (Seri/draw).

### Landing page (copy diselaraskan)
- **§1 What / Cara Kerja**: sebut skor per set & format 1/BoF2/BoF3; langkah
  "catat skor" → "catat skor per set".
- **Fitur**: kartu baru **Format Set Fleksibel**; Livescore diperluas (skor per
  set ikut realtime).
- **FAQ q3** dikoreksi dari klaim usang *"skor 1 set, 2–3 set on roadmap"* →
  deskripsi fitur yang sudah live (pilih format, input per set, pemenang mayoritas
  set, seri dicatat).

### Kok (shuttlecock) kumulatif — carry-over antar set
- Kok bersifat **kumulatif per match** (bukan per set). Nilai yang dikirim tiap
  `finishSet` adalah **total kok berjalan** sampai set itu.
- `finish_set_atomic` menyimpan `match.shuttlecocks` di **setiap** set (bukan
  hanya saat final) — perbaikan di migration **`019`** (sebelumnya kok set
  non-final dibuang).
- Dialog Finish default field kok: set pertama → `1` (asumsi minimal 1); set
  berikutnya → **total kok tersimpan** sejauh ini, host tinggal menambah kok yang
  kepakai di set itu. Hint "total kok match ini (termasuk set sebelumnya)".
- Edit skor (`edit_match_sets_atomic`) **tidak** menyentuh kok — total kok tetap
  seperti terakhir tercatat.

### Kompatibilitas & deploy
- **Backward-compatible**: mabar lama = `sets_target` 1; match lama tetap terbaca
  dari agregat `score_a/score_b` walau `match_set` kosong.
- **Urutan deploy**: jalankan migration `018` **lalu** `019` di Supabase
  **sebelum** deploy kode (kode baru memanggil RPC & tabel baru). Aman dilakukan
  bahkan saat ada mabar berjalan (semua mabar lama = Best of 1, alur Finish
  identik dengan sebelumnya).

### Verifikasi
Lolos `npm run typecheck` + `npm run lint` + `npm run test` (92 passed) +
`npm run build` (exit 0).

---

## 21. Enhancement — Scoring Adil per-Set (Normalisasi Poin & Diff)

Status: **diimplementasi & di-push ke `main`** (1 commit). Memperbaiki
ketidakadilan perhitungan poin livescore setelah fitur Multi-Set (§20). Dikerjakan
via Vibe.

### Masalah
Sejak Multi-Set, poin pemain = **jumlah mentah** semua poin dari semua set yang
dimainkan. Akibatnya match yang berlanjut ke **3 set** (karena skor set jadi 1-1)
mengumpulkan **~50% poin lebih banyak** dibanding match yang selesai **2 set** —
padahal itu murni efek format, bukan performa. Contoh nyata:
- Match 1 (2 set): tim menang 21-15, 21-5 → **42 poin**.
- Match 2 (3 set): tim menang 21-13, 19-21, 21-6 → **61 poin**.

Pemain yang kebetulan mainnya 3 set melonjak di leaderboard tanpa alasan skill.
Bonus **+M** flat **25** juga jadi timpang setelah normalisasi (skalanya ikut
sistem poin lama yang besar).

### Keputusan (locked)
- **Opsi A + C — normalisasi per set**: poin sebuah match untuk pemain =
  `total_poin_tim ÷ jumlah_set_match`. Diff ikut dinormalisasi dengan cara sama.
  Match 2-set & 3-set jadi setara skalanya (rata-rata per set).
- **Display-layer, bukan DB**: data mentah (`match.score_a/b` total + `match_set`
  per set) **tidak diubah**; normalisasi dihitung ulang saat render dari `matches`.
  Alasan: data per-set tetap utuh, formula gampang di-tweak/rollback, tidak perlu
  migration/backfill.
- **Bonus +M = rata-rata poin-per-set liga × match tertinggal** (Opsi 2 —
  netral). Basis diturunkan dari data sesi (rata-rata poin-per-set semua match
  selesai), fallback **21** bila belum ada match. Menggantikan flat 25 agar
  satuannya nyambung dengan poin ternormalisasi & otomatis ikut skala sesi.
- **Display dibulatkan, sort desimal**: kolom Poin/Diff/+M ditampilkan bulat,
  tapi ranking memakai nilai desimal penuh (hindari seri palsu akibat pembulatan).

### Implementasi
- **`src/lib/domain/leaderboard.ts`**:
  - Fungsi baru **`perSetPlayerStats(matches)`** → untuk tiap match `finished`,
    bagi total tim dengan jumlah set (`sets.length`, fallback 1 untuk match lama/
    BoF1) lalu akumulasi per pemain; sekaligus hitung `avgPointsPerSet` liga.
  - **`buildLeaderboard(players, matches?)`** — parameter `matches` **opsional**:
    bila ada → poin/Diff ternormalisasi + bonus berbasis `avgPointsPerSet`; bila
    tidak → **fallback** ke skema total-mentah lama (kompatibilitas pemanggil yang
    tak mengirim match, mis. `share-result`).
  - `LeaderboardRow` menambah field display: **`pointsDisplay`**,
    **`pointDiffDisplay`**, **`bonusDisplay`** (bulat). Field `pointsScored`/
    `pointDiff`/`bonus` tetap desimal penuh untuk sorting.
  - Konstanta `MISSED_MATCH_BONUS = 25` diganti `MISSED_MATCH_FALLBACK_BONUS = 21`.
- **Pemanggil di-update** untuk mengirim `matches` & merender field `*Display`:
  `leaderboard-screen.tsx`, `final-result-screen.tsx` (tabel + podium),
  `finish-screen.tsx` (champion card), `app-shell.tsx` (ReadOnlyResult).
  `share-result.ts` tidak diubah (tak merender kolom poin → aman via fallback).

### Dampak
- Ranking mencerminkan performa sebenarnya, tidak lagi bias jumlah set.
- **Skala angka kolom Poin mengecil** (dari ratusan → puluhan) — konsekuensi
  wajar normalisasi per-set, bukan bug.
- Backward-compatible: match lama/BoF1 (tanpa baris `match_set`) dihitung sebagai
  1 set → sama dengan sebelumnya.

### Verifikasi
Lolos `npm run typecheck` (exit 0) + `npm run test` (94 passed, 3 skipped —
integration DB) + `npm run build` (Compiled successfully). Dua test baru di
`domain.test.ts`: normalisasi per-set (skenario 2-set vs 3-set nyata) & bonus +M
berbasis rata-rata liga.

---

## 22. Enhancement — Import Daftar Pemain (tempel dari WhatsApp)

Status: **diimplementasi & di-push ke `main`**. Menghapus pekerjaan manual paling
membosankan buat host: mendaftarkan 15–20 peserta satu per satu padahal
daftarnya sudah ada di grup WhatsApp. Dikerjakan via Vibe.

### Masalah
Daftar peserta lahir di grup WA, bentuknya seperti ini:

```
1. Ryan ✅
2. ⁠nugroho ✅
3. ⁠Rusti ✅
...
17. ⁠awal ✅
```

Sebelum fitur ini host harus: buka tab Roster, cari nama satu-satu, centang,
lalu untuk nama yang belum ada pindah ke tab Pemain Baru dan mengetik manual,
lalu masuk ke tiap kartu pemain untuk menyalakan toggle "Sudah bayar".

### Keputusan (locked)
- **Tab ketiga di sheet Tambah Pemain** (`Dari Roster` | `Pemain Baru` |
  `Import`), bukan tombol aksi langsung dan bukan sheet terpisah. Konteksnya
  identik (mendaftarkan pemain ke mabar) dan sheet-nya sudah punya tab switcher.
- **Dua langkah: tempel → preview → eksekusi.** Import menulis ke roster
  permanen, jadi salah baca lebih murah ditangkap di layar preview ketimbang
  dibersihkan satu-satu setelahnya. Preview mengelompokkan hasil per kategori
  dan tiap baris masih bisa dikoreksi (dicentang/dilepas, ganti keputusan
  tautan, ubah status bayar).
- **Discoverability tanpa tooltip** (hover tidak ada di mobile): placeholder
  textarea berisi contoh format sesungguhnya, plus dua baris hint permanen di
  atas textarea (termasuk arti ✅). Tombol **Tempel dari clipboard** sebagai
  jalan pintas, dengan fallback tempel manual bila browser menolak izin.
- **Centang ✅ = Lunas.** Diisi langsung saat insert, bukan update menyusul.

### Aturan parsing (`src/lib/domain/import-players.ts`, murni & teruji)
- **Karakter tak terlihat dibuang** (`\u200B-\u200F`, `\u2060-\u2064`, word
  joiner, soft hyphen, BOM, VS-16). Ini bukan kosmetik: tempelan WhatsApp
  menyisipkan word joiner di awal baris, dan tanpa dibuang `"⁠nugroho"` tidak
  akan cocok dengan `"Nugroho"` di roster sehingga malah membuat profil kembar.
- **Penomoran & bullet dibuang**: `1.` `02)` `3 -` `7:` `- ` `• ` `–` dst.
- **Penanda lunas**: simbol `✅ ✔ ✓ ☑ 💰` (dengan/tanpa VS-16) atau kata
  `lunas` / `paid` / `sudah bayar`. **Negasi menang**: baris ber-`belum`/`blm`
  selalu dianggap belum bayar walau ada centang.
- **Kata bertema pembayaran dibuang dari nama** (`bayar`, `tf`, `transfer`,
  `cash`, `sudah`, `belum`, …) agar tidak nyangkut jadi bagian nama.
- Anotasi dalam tanda kurung dibuang (`Nyoman (bli)` → `Nyoman`), sisa simbol /
  emoji dibersihkan, nama di-Title Case mengikuti `toTitleCase` aplikasi.
- Baris tanpa huruf (kosong, hanya nomor, hanya emoji) dilewati.
- **Nama dobel dalam satu tempelan digabung**, status lunas di-OR (centang bisa
  menempel di salah satu penyebutan saja).

### Pencocokan nama ke roster
Lima kategori hasil per baris: `exact` · `fuzzy` · `new` · `session` ·
`duplicate`. Urutan penyelesaian dari paling pasti ke paling spekulatif, supaya
sistem tidak pernah menebak saat ada jawaban yang jelas:

1. nama dobel di tempelan → `duplicate`
2. persis sama dengan pemain di mabar ini → `session`
3. persis sama dengan profil roster → `exact` (turun jadi `session` bila profil
   itu ternyata sudah terdaftar di mabar)
4. mirip dengan profil roster → `fuzzy`
5. mirip dengan pemain di mabar → `session`
6. tidak ada padanan → `new` (profil roster dibuat, level & gender **kosong**)

**Skor kemiripan** (`nameSimilarity`, 0..1) = maksimum dari tiga heuristik yang
masing-masing punya ambangnya sendiri:
- **Jarak edit** ternormalisasi (Levenshtein, maksimum 2 edit, ambang 0.78) —
  menangkap salah ketik: `Rusti` ~ `Rusty` (0.8).
- **Awalan pada batas kata** (0.9) — menangkap nama panggilan vs nama lengkap:
  `Awal` ~ `Awal Prasetyo`. Harus berhenti tepat di batas kata, jadi `Ryan`
  **tidak** cocok dengan `Ryandika` (orang berbeda).
- **Token pertama** (didiskon 0.95) — kombinasi keduanya: `Rusti` ~
  `Rusty Wijaya`.

Nama **< 4 huruf hanya diterima bila persis sama** (`Can` vs `Cak` terlalu mudah
bertabrakan).

**Alokasi profil**: satu profil roster hanya boleh diklaim satu baris. Semua
kecocokan persis diklaim **lebih dulu** sebelum fuzzy dijalankan — tanpa ini,
tempelan yang memuat `Rusty` dan `Rusti` sekaligus bisa membuat `Rusti` mencuri
profil `Rusty`. Di antara baris fuzzy sendiri, yang kemiripannya tertinggi
memilih lebih dulu (bukan urutan baris), jadi hasilnya tidak bergantung urutan
tempelan. Kandidat dihitung sekali per baris (O(baris × roster)) lalu dibagikan
greedy.

### Dua default yang dipilih sengaja (asimetri akibat)
1. **Tautan fuzzy tidak otomatis diterima di bawah `AUTO_LINK_SIMILARITY`
   (0.9).** Salah menautkan berarti dua orang berbeda berbagi satu profil roster
   → statistik lintas-mabar tercampur dan **tidak ada UI untuk memisahkannya
   lagi**. Salah membuat baru hanya menyisakan entri roster kembar yang bisa
   dihapus dari tab Roster. Jadi yang mahal dihindari; `Rusti` → `Rusty` (0.8)
   butuh satu tap konfirmasi, `Awal` → `Awal Prasetyo` (0.9) langsung tertaut.
   Kasus nyata yang dijaga: `Tryan` vs `Ryan` berjarak 1 edit (0.8) tapi dua
   orang berbeda.
2. **Status bayar tidak pernah diturunkan otomatis.** Pemain yang di mabar sudah
   tercatat lunas tetap lunas walau tempelan tidak memuat centang untuknya —
   host sering menempel ulang daftar lama hanya untuk menambah peserta baru, dan
   itu tidak boleh membatalkan pembayaran yang sudah tercatat. Host tetap bisa
   mematikannya secara eksplisit.

Baris `fuzzy` ditempatkan **paling atas** di preview (border amber + hitungannya
disebut di ringkasan) karena itu satu-satunya kategori yang keputusannya belum
pasti.

### Repo & store (bulk, bukan loop)
Alur lama `RosterTab` melakukan satu `addSessionPlayer` **plus satu `refresh()`
penuh** per pemain. Untuk 17 nama itu 17 insert + 17 refetch sesi, jadi import
memakai jalur bulk baru:
- `repo.createProfiles(rows, communityId)` — satu insert array untuk profil
  roster baru. Hasilnya dicocokkan kembali **lewat nama** (`nameKey`), bukan
  indeks, karena urutan baris hasil insert tidak dijamin.
- `repo.addSessionPlayers(sessionId, players[])` — satu insert array. Payload
  `NewSessionPlayer` sekarang menerima **`paid`** (sebelumnya kolom `paid` hanya
  bisa diubah lewat update terpisah, dan tidak masuk whitelist
  `updateSessionPlayer`).
- `repo.setSessionPlayersPaid(ids, paid)` — sinkron status bayar pemain lama,
  dikelompokkan jadi maksimal dua update (`true` & `false`).
- `sessionStore.importPlayers(executionPlan)` — orkestrasi: buat profil → insert
  pemain → sinkron bayar → **satu `refresh()`** di akhir; mengembalikan
  `{ok, added, createdProfiles, paidUpdated}`.

**Kegagalan sebagian**: bila insert pemain gagal setelah profil terbuat, sisa
profil tetap ada di roster. Itu tidak merusak data mabar (hanya entri roster yang
bisa dihapus manual), jadi tidak dibungkus RPC transaksional — pesan error
tampil lewat `actionError` global dan preview dibiarkan utuh supaya host bisa
mencoba lagi tanpa menempel ulang.

### UI
- `src/components/ui/textarea.tsx` — komponen baru, gaya mengikuti `Input`
  (sebelumnya belum ada textarea di design system).
- `src/components/dialogs/import-players-tab.tsx` — dua langkah, preview
  berkelompok, checkbox per baris, pill Lunas/Belum yang bisa di-tap, segmented
  `Pakai <nama roster>` / `Bikin baru: <nama yang diketik>` untuk baris fuzzy,
  tombol **Ubah teks** untuk balik ke langkah tempel tanpa kehilangan teks.
- Tombol lanjut menyebut apa yang terbaca sebelum ditekan (**"Cek 17 nama"**),
  dan tombol eksekusi menyebut dampaknya (**"Tambah 16 pemain"**, atau
  **"Perbarui 3 status bayar"** bila tidak ada yang ditambah).
- Wording dwibahasa di `dict.ts` prefix **`import.*`** + `addPlayer.import`.

### Tidak diubah
Tidak ada migration baru — kolom `session_player.paid` sudah ada sejak migration
`017`. Tab Roster & Pemain Baru tetap seperti sebelumnya (masih jalur tercepat
untuk menambah 1–2 orang).

### Verifikasi
Lolos `npm run typecheck` + `npm run lint` + `npm run test` (**53 test baru** di
`import-players.test.ts`, total 144 passed + 3 skipped integration DB) +
`npm run build` (exit 0). Test mencakup daftar WhatsApp asli host (17 nama,
lengkap dengan word joiner), variasi format penomoran & penanda bayar, aturan
alokasi profil, dan **4 property test** (fast-check): satu profil tak pernah
diklaim dua baris, tiap baris hasil selalu punya nama berisi huruf, kekekalan
jumlah baris terhadap kategori, dan pemain yang sudah di sesi tak pernah
di-insert ulang.
