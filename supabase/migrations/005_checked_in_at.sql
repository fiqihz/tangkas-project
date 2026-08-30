-- ============================================================================
-- Migration 005 — Waktu check-in pemain (untuk sort "first come first play")
-- ============================================================================
-- Menyimpan kapan pemain pertama kali di-set Active (check-in) agar daftar
-- pemain Active bisa diurutkan berdasarkan urutan kedatangan.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run. Idempotent.
-- ============================================================================

alter table session_player
  add column if not exists checked_in_at timestamptz;
