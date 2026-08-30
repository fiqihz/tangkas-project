-- ============================================================================
-- Migration 003 — Multi-sesi: status scheduled/ongoing/finished + scheduled_at
-- ============================================================================
-- Status sesi:
--   scheduled = dijadwalkan, belum mulai (boleh pra-daftar pemain)
--   ongoing   = sedang berjalan (maksimal 1 dalam satu waktu)
--   finished  = sudah SELESAI MABAR (bisa di-reactivate -> ongoing)
--
-- Migrasi data lama: status 'active' -> 'ongoing'.
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run. Idempotent.
-- ============================================================================

-- 1. Tambah kolom scheduled_at (waktu jadwal mabar)
alter table session
  add column if not exists scheduled_at timestamptz;

-- 2. Longgarkan constraint dulu agar bisa update nilai lama
alter table session drop constraint if exists session_status_check;

-- 3. Migrasi data lama 'active' -> 'ongoing'
update session set status = 'ongoing' where status = 'active';

-- 4. Ubah default + pasang constraint baru
alter table session alter column status set default 'ongoing';
alter table session
  add constraint session_status_check
  check (status in ('scheduled','ongoing','finished'));
