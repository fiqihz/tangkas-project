-- ============================================================================
-- Migration 008 — Aktifkan realtime BERFILTER (poin stabilisasi #7)
-- ============================================================================
-- Langganan realtime kita memakai filter `session_id=eq.<id>` (dan `id=eq.<id>`
-- untuk tabel session). Agar filter ini bekerja untuk INSERT/UPDATE/DELETE,
-- Postgres harus mengirim SEMUA kolom baris ke stream replikasi — bukan hanya
-- primary key. Itu butuh REPLICA IDENTITY FULL pada tabel yang dipantau.
--
-- Tanpa ini, event realtime berfilter bisa "SUBSCRIBED" tapi tidak pernah
-- terkirim (persis gejala yang kita temui: probe tanpa filter menerima event,
-- probe berfilter tidak).
--
-- Sekaligus memastikan tabel `session` masuk publication supabase_realtime
-- (schema.sql hanya menambahkan match/session_player/court).
--
-- Idempotent. Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

alter table match          replica identity full;
alter table session_player replica identity full;
alter table court          replica identity full;
alter table session        replica identity full;

-- Pastikan `session` ikut dipublikasikan untuk realtime (abaikan bila sudah ada).
do $$
begin
  begin
    alter publication supabase_realtime add table session;
  exception when others then null;
  end;
end $$;
