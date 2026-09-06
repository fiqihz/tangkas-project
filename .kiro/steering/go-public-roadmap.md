---
inclusion: manual
---

# Go-Public Roadmap — Persiapan Rilis untuk Umum (SEDANG BERJALAN)

> **Status update:** Rilis untuk umum sudah MULAI dikerjakan.
> - **Fase 1 (landing page + feedback + notif email): SELESAI** — branch
>   `feat/landing-feedback`.
> - **Fase 2 (auth + multi-tenant): rencana konkret & keputusan detail ada di
>   `#phase-2-auth-multitenant`.** Dokumen INI = arah strategis jangka panjang
>   (keamanan publik, infra, biaya, monetisasi); dokumen itu = actionable
>   fase 2. Baca keduanya saat mulai fase rilis.
>
> Panggil steering ini secara manual (`#go-public-roadmap`) saat mulai fase rilis.

## Konteks kondisi app saat diskusi ini

- App: **TangkasBoard** — Next.js 16 + Supabase, di-deploy di Vercel
  (`https://tangkas-project.vercel.app/`). Saat ini **untuk internal saja**.
- **Auth sekarang**: `PasswordGate` (client-side, localStorage) dipasang di
  `src/app/page.tsx`. Password dari `NEXT_PUBLIC_APP_PASSWORD` — artinya kebaca
  di bundle browser. Di live Vercel, gate ini kebuka tanpa password (env-nya
  kemungkinan belum di-set di Vercel). Cukup untuk internal, TIDAK aman untuk publik.
- **RLS Supabase**: aktif, tapi policy `using (true) with check (true)` untuk role
  `anon` di semua tabel → siapa pun dengan anon key + URL bisa baca/tulis/hapus
  SEMUA data. (Lihat `supabase/schema.sql` §7.)
- **Multi-tenant**: skema sudah didesain multi-tenant lewat tabel `community`,
  tapi masih pakai 1 `Default Community` (single-tenant sementara / "Opsi B").
- **PWA**: sudah ada (manifest, icons, service worker register).

## Catatan infra (Vercel vs Supabase)

- **Vercel**: deployment production TIDAK auto-inactive/sleep (serverless + CDN).
  App tetap online selama dalam kuota plan. Vercel Hobby = "no commercial use";
  begitu monetisasi (iklan/langganan) → wajib Vercel Pro (~$20/bln).
- **Supabase free tier**: auto-**pause** setelah ~7 hari idle, DB 500MB,
  bandwidth 5GB/bln. Ini titik pertama yang kemungkinan maksa upgrade ke
  **Supabase Pro (~$25/bln)** saat app publik beneran dipakai. Siasat sementara:
  uptime-ping gratis biar tidak nganggur.

## Checklist yang harus ditambahkan sebelum publish untuk umum

Urut dari paling krusial. Poin 1–3 adalah **blocker keamanan** — tanpa ini,
publish = data siapa pun bisa dihapus/diubah orang lain.

1. **Autentikasi & otorisasi beneran**
   - Ganti password gate client-side → **Supabase Auth** (magic link / Google /
     email-password).
   - Pisahkan role **host (CRUD)** vs **penonton (read-only livescore)**.

2. **Kunci Row Level Security (RLS)**
   - Ganti policy permisif `anon` jadi ketat:
     - Read publik hanya untuk data yang memang mau di-share (livescore) atau butuh login.
     - Write hanya `authenticated` + cek ownership/`community_id`.
   - Tambah konsep **ownership**: kolom `owner_id`/`host_id` di `session`/`community`,
     policy cek `auth.uid()`.

3. **Multi-tenant beneran**
   - Hentikan share `Default Community`. User baru → auto-provision community
     sendiri, semua data ter-scope per `community`. (Struktur `community` sudah siap.)

4. **Rate limiting & abuse protection**
   - Rate limit dasar via Vercel Middleware (gratis); yang persistent pakai
     Upstash Redis (free tier). CAPTCHA pakai **Cloudflare Turnstile** (gratis).
   - Batasi jumlah sesi/pemain per user.

5. **Ketahanan infra**
   - Atasi Supabase auto-pause (uptime-ping atau upgrade Pro). Pantau kuota
     Vercel Hobby saat traffic naik.

6. **Legal & privasi** (karena simpan nama pemain = data pribadi)
   - Privacy Policy + Terms of Service (bisa pakai generator gratis, mis. Termly).
   - Mekanisme hapus akun/data. Cookie/consent notice bila pasang analytics.

7. **Error handling & observability**
   - Error boundary global + halaman error ramah (sekarang `getSupabase()` throw mentah).
   - Error monitoring (Sentry, free tier 5rb error/bln).
   - Analytics ringan (Vercel Analytics / Cloudflare Web Analytics / Umami self-host).

8. **Reliabilitas data**
   - Konfirmasi sebelum destructive action (mis. tombol "Hapus mabar").
   - Perjelas kebijakan retensi data (sekarang asumsi reset 1–2 hari — untuk publik
     harus eksplisit biar user tidak kaget datanya hilang).

9. **SEO & metadata**
   - Open Graph / Twitter card, deskripsi, favicon lengkap, robots.txt + sitemap.

10. **Onboarding & UX publik**
    - Landing/penjelasan singkat untuk user baru, empty state, tutorial pertama kali.

## Biaya implementasi (ringkas)

- **Semua kode/fitur di atas: gratis untuk diimplementasi.** Yang berpotensi bayar
  hanya **skala infra**, bukan ngodingnya.
- **Skenario hobi/komunitas, traffic kecil: ~Rp 0** (semua muat free tier;
  risiko utama cuma Supabase auto-pause).
- **Skenario publik beneran / komersial: ~$45/bln** = Supabase Pro ($25) +
  Vercel Pro ($20). Turnstile, Sentry, Upstash, analytics masih nempel free tier.

## Arah monetisasi (untuk NANTI, bukan sekarang)

Yang paling mungkin bayar = **host/penyelenggara mabar**, bukan pemain biasa.

1. **Freemium / subscription untuk host** (model utama, cocok dengan multi-tenant):
   free = 1 community + batas mabar + riwayat pendek; Pro = unlimited + riwayat
   permanen + statistik lintas mabar + export Excel/PDF. Tinggal tambah kolom
   `plan` di `community`.
2. **Bayar per event / paket kredit** (host yang tidak rutin).
3. **Sponsor lokal / voucher** — app sudah punya elemen hadiah voucher di
   `context.md`; toko olahraga/kafe lokal bisa sponsor leaderboard. Paling
   realistis cair di pasar komunitas Indonesia.
4. **Iklan** — paling gampang tapi receh + bikin Vercel jadi "komersial". Belakangan.
5. **Marketplace / pembayaran iuran (fee QRIS)** — kalau sudah skala.

Rekomendasi: **jangan monetisasi sebelum ada 5–10 host aktif rutin.** Awal:
tutup biaya infra dulu lewat sponsor + langganan segelintir host serius.

## Langkah teknis pertama saat fase rilis dimulai

Kerjakan **poin 1 + 2 + 3 sekaligus** (Supabase Auth + perketat RLS + ownership
multi-tenant) karena ketiganya saling nyambung dan jadi fondasi keamanan +
fondasi monetisasi (misah host gratis vs bayar). Mulai dari rancang skema
ownership + tulis policy RLS baru di `supabase/schema.sql`.
