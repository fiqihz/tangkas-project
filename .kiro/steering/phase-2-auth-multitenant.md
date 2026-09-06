---
inclusion: manual
---

# Fase 2 — Auth + Multi-Tenant & Enhancement UI/UX `/app`

> **Cara pakai:** panggil manual (`#phase-2-auth-multitenant`) saat memulai
> Fase 2 di sesi baru. Dokumen ini merangkum SEMUA keputusan yang sudah
> disepakati bersama user, plus temuan teknis lingkungan, supaya tidak perlu
> bahas ulang dari nol. Berkaitan dengan `#go-public-roadmap` (arah strategis
> jangka panjang) — dokumen ini versi konkret & actionable-nya.

---

## 0. Status saat dokumen ini dibuat

- **Fase 1 SELESAI** (landing page + feedback + notifikasi email). Ada di branch
  `feat/landing-feedback` (sudah di-push, belum merge ke `main`).
- **Strategi branch/merge yang disepakati:** tiap fase = branch sendiri. Merge ke
  `main` setelah user review & yakin. Fase 1, Fase 2, dan enhancement `/app`
  masing-masing branch terpisah.
- **Urutan kerja yang disepakati:**
  1. Commit + review Fase 1 (selesai).
  2. **Fase 2: Auth + multi-tenant** (via SPEC — kompleks & sensitif).
  3. **Enhancement visual `/app`** — DIKERJAKAN PALING AKHIR, setelah auth, agar
     semua elemen UI final (community switcher, menu admin, logout, profil) sudah
     ada di layar → redesign sekali jalan, tidak dobel kerja.

---

## 1. Lingkungan & infra (TEMUAN PENTING — sering bikin bingung)

- **Dua environment Supabase:**
  - `.env.local` → di-set user ke **CLOUD** (project asli). Di Next.js `.env.local`
    menang atas `.env`. (Awalnya nunjuk ke lokal `127.0.0.1:54321` — sempat bikin
    error `Unexpected token '<' ... is not valid JSON` di `/app` karena RPC balikin
    HTML dari DB lokal kosong.)
  - `.env` → CLOUD, project-ref **`cvuqtwikykyhcaxyjqba`**.
  - `.env.local` & `.env` **di-gitignore** — JANGAN pernah commit.
- **Migrations**: numbered SQL di `supabase/migrations/` (`000`–`011`). User
  menjalankannya via Supabase CLI (`npx supabase ...`, CLI TIDAK terinstal global —
  pakai `npx`) atau tempel manual di SQL Editor dashboard.
- **Edge Functions**: runtime Deno. `tsc` & eslint sudah di-exclude untuk
  `supabase/functions/**` (jangan di-lint pakai config Next.js).
- **Resend** (email): dipakai Fase 1 untuk notif feedback; akan dipakai lagi Fase 2
  untuk **email undangan admin**. Secret di Supabase (`RESEND_API_KEY`,
  `FEEDBACK_TO`, `FEEDBACK_FROM`). Dari `onboarding@resend.dev` hanya bisa kirim ke
  email pemilik akun Resend → **untuk invite ke email orang lain WAJIB verifikasi
  domain dulu** lalu ganti `FEEDBACK_FROM`/from ke alamat domain.
- **Database Webhook UI dashboard TIDAK BISA dipakai** di project ini — schema
  `supabase_functions` tidak ter-provision (cek: `pg_namespace` cuma punya `net` &
  `extensions`). Solusi yang dipakai: **trigger SQL sendiri via `net.http_post`**
  (pg_net) — lihat migration `011`. Pola ini dipakai lagi bila butuh webhook.

---

## 2. Keputusan Fase 2 yang SUDAH disepakati

### Auth
- **Supabase Auth**, provider: **Google + Email/Password** (dulu ini saja).
- Alur: Landing (`/`) → Login/Register → jika belum punya community → onboarding
  (**create community**, auto jadi `owner`) → `/app`.
- **Retire** `PasswordGate` lama (`src/components/password-gate.tsx`) — ganti auth
  beneran. `getSupabase()` sekarang `persistSession: false` → untuk Auth ubah ke
  `true`.
- `config.toml` sudah `[auth] enabled = true` & Google provider tinggal di-enable.

### Model tenant & role
- Tabel baru **`membership`** (user_id ↔ community_id + role). Karena via
  membership (bukan `community_id` di user), **1 user bisa di banyak community** →
  butuh **community switcher** di `/app` bila user punya >1.
- **Role:**
  - `owner` — pembuat community; satu-satunya yang bisa hapus community & kelola
    daftar admin; tidak bisa di-kick.
  - `admin` — host tambahan; bisa view + edit semua (mabar/pemain/skor).
  - (Nanti bisa tambah `member` read-only — skema harus menampung, belum
    diimplementasi.)

### Invite admin
- **Bukan** self-service join (alasan: data mabar sensitif). Pakai **undangan dari
  owner via email**.
- Alur: owner masukkan email calon admin → sistem kirim email (Resend) berisi link →
  penerima klik → **redirect ke halaman register** app → setelah register jadi
  `admin` di community itu.
- Butuh tabel **`invite`** (email, community_id, role, token, status, expires_at).

### RLS (PALING SENSITIF — wajib dibarengi auth, bukan belakangan)
- Ganti policy permisif `anon using(true)` → **ketat per-community**:
  - Write hanya `authenticated` + cek user adalah member community terkait
    (`auth.uid()` ada di `membership` untuk `community_id` baris tsb).
  - Pertimbangkan read publik hanya untuk data yang memang di-share (mis.
    livescore) bila diperlukan.
