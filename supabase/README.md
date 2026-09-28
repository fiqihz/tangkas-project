# Setup Supabase — TangkasBoard

Langkah sekali-jalan untuk menyiapkan database baru.

## 1. Buat project Supabase

1. Buka [supabase.com](https://supabase.com) → **Sign in** (bisa pakai GitHub).
2. **New project** → isi:
   - Name: `tangkasboard` (bebas)
   - Database Password: buat & simpan (untuk keperluan DB langsung, bukan app)
   - Region: pilih terdekat (mis. Singapore)
3. Tunggu project selesai di-provision (~2 menit).

## 2. Jalankan migration

Skema database dibangun dari file di [`migrations/`](./migrations), **berurutan
dari `000` sampai nomor terakhir**. Jangan lompat, dan jangan jalankan satu file
lama saja di database yang sudah jalan.

1. Buka menu kiri **SQL Editor** → **New query**.
2. Untuk tiap file `migrations/NNN_*.sql` (urut nomor): copy isinya, tempel, **Run**.
3. Pastikan tidak ada error sebelum lanjut ke file berikutnya.

Catatan penting:
- `000_base_schema.sql` masih memasang policy permisif lama (`<tabel>_all`,
  allow-all untuk anon). Policy itu dihapus oleh `013` dan `021`. Jadi **jangan
  berhenti di tengah** — database baru baru aman setelah semua migration jalan.
- Di database production, **jangan menjalankan ulang `000`** sendirian: itu akan
  memasang lagi policy allow-all dan membuka data semua komunitas.
- Dulu ada `supabase/schema.sql` (salinan `000` + multi-set). File itu sudah
  dihapus karena usang dan berbahaya bila dijalankan di production.

## 3. Ambil URL & anon key

1. Buka **Project Settings** (ikon gerigi) → **API**.
2. Salin:
   - **Project URL** → untuk `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Isi environment variables

Di root project, salin `.env.example` menjadi `.env.local` lalu isi:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Secret Edge Function (`RESEND_API_KEY`, `FEEDBACK_TO`, `FEEDBACK_FROM`,
`INVITE_FROM`, `APP_URL`, `WEBHOOK_SECRET`) **tidak** ditaruh di `.env` app —
set lewat `supabase secrets set`.

## 5. Auth

Aktifkan provider **Email** dan **Google** di **Authentication → Providers**.
Login, onboarding (buat community), dan undangan admin berjalan lewat Supabase
Auth + RPC di migration `015`/`016`.

## 6. Cek koneksi

```
npm run dev
```

Buka http://localhost:3000/app, daftar akun, lalu buat community.

---

## Model keamanan

- App memakai **anon key** + **Supabase Auth**. Anon key memang publik (ikut di
  bundle browser); yang menjaga data adalah **RLS**.
- RLS per-community (`013`, diperketat `021`):
  - **Baca**: anggota community (`is_member`).
  - **Tulis**: owner/admin community (`has_role`). Role `member` read-only.
  - Tabel `match_set` mengikuti aturan yang sama lewat join `match → session`.
- Operasi yang harus menembus RLS (buat community, tukar undangan, kick member)
  lewat RPC `SECURITY DEFINER` yang mengecek `auth.uid()` / role pemanggil.
- `claim_legacy_data` tidak bisa dipanggil langsung oleh client (`021`).
- **Jangan** commit `.env` / `.env.local`.
