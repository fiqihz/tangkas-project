# TangkasBoard — Design & Agreement Document

Dokumen acuan resmi untuk aplikasi **TangkasBoard**. Merefleksikan kondisi
implementasi terkini (Batch A–F selesai). Batch G (gender + rotasi per-ronde)
masih ditunda — lihat `.kiro/steering/batch-g-gender-rotation.md`.

---

## 1. Tujuan

Aplikasi manajemen sesi mabar (main bareng) badminton ganda (2v2) untuk host:

1. **Matchmaking adil** — bagi pemain ke lapangan dengan mempertimbangkan level & pemerataan jatah main.
2. **Scoring & leaderboard** — catat skor tiap match, akumulasi menang/kalah + poin, tentukan juara (hadiah voucher).
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
| Akses (sekarang) | **Opsi B — satu password bersama** (gembok client-side) |
| Akses (masa depan) | **Opsi C — multi-komunitas + login + role** (skema disiapkan multi-tenant, belum diimplementasi) |
| Match pertama | **Selalu manual** (first come first play) |

---

## 3. Model Level & Bobot

- 4 level: **Newbie, Beginner, Intermediate, Advanced**
- Bobot: **Newbie=1, Beginner=2, Intermediate=3, Advanced=4**
- Level di-set manual oleh host, bisa diedit kapan saja (termasuk dari popup pemain di lapangan).
- Level tersimpan permanen di **roster** (`player_profile`) → tidak perlu observasi ulang di mabar berikutnya.

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
5. Minimalkan **selisih bobot** antar tim (fairness).
6. Minimalkan **pengulangan** partner & lawan (anti "ketemu itu-itu terus").

Faktor digabung jadi skor berbobot (config di `src/lib/domain/types.ts` → `DEFAULT_CONFIG`).
**Fairness level > mengejar jatah main**: sistem tidak melanggar hard rule hanya demi meratakan jatah main.

---

## 6. State Machine Match

Status match: **proposed** (belum mulai) → **playing** (berjalan) → **finished** (selesai) / **unfinished** (dibatalkan saat berjalan).

- **Match pertama tiap lapangan**: host **Isi manual** (first come first play). Tidak ada tombol auto-fill.
- Alur: isi manual → match **proposed** → tap **Mulai Main** → **playing**.
- Saat **playing**, di bawah kartu tampil **rekomendasi 4 pemain berikutnya** (computed, auto-recalculate, tidak dipersist). Bila pemain kurang/kombinasi tak valid → tampil pesan alasannya.
- **Finish & Input Skor** (hanya saat playing) → skor tercatat → sistem **auto-generate match `proposed` berikutnya** di lapangan yang sama.
- Tiap lapangan berjalan independen; **"Match ke-N" dihitung per lapangan**.
- Warna tombol: **Mulai Main** = biru (info), **Finish** = oranye (warning).

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
4. **Ganti / tukar pemain** → pemain kembali ke antrian (`active`). Pilih pengganti:
   - **Replace** dengan pemain menunggu, atau
   - **Swap** dengan pemain yang sedang main di lapangan lain (dua match ter-update).
   - Selalu tampil section **⭐ Disarankan** (kandidat terbaik) + **Semua tersedia** (dengan search) + **Tukar dengan yang sedang main**.
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

- Format default: **30 poin × 1 set** (fleksibel, bisa berubah).
- Dicatat: skor akhir match + pemenang. Ganda → 1 kemenangan berlaku untuk **2 pemain** tim menang.
- **Bonus poin tertinggal**: pemain yang jatah mainnya kurang dari yang terbanyak main dapat **25 poin × selisih match** (dihitung on-the-fly, tidak dipersist). Bonus masuk ke **selisih poin** (tie-break), bukan menambah jumlah menang.
- **Kolom leaderboard**: `#`, Pemain, **M** (menang), **K** (kalah), **WR** (win rate = menang/main×100), **+M** (bonus tertinggal), **Diff** (selisih poin termasuk bonus), **Poin** (total skor).
- **Livescore**: update otomatis tiap Finish (tab Skor).
- **Tie-break ranking**: (1) jumlah menang → (2) selisih poin (termasuk bonus) → (3) total poin → (4) nama.

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
- **Edit skor** match `finished`: statistik pemain **dihitung ulang** (undo skor lama → apply skor baru) agar leaderboard konsisten. Match `unfinished` tidak bisa diedit.

---

## 12. Arsitektur Data (Supabase)

Multi-tenant sejak awal (untuk jalan ke Opsi C):

- **community** — tenant (sekarang 1 default, digembok password Opsi B).
- **player_profile** (roster, permanen) — nama + level + `sessions_played`. Tidak ter-reset antar mabar.
- **session** — status (scheduled/ongoing/finished), courts, current_round, scheduled_at.
- **session_player** — state pemain per mabar: status, level, `checked_in_at`, games_played, last_played_round, available_since_round, wins/losses/draws, points_scored/conceded, profile_id.
- **court** — lapangan (label, position).
- **match** — court_id, `court_label` (snapshot), round, 4 pemain, state, skor, winner.

RLS aktif dengan policy permisif untuk anon (sesuai Opsi B — gembok di app). Realtime aktif di `match`, `session_player`, `court`.

Migrations (di `supabase/migrations/`): `001` sessions_played, `002` match state unfinished, `003` multi-status sesi, `004` match court_label, `005` checked_in_at.

---

## 13. Halaman / Tab

- **Daftar Mabar** (main page): list sesi + buat/kelola.
- **Pemain**: tambah (dari roster searchable / pemain baru), search, check-in, set level, rest/pulang. FAB + Pemain.
- **Lapangan**: kartu per lapangan (proposed/playing), Mulai Main / Finish, preview next-4, popup aksi pemain, tambah/hapus/rename lapangan.
- **Skor**: livescore leaderboard.
- **History**: match per lapangan + edit skor.
- **Selesai**: SELESAI MABAR → Hasil Akhir (podium).

---

## 14. Logika Inti (`src/lib/domain/`, teruji)

- Bobot level & keseimbangan tim (`rules.ts`)
- Matchmaking (hard rule + skor berbobot + anti-repeat + penalti baru-main) (`matchmaking.ts`)
- Antrian jatah main (`queue.ts`)
- History anti-repeat partner/lawan (`history.ts`)
- Pengganti/substitusi (`substitute.ts`)
- Akumulasi skor, bonus tertinggal, win rate, tie-break (`leaderboard.ts`)
- Tes: `domain.test.ts`, `rotation.test.ts` (15 tes).

---

## 15. Roadmap (belum dikerjakan)

- **Batch G**: gender + rotasi per-ronde (mixed → gendongan → kelas). Detail di `.kiro/steering/batch-g-gender-rotation.md`.
- **Opsi C**: Supabase Auth + multi-komunitas + role admin/member (host bisa dialihkan). Skema sudah multi-tenant, tinggal tambah auth + perketat RLS.
