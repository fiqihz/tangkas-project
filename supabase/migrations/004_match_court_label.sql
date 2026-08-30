-- ============================================================================
-- Migration 004 — Snapshot nama lapangan di match (untuk History)
-- ============================================================================
-- Menyimpan label lapangan pada match agar history tetap menampilkan nama
-- lapangan walaupun court sudah dihapus (court_id jadi null saat court dihapus).
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run. Idempotent.
-- ============================================================================

alter table match
  add column if not exists court_label text;

-- Isi label untuk match lama dari court yang masih ada (best effort).
update match m
set court_label = c.label
from court c
where m.court_id = c.id
  and m.court_label is null;
