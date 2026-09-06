# notify-feedback — Edge Function

Mengirim email notifikasi ke host tiap ada masukan baru di tabel `feedback`.
Dipicu oleh **Database Webhook** (INSERT pada `feedback`) → memanggil function
ini → function kirim email lewat **Resend**.

API key TIDAK disimpan di kode — dibaca dari **secrets** Supabase.

---

## Prasyarat

- Migration `010_feedback.sql` sudah dijalankan (tabel `feedback` ada).
- Supabase CLI sudah login & ter-link ke project:
  ```
  supabase login
  supabase link --project-ref <PROJECT_REF>
  ```
  (`<PROJECT_REF>` = bagian subdomain dari NEXT_PUBLIC_SUPABASE_URL, mis.
  `https://abcd1234.supabase.co` → ref-nya `abcd1234`.)

---

## 1. Set secrets

> Pakai API key Resend yang **BARU** (yang lama sudah di-share di chat, revoke &
> ganti dulu di dashboard Resend). Jangan taruh key di file yang di-commit.

```
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
supabase secrets set FEEDBACK_TO=fiqihz096@gmail.com
supabase secrets set FEEDBACK_FROM="TangkasBoard <onboarding@resend.dev>"
```

Opsional (disarankan) — token agar hanya webhook resmi yang boleh memanggil:

```
supabase secrets set WEBHOOK_SECRET=<string-acak-panjang>
```

Buat string acak, mis. di PowerShell:
```
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

> Catatan Resend free: mengirim dari `onboarding@resend.dev` hanya bisa ke email
> pemilik akun Resend. Untuk `fiqihz096@gmail.com` (email akun kamu) sudah cukup.
> Nanti saat butuh kirim ke email orang lain (invite admin, Fase 2), verifikasi
> domain dulu lalu ganti `FEEDBACK_FROM` ke alamat domainmu.

---

## 2. Deploy function

```
supabase functions deploy notify-feedback --no-verify-jwt
```

`--no-verify-jwt` dipakai karena pemanggil adalah Database Webhook (bukan user
login). Keamanan dijaga oleh `WEBHOOK_SECRET` (bila di-set).

URL function setelah deploy:
```
https://<PROJECT_REF>.supabase.co/functions/v1/notify-feedback
```

---

## 3. Buat Database Webhook (di dashboard)

Cara termudah lewat UI:

1. Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. **Name**: `feedback-notify`
3. **Table**: `feedback` · **Events**: centang **Insert** saja.
4. **Type**: **Supabase Edge Functions** → pilih `notify-feedback`.
   (Atau **HTTP Request** POST ke URL function di atas.)
5. **HTTP Headers** (bila kamu set `WEBHOOK_SECRET`): tambah header
   `x-webhook-secret` = nilai `WEBHOOK_SECRET`.
6. **Create**.

Selesai. Kirim feedback dari landing page → cek inbox `FEEDBACK_TO`.

---

## 4. Uji cepat (opsional)

Insert baris dummy dari SQL Editor (memicu webhook):

```sql
insert into feedback (message, contact)
values ('Tes notifikasi feedback 🏸', 'fiqihz096@gmail.com');
```

Cek log function bila email tidak sampai:
```
supabase functions logs notify-feedback
```

Kesalahan umum:
- **500 Server not configured** → secret `RESEND_API_KEY`/`FEEDBACK_TO` belum di-set.
- **401 Unauthorized** → `WEBHOOK_SECRET` di-set tapi header webhook tidak cocok.
- **502 Email failed** → key Resend salah / tujuan bukan email akun (saat masih
  pakai `onboarding@resend.dev`).
