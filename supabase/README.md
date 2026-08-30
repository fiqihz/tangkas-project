# Setup Supabase — TangkasBoard

Langkah sekali-jalan untuk menyiapkan database. Butuh ~5 menit.

## 1. Buat project Supabase

1. Buka [supabase.com](https://supabase.com) → **Sign in** (bisa pakai GitHub).
2. **New project** → isi:
   - Name: `tangkasboard` (bebas)
   - Database Password: buat & simpan (untuk keperluan DB langsung, bukan app)
   - Region: pilih terdekat (mis. Singapore)
3. Tunggu project selesai di-provision (~2 menit).

## 2. Jalankan skema database

1. Di dashboard project, buka menu kiri **SQL Editor**.
2. Klik **New query**.
3. Buka file [`schema.sql`](./schema.sql), **copy semua isinya**, tempel ke editor.
4. Klik **Run** (atau Ctrl/Cmd + Enter).
5. Pastikan tidak ada error. Ini membuat semua tabel + komunitas default + RLS + realtime.

## 3. Ambil URL & anon key

1. Buka **Project Settings** (ikon gerigi) → **API**.
2. Salin:
   - **Project URL** → untuk `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Isi environment variables

Di root project, salin `.env.example` menjadi `.env` lalu isi:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_APP_PASSWORD=kode-rahasia-lu
```

- `NEXT_PUBLIC_APP_PASSWORD` = password bersama (Opsi B). Bagikan hanya ke host tepercaya.
- Kosongkan `NEXT_PUBLIC_APP_PASSWORD` bila ingin tanpa gembok (tidak disarankan).

## 5. Cek koneksi

Jalankan app lokal:

```
npm run dev
```

Buka http://localhost:3000. Bila env benar, app bisa baca/tulis ke Supabase.

---

## Catatan keamanan (Opsi B)

- Akses DB memakai **anon key** + RLS policy permisif (allow all).
- Artinya siapa pun dengan URL app + password bisa baca/tulis data.
- Ini sesuai kesepakatan: gembok ada di sisi app (1 password bersama).
- **Jangan** commit `.env` atau sebar anon key/URL ke publik.

## Jalan ke Opsi C (nanti)

Skema sudah multi-tenant (semua data punya `community_id`). Untuk upgrade:
1. Aktifkan Supabase Auth (login per user).
2. Tambah tabel membership (user ↔ community + role).
3. Perketat RLS policy: user hanya boleh akses community miliknya.
4. Data lama (di Default Community) tinggal di-assign ke akun admin pertama.

Tidak perlu merombak struktur tabel.
