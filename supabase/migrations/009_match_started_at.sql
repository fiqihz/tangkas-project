-- ============================================================================
-- Migration 009 — Tambah kolom match.started_at (timer per match akurat)
-- ============================================================================
-- Menyimpan waktu match BENAR-BENAR dimulai (saat host menekan "Mulai Main",
-- yaitu state berubah menjadi 'playing') — terpisah dari created_at yang
-- mencatat kapan preview/match dibuat. Dipakai untuk menampilkan timer durasi
-- match yang sedang berjalan.
--
-- Nullable & tidak merusak data lama. Idempotent.
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

alter table match
  add column if not exists started_at timestamptz;
