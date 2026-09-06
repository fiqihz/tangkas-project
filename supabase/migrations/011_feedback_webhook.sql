-- ============================================================================
-- 011 — TRIGGER NOTIFIKASI FEEDBACK (bypass UI Webhooks)
-- ============================================================================
-- Alternatif untuk fitur "Database Webhooks" di dashboard yang gagal dibuat
-- karena schema `supabase_functions` tidak ter-provision di project ini
-- (query pg_namespace mengonfirmasi: hanya ada `net` & `extensions`).
--
-- Pendekatan: trigger AFTER INSERT pada `feedback` yang memanggil Edge Function
-- `notify-feedback` langsung via pg_net (`net.http_post`). Hanya butuh ekstensi
-- pg_net (sudah aktif), TIDAK butuh schema supabase_functions.
--
-- PRASYARAT:
--   1. Ekstensi pg_net aktif (sudah — schema `net` ada).
--   2. Edge Function `notify-feedback` sudah di-deploy.
--
-- CARA PAKAI:
--   - Jika kamu TIDAK set WEBHOOK_SECRET: biarkan file ini apa adanya lalu Run.
--   - Jika kamu SET WEBHOOK_SECRET: ganti '' pada `webhook_secret` dengan
--     nilainya. Nilai anon key di bawah BUKAN rahasia (memang publik di app).
--   Jalankan seluruh isi file ini di SQL Editor dashboard.
-- ============================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_feedback_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text := 'https://cvuqtwikykyhcaxyjqba.supabase.co/functions/v1/notify-feedback';
  -- anon key (publik, sama dengan NEXT_PUBLIC_SUPABASE_ANON_KEY). Diperlukan
  -- agar gateway Edge Function menerima panggilan.
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dXF0d2lreWt5aGNheHlqcWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTMxMjIsImV4cCI6MjEwMzU4OTEyMn0.eBvXKBjR_oDjBX3Ue2Z_Bglhd5qnV2A67qZV5D0tzUI';
  -- Kosongkan '' bila tidak memakai WEBHOOK_SECRET.
  webhook_secret text := '';
begin
  perform net.http_post(
    url     := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-webhook-secret', webhook_secret
    ),
    body    := jsonb_build_object(
      'type', 'INSERT',
      'table', 'feedback',
      'record', row_to_json(new),
      'old_record', null
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_feedback on public.feedback;
create trigger trg_notify_feedback
  after insert on public.feedback
  for each row
  execute function public.notify_feedback_created();
