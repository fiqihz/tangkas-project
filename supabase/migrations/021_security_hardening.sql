-- ============================================================================
-- 021 — Security hardening (RLS match_set, role write, claim_legacy_data)
-- ============================================================================
-- Migration ini HANYA mengubah aturan akses (policy RLS) & hak eksekusi fungsi.
-- TIDAK ada INSERT/UPDATE/DELETE ke data, TIDAK ada ALTER kolom/tabel.
-- Semua perubahan dibungkus satu transaksi: kalau satu langkah gagal, semuanya
-- dibatalkan dan database kembali persis seperti sebelum dijalankan.
--
-- Yang diperbaiki:
--   1. match_set: sebelumnya `using (true)` untuk anon & authenticated → siapa
--      pun pemegang anon key bisa baca/ubah/hapus skor set komunitas mana saja.
--      Sekarang: baca = anggota community, tulis = owner/admin community.
--   2. Tabel data (player_profile, session, session_player, court, match):
--      sebelumnya tulis cukup `is_member`. Sekarang tulis wajib owner/admin,
--      supaya role `member` (read-only, belum dipakai) benar-benar read-only.
--      Owner & admin yang ada sekarang TIDAK terdampak.
--   3. Jaga-jaga: hapus policy permisif lama `<tabel>_all` bila pernah dipasang
--      ulang lewat supabase/schema.sql.
--   4. claim_legacy_data: cabut hak eksekusi dari anon/authenticated/public.
--      Tetap bisa dipanggil dari dalam create_community_with_owner (SECURITY
--      DEFINER, berjalan sebagai owner fungsi).
--
-- Tidak disentuh: community, membership, invite, feedback, semua RPC skor.
-- Edge Function (send-invite / notify-feedback) ditangani terpisah karena butuh
-- deploy kode + set secret, bukan cuma SQL.
--
-- ---------------------------------------------------------------------------
-- CEK SEBELUM JALAN (opsional, read-only — jalankan terpisah dulu):
--
--   -- a) Harus 0. Kalau > 0, user ber-role member akan kehilangan akses tulis.
--   select count(*) from membership where role = 'member';
--
--   -- b) Data lama yang belum diklaim. Kalau > 0, community BARU berikutnya
--   --    yang dibuat siapa pun akan mewarisinya (perilaku lama, tidak diubah
--   --    di sini) — sebaiknya klaim dulu ke community yang benar.
--   select
--     (select count(*) from player_profile where community_id = '00000000-0000-0000-0000-000000000001') as profiles,
--     (select count(*) from session        where community_id = '00000000-0000-0000-0000-000000000001') as sessions;
-- ---------------------------------------------------------------------------

begin;

-- ----------------------------------------------------------------------------
-- 1. Hapus policy permisif lama (idempoten)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['community','player_profile','session','session_player','court','match','match_set']
  loop
    execute format('drop policy if exists %I on %I;', t || '_all', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Tabel induk ber-community_id: player_profile, session
--    Baca = anggota; tulis = owner/admin.
--    (Policy permisif digabung OR: anggota lolos SELECT lewat *_read, tulis
--     hanya lolos lewat *_write.)
-- ----------------------------------------------------------------------------
drop policy if exists player_profile_rw    on player_profile;
drop policy if exists player_profile_read  on player_profile;
drop policy if exists player_profile_write on player_profile;
create policy player_profile_read on player_profile for select to authenticated
  using (public.is_member(community_id));
create policy player_profile_write on player_profile for all to authenticated
  using      (public.has_role(community_id, array['owner','admin']::membership_role[]))
  with check (public.has_role(community_id, array['owner','admin']::membership_role[]));

drop policy if exists session_rw    on session;
drop policy if exists session_read  on session;
drop policy if exists session_write on session;
create policy session_read on session for select to authenticated
  using (public.is_member(community_id));
create policy session_write on session for all to authenticated
  using      (public.has_role(community_id, array['owner','admin']::membership_role[]))
  with check (public.has_role(community_id, array['owner','admin']::membership_role[]));

-- ----------------------------------------------------------------------------
-- 3. Tabel anak via join ke session.community_id: session_player, court, match
-- ----------------------------------------------------------------------------
drop policy if exists session_player_rw    on session_player;
drop policy if exists session_player_read  on session_player;
drop policy if exists session_player_write on session_player;
create policy session_player_read on session_player for select to authenticated
  using (exists (select 1 from session s
                 where s.id = session_player.session_id
                   and public.is_member(s.community_id)));
create policy session_player_write on session_player for all to authenticated
  using (exists (select 1 from session s
                 where s.id = session_player.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])))
  with check (exists (select 1 from session s
                 where s.id = session_player.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])));

drop policy if exists court_rw    on court;
drop policy if exists court_read  on court;
drop policy if exists court_write on court;
create policy court_read on court for select to authenticated
  using (exists (select 1 from session s
                 where s.id = court.session_id
                   and public.is_member(s.community_id)));
create policy court_write on court for all to authenticated
  using (exists (select 1 from session s
                 where s.id = court.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])))
  with check (exists (select 1 from session s
                 where s.id = court.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])));

drop policy if exists match_rw    on match;
drop policy if exists match_read  on match;
drop policy if exists match_write on match;
create policy match_read on match for select to authenticated
  using (exists (select 1 from session s
                 where s.id = match.session_id
                   and public.is_member(s.community_id)));
create policy match_write on match for all to authenticated
  using (exists (select 1 from session s
                 where s.id = match.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])))
  with check (exists (select 1 from session s
                 where s.id = match.session_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])));

-- ----------------------------------------------------------------------------
-- 4. match_set (cucu): match_set → match → session.community_id
--    RPC finish_set_atomic & edit_match_sets_atomic (SECURITY INVOKER) tetap
--    jalan untuk owner/admin karena mereka lolos policy tulis ini.
-- ----------------------------------------------------------------------------
alter table match_set enable row level security;

drop policy if exists match_set_read  on match_set;
drop policy if exists match_set_write on match_set;
create policy match_set_read on match_set for select to authenticated
  using (exists (select 1 from match m join session s on s.id = m.session_id
                 where m.id = match_set.match_id
                   and public.is_member(s.community_id)));
create policy match_set_write on match_set for all to authenticated
  using (exists (select 1 from match m join session s on s.id = m.session_id
                 where m.id = match_set.match_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])))
  with check (exists (select 1 from match m join session s on s.id = m.session_id
                 where m.id = match_set.match_id
                   and public.has_role(s.community_id, array['owner','admin']::membership_role[])));

-- ----------------------------------------------------------------------------
-- 5. claim_legacy_data: hanya boleh dipanggil dari create_community_with_owner
-- ----------------------------------------------------------------------------
revoke execute on function public.claim_legacy_data(uuid) from public;
revoke execute on function public.claim_legacy_data(uuid) from anon;
revoke execute on function public.claim_legacy_data(uuid) from authenticated;

commit;

-- ---------------------------------------------------------------------------
-- CEK SESUDAH JALAN (read-only):
--
--   -- Daftar policy tabel data. Tidak boleh ada lagi *_all atau *_rw.
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('player_profile','session','session_player','court','match','match_set')
--   order by tablename, policyname;
--
--   -- Harus false untuk anon & authenticated.
--   select has_function_privilege('anon',          'public.claim_legacy_data(uuid)', 'execute') as anon_can,
--          has_function_privilege('authenticated', 'public.claim_legacy_data(uuid)', 'execute') as auth_can;
-- ---------------------------------------------------------------------------
