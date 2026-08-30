-- ============================================================================
-- Migration 002 — Tambah state 'unfinished' pada match
-- ============================================================================
-- State machine match:
--   proposed   = pemain sudah diisi/di-generate, belum mulai dipukul
--   playing    = sedang berlangsung
--   finished   = selesai + skor tercatat
--   unfinished = dibatalkan saat sedang berlangsung (mis. lapangan dihapus)
--                -> tetap masuk history tanpa skor
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run. Idempotent.
-- ============================================================================

alter table match drop constraint if exists match_state_check;
alter table match
  add constraint match_state_check
  check (state in ('proposed','playing','finished','unfinished'));
