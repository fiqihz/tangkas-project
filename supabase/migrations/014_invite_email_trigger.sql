-- ============================================================================
-- 014 — TRIGGER NOTIFIKASI INVITE (bypass UI Webhooks)
-- ============================================================================
-- Alternatif untuk fitur "Database Webhooks" di dashboard yang gagal dibuat
-- karena schema `supabase_functions` tidak ter-provision di project ini
-- (query pg_namespace mengonfirmasi: hanya ada `net` & `extensions`).
--
-- Pendekatan: trigger AFTER INSERT pada `invite` yang memanggil Edge Function
-- `send-invite` langsung via pg_net (`net.http_post`). Hanya butuh ekstensi
-- pg_net (sudah aktif), TIDAK butuh schema supabase_functions. Mengikuti pola
-- migration 011 (notify-feedback) yang sudah terbukti jalan.
--
-- PRASYARAT:
--   1. Ekstensi pg_net aktif (sudah — schema `net` ada).
--   2. Edge Function `send-invite` sudah di-deploy.
--
-- CARA PAKAI:
--   - Jalankan seluruh isi file ini di SQL Editor dashboard.
--   - Nilai anon key di bawah BUKAN rahasia (memang publik di app, sama dengan
--     NEXT_PUBLIC_SUPABASE_ANON_KEY dan pola migration 011).
-- ============================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_invite_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text := 'https://cvuqtwikykyhcaxyjqba.supabase.co/functions/v1/send-invite';
  -- anon key (publik, sama dengan NEXT_PUBLIC_SUPABASE_ANON_KEY). Diperlukan
  -- agar gateway Edge Function menerima panggilan.
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dXF0d2lreWt5aGNheHlqcWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTMxMjIsImV4cCI6MjEwMzU4OTEyMn0.eBvXKBjR_oDjBX3Ue2Z_Bglhd5qnV2A67qZV5D0tzUI';
begin
  perform net.http_post(
    url     := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body    := jsonb_build_object(
      'type', 'INSERT',
      'table', 'invite',
      'record', row_to_json(new),
      'old_record', null
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_invite on public.invite;
create trigger trg_notify_invite
  after insert on public.invite
  for each row
  execute function public.notify_invite_created();
