-- ============================================================================
-- Migration 006 — Gender pemain (untuk mode match campuran & ganda putri)
-- ============================================================================
-- gender: 'male' | 'female' | null (belum di-set). Di-set manual seperti level.
-- Nullable & tidak merusak fitur lama — aman walau kode di-rollback.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run. Idempotent.
-- ============================================================================

alter table player_profile
  add column if not exists gender text
  check (gender in ('male','female'));

alter table session_player
  add column if not exists gender text
  check (gender in ('male','female'));
