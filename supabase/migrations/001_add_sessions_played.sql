-- ============================================================================
-- Migration 001 — Tambah kolom sessions_played di player_profile
-- ============================================================================
-- Menyimpan berapa kali seorang pemain sudah ikut mabar (main >= 1 game).
-- Di-increment saat host menekan SELESAI MABAR.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- Aman dijalankan berulang (idempotent).
-- ============================================================================

alter table player_profile
  add column if not exists sessions_played int not null default 0;
