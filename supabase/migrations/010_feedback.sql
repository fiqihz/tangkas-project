-- ============================================================================
-- 010 — FEEDBACK (masukan dari landing page)
-- ============================================================================
-- Menampung masukan/temuan dari pengunjung landing page. Boleh anonim: kontak
-- opsional (email/WA) supaya host bisa balas bila mau.
--
-- Notifikasi: baris baru di tabel ini memicu Supabase Database Webhook ->
-- Edge Function `notify-feedback` yang mengirim email ke host (lihat langkah 3
-- di rencana; Resend). Feedback tetap aman tersimpan di sini sebagai backup.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  message     text not null check (char_length(trim(message)) between 1 and 4000),
  contact     text check (contact is null or char_length(trim(contact)) <= 200),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Anon boleh INSERT (kirim masukan) tapi TIDAK boleh SELECT/UPDATE/DELETE,
-- supaya masukan orang lain tidak bisa dibaca/diubah dari client.
-- Host membaca lewat dashboard Supabase (service role) atau via email notif.
alter table feedback enable row level security;

drop policy if exists feedback_insert_anon on feedback;
create policy feedback_insert_anon
  on feedback for insert
  to anon, authenticated
  with check (true);