- Semua tabel data (`player_profile`, `session`, `session_player`, `court`,
  `match`) sudah punya `community_id` / bisa di-join ke sana. Repo layer
  (`src/lib/supabase/repo.ts`) SUDAH menerima `communityId` di tiap fungsi
  (default `DEFAULT_COMMUNITY_ID`) → tinggal ganti sumber ID dari default ke
  community aktif user.

### Migrasi data lama
- Data mabar existing ada di `DEFAULT_COMMUNITY_ID`
  (`00000000-0000-0000-0000-000000000001`).
- **Keputusan user: KLAIM data lama ke community pertama yang dibuat user** (bukan
  fresh). Saat user pertama register + create community, re-assign semua baris
  ber-`community_id = DEFAULT_COMMUNITY_ID` ke community baru itu. Lakukan sekali,
  hati-hati, idempoten.

---

## 3. Kenapa Fase 2 pakai SPEC (bukan Vibe)
Banyak sub-sistem saling kait (auth, membership, invite, RLS, onboarding,
switcher, migrasi data, retire gate), sensitif & susah di-undo (RLS salah = data
bocor antar tenant; migrasi salah = data mabar kacau), dan butuh urutan benar.
Spec memberi requirements yang di-approve dulu + design yang direview sebelum kode
(krusial untuk RLS/skema) + task list tercentang. (Revisi UI Fase 1 pakai Vibe
karena visual & iteratif — beda jenis kerjaan.)

### Langkah teknis pertama saat mulai Fase 2
Kerjakan **Auth + RLS + ownership/multi-tenant + migrasi data lama** sebagai satu
fondasi (saling nyambung). Mulai dari rancang skema `membership`/`invite` +
tulis policy RLS baru, lalu wiring community aktif ke repo/store, baru UI
(login, onboarding, switcher, kelola admin).

---

## 4. Enhancement UI/UX `/app` (fase TERAKHIR, setelah auth)

### Fondasi visual SUDAH terpasang di Fase 1 (tinggal dipakai)
- Token warna bersama di `src/app/globals.css`: tambah **`--accent` (teal)** untuk
  light & dark, di samping `--primary` (hijau shuttle). Sistem light/dark class
  `dark` + `settings-store` sudah ada.
- Font via `next/font` di `layout.tsx`: **Space Grotesk** (`--font-display`) +
  **Inter** (`--font-sans`). Tailwind `fontFamily.display` & `.sans` sudah map ke
  situ.
- **Design token = SATU sumber.** Mengubah token otomatis mempengaruhi `/app` &
  landing. Ini disengaja demi konsistensi — tapi hati-hati karena `/app` sudah
  teruji dipakai mabar.

### Arah desain yang disepakati (dari FE-SKILL `.claude/skills/anthropic-skills/FE-SKILL.MD`)
- **Sporty tapi minimalist & clean. KETERBACAAN nomor satu** — jangan sampai
  desain bikin info susah dibaca.
- Palet **dark-first + aksen teal**, motif **lapangan badminton** (garis/petak,
  court diagram) sebagai bahasa visual, bukan kartu SaaS generik.
- Hindari "tell" AI-generated: cream+serif+terracotta; near-black + single acid
  green; SaaS-card kit (kartu identik + shadow abu sama); numbering 01/02/03 asal
  (hanya untuk konten yang benar-benar sequence); ALL-CAPS eyebrow; `→` di tombol;
  middot `A · B · C`; monospace label.
- **Motion sekali & terarah** (satu orchestrated moment), bukan fade-slide-up tiap
  section. Hormati `prefers-reduced-motion`.
- Referensi komponen landing yang sudah jadi (pakai sebagai acuan gaya):
  `src/components/landing/` — `court-diagram.tsx` (SVG lapangan), `flow-steps.tsx`
  (timeline), `faq-accordion.tsx`, `landing-page.tsx`, `feedback-form.tsx`.
- Skill lokal lain: `.claude/skills/mobile-pwa-ui/SKILL.md` (touch target 44px,
  bottom sheet vaul, safe-area, app-shell) — relevan untuk `/app`.

### Batasan `/app` saat enhance
- **JANGAN ubah struktur/fungsi** yang sudah teruji: `max-w-md` app-shell, bottom
  nav, alur matchmaking, screens di `src/components/screens/`.
- **JANGAN sentuh** mekanisme PWA (`manifest.webmanifest`, `public/sw.js`,
  `pwa-register.tsx`) — enhance visual tidak boleh merusak install/offline.
- Samakan **bahasa visual** (palet, tipografi, gaya komponen), **bukan** layout.
  Landing boleh lebar/desktop; `/app` tetap sempit/mobile-native.
- Wajib: semua wording baru masuk i18n `src/lib/i18n/dict.ts` (format `{ id, en }`)
  — app dwibahasa ID/EN.

---

## 5. Verifikasi wajib tiap perubahan
`npm run typecheck` → `npm run lint` → `npm run build` (semua harus exit 0).
`build` sekaligus memverifikasi `/app` tidak jebol akibat perubahan token bersama.
Bersihkan file sementara. Untuk perubahan auth/RLS/migrasi data: nyatakan apa yang
sudah & belum terverifikasi (mis. RLS perlu uji manual multi-user).

---

## 6. Referensi dokumen terkait
- `DESIGN.md` — dokumen acuan resmi app (mekanik matchmaking, skema data,
  roadmap "Opsi C" = fase 2 ini).
- `.kiro/steering/go-public-roadmap.md` — arah strategis go-public + monetisasi +
  biaya infra (Vercel/Supabase) + checklist keamanan publik.
- `supabase/migrations/` — sumber kebenaran skema DB (`000`–`011`).
