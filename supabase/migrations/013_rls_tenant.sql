-- ============================================================================
-- 013 — RLS KETAT PER-COMMUNITY (Fase 2: Auth + Multi-Tenant)
-- ============================================================================
-- Mengganti policy permisif `anon using(true)` warisan migration 000 dengan RLS
-- ketat berbasis keanggotaan (membership). Isi file dibagi menjadi beberapa
-- bagian yang saling melengkapi dan di-apply sebagai satu migrasi:
--
--   BAGIAN 1: HELPER FUNCTIONS   — helper SECURITY DEFINER anti-rekursi RLS.
--   BAGIAN 2: DROP + ENABLE RLS  — hapus policy permisif lama, enable RLS.
--   BAGIAN 3-7: POLICY PER-TABEL — policy per-tabel berbasis keanggotaan.
--
-- Desain mengikuti bagian "RLS Design" pada design.md.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- (Penerapan migrasi dilakukan manual oleh user; file ini hanya definisi SQL.)
--
-- Semua fungsi memakai `create or replace` agar idempoten (aman di-run ulang).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BAGIAN 1: HELPER FUNCTIONS (hindari rekursi RLS)
-- ----------------------------------------------------------------------------
-- Policy pada `membership` yang menanyakan `membership` bisa memicu rekursi RLS.
-- Solusi: helper `SECURITY DEFINER` yang membaca `membership` di luar konteks
-- RLS pemanggil. `stable` karena hasil bergantung pada state DB + `auth.uid()`
-- dalam satu statement. `set search_path = public` mengunci resolusi nama objek.

-- is_member: apakah user login (auth.uid()) anggota community `target`.
create or replace function public.is_member(target uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from membership
    where community_id = target and user_id = auth.uid()
  );
$$;

-- has_role: apakah user login (auth.uid()) punya salah satu role di community
-- `target` (mis. owner/admin). `roles` adalah array `membership_role`.
create or replace function public.has_role(target uuid, roles membership_role[])
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from membership
    where community_id = target and user_id = auth.uid() and role = any(roles)
  );
$$;

-- ----------------------------------------------------------------------------
-- BAGIAN 2: DROP POLICY PERMISIF LAMA & ENABLE RLS  (Task 2.2)
-- ----------------------------------------------------------------------------
-- Migration 000 membuat satu policy permisif per tabel bernama `<tabel>_all`
-- (`create policy <tabel>_all ... for all to anon, authenticated using(true)`)
-- lewat loop `do $$ ... foreach ... $$`. Di sini kita menghapusnya dengan pola
-- loop yang sama sehingga nama policy cocok persis (idempoten via `if exists`).

-- 1. Hapus policy permisif anon lama (dibuat di migration 000).
do $$
declare t text;
begin
  foreach t in array array['community','player_profile','session','session_player','court','match']
  loop
    execute format('drop policy if exists %I on %I;', t || '_all', t);
  end loop;
end $$;

-- 2. Aktifkan RLS pada tabel baru (membership & invite dari migration 012).
alter table membership enable row level security;
alter table invite     enable row level security;

-- ----------------------------------------------------------------------------
-- BAGIAN 3-7: POLICY PER-TABEL BERBASIS KEANGGOTAAN  (Task 2.3)
-- ----------------------------------------------------------------------------
-- Pola predikat (design.md → RLS Design → Pola predikat):
--   * Tabel induk ber-community_id (community, player_profile, session):
--       using/with check (public.is_member(community_id)).
--   * Tabel anak (session_player, court, match) tanpa community_id → join ke
--       session: exists (select 1 from session s where s.id = <t>.session_id
--       and public.is_member(s.community_id)).
--   * Semua write dibatasi role `authenticated` (to authenticated).
-- Operasi yang harus menembus RLS (INSERT community pertama, tulis membership,
-- tukar invite) dijalankan lewat RPC SECURITY DEFINER — jadi tidak ada policy
-- tulis langsung untuk role authenticated pada objek tersebut.
--
-- Setiap policy didahului `drop policy if exists` agar migrasi idempoten
-- (aman di-run ulang).

-- 3. community: anggota boleh baca; owner boleh hapus; update untuk owner/admin.
drop policy if exists community_select on community;
create policy community_select on community for select to authenticated
  using (public.is_member(id));

drop policy if exists community_delete on community;
create policy community_delete on community for delete to authenticated
  using (public.has_role(id, array['owner']::membership_role[]));

drop policy if exists community_update on community;
create policy community_update on community for update to authenticated
  using (public.has_role(id, array['owner','admin']::membership_role[]));
-- INSERT community: lewat RPC SECURITY DEFINER (create_community_with_owner),
-- jadi tidak ada policy INSERT untuk authenticated di sini.

-- 4. player_profile & session (tabel induk ber-community_id).
drop policy if exists player_profile_rw on player_profile;
create policy player_profile_rw on player_profile for all to authenticated
  using (public.is_member(community_id))
  with check (public.is_member(community_id));

drop policy if exists session_rw on session;
create policy session_rw on session for all to authenticated
  using (public.is_member(community_id))
  with check (public.is_member(community_id));

-- 5. Tabel anak via join ke session.community_id.
drop policy if exists session_player_rw on session_player;
create policy session_player_rw on session_player for all to authenticated
  using (exists (select 1 from session s where s.id = session_player.session_id and public.is_member(s.community_id)))
  with check (exists (select 1 from session s where s.id = session_player.session_id and public.is_member(s.community_id)));

drop policy if exists court_rw on court;
create policy court_rw on court for all to authenticated
  using (exists (select 1 from session s where s.id = court.session_id and public.is_member(s.community_id)))
  with check (exists (select 1 from session s where s.id = court.session_id and public.is_member(s.community_id)));

drop policy if exists match_rw on match;
create policy match_rw on match for all to authenticated
  using (exists (select 1 from session s where s.id = match.session_id and public.is_member(s.community_id)))
  with check (exists (select 1 from session s where s.id = match.session_id and public.is_member(s.community_id)));

-- 6. membership: user hanya lihat baris community tempat ia anggota.
drop policy if exists membership_select on membership;
create policy membership_select on membership for select to authenticated
  using (public.is_member(community_id));
-- INSERT/UPDATE/DELETE membership lewat RPC SECURITY DEFINER (owner-only) →
-- tidak ada policy tulis langsung untuk authenticated.

-- 7. invite: hanya owner community yang lihat/kelola.
drop policy if exists invite_select on invite;
create policy invite_select on invite for select to authenticated
  using (public.has_role(community_id, array['owner']::membership_role[]));

drop policy if exists invite_insert on invite;
create policy invite_insert on invite for insert to authenticated
  with check (public.has_role(community_id, array['owner']::membership_role[]) and role = 'admin');
-- Penukaran invite lewat RPC redeem_invite (SECURITY DEFINER), bukan tulis langsung.
