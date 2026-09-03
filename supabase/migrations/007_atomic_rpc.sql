-- ============================================================================
-- Migration 007 — RPC ATOMIK (poin stabilisasi #4)
-- ============================================================================
-- Mengganti operasi multi-write non-atomik di client (yang rawan korup saat
-- dua device menulis bersamaan) dengan function Postgres yang berjalan dalam
-- SATU transaksi. Kalau ada bagian yang gagal, seluruh perubahan dibatalkan
-- (rollback) — tidak ada lagi "match selesai tapi statistik sebagian pemain
-- tidak ter-update".
--
-- Semua function SECURITY INVOKER (default) sehingga tetap tunduk pada RLS.
-- Idempotent: pakai CREATE OR REPLACE.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- finish_match_atomic
-- ----------------------------------------------------------------------------
-- Menyelesaikan sebuah match DAN meng-update statistik 4 pemainnya sekaligus.
-- Statistik dihitung DI DALAM DB dari kolom tim match (bukan dari snapshot
-- client yang bisa basi). Aman dipanggil ulang? TIDAK — memanggil dua kali
-- akan menambah statistik dua kali. Client harus memanggil sekali per match.
-- Guard: hanya memproses match yang belum 'finished' agar dobel-panggil
-- (mis. akibat retry) tidak menggandakan statistik.
create or replace function finish_match_atomic(
  p_match_id uuid,
  p_score_a  int,
  p_score_b  int,
  p_winner   text
) returns void
language plpgsql
as $$
declare
  m match%rowtype;
begin
  if p_winner not in ('a','b','draw') then
    raise exception 'winner tidak valid: %', p_winner;
  end if;

  -- Kunci baris match; abaikan bila sudah finished (idempoten terhadap retry).
  select * into m from match where id = p_match_id for update;
  if not found then
    raise exception 'match % tidak ditemukan', p_match_id;
  end if;
  if m.state = 'finished' then
    return; -- sudah diproses; jangan gandakan statistik
  end if;

  update match
     set state = 'finished',
         score_a = p_score_a,
         score_b = p_score_b,
         winner = p_winner,
         finished_at = now()
   where id = p_match_id;

  -- Tim A
  update session_player sp
     set games_played      = sp.games_played + 1,
         last_played_round  = m.round,
         wins               = sp.wins   + (case when p_winner = 'a' then 1 else 0 end),
         losses             = sp.losses + (case when p_winner = 'b' then 1 else 0 end),
         draws              = sp.draws  + (case when p_winner = 'draw' then 1 else 0 end),
         points_scored      = sp.points_scored   + p_score_a,
         points_conceded    = sp.points_conceded + p_score_b
   where sp.id in (m.team_a_p1, m.team_a_p2);

  -- Tim B
  update session_player sp
     set games_played      = sp.games_played + 1,
         last_played_round  = m.round,
         wins               = sp.wins   + (case when p_winner = 'b' then 1 else 0 end),
         losses             = sp.losses + (case when p_winner = 'a' then 1 else 0 end),
         draws              = sp.draws  + (case when p_winner = 'draw' then 1 else 0 end),
         points_scored      = sp.points_scored   + p_score_b,
         points_conceded    = sp.points_conceded + p_score_a
   where sp.id in (m.team_b_p1, m.team_b_p2);
end;
$$;

-- ----------------------------------------------------------------------------
-- create_match_atomic
-- ----------------------------------------------------------------------------
-- Membuat match 'proposed' DAN menaikkan session.current_round dalam satu
-- transaksi. Nomor ronde dihitung DI DALAM DB (current_round + 1) sehingga dua
-- device yang membuat match hampir bersamaan tidak mendapat nomor ronde yang
-- sama (race yang sebelumnya mungkin terjadi karena baca current_round lokal).
-- Mengembalikan baris match yang baru dibuat.
create or replace function create_match_atomic(
  p_session_id  uuid,
  p_court_id    uuid,
  p_court_label text,
  p_team_a_p1   uuid,
  p_team_a_p2   uuid,
  p_team_b_p1   uuid,
  p_team_b_p2   uuid,
  p_state       text default 'proposed'
) returns match
language plpgsql
as $$
declare
  v_round int;
  v_row   match%rowtype;
begin
  if p_state not in ('proposed','playing') then
    raise exception 'state awal tidak valid: %', p_state;
  end if;

  -- Kunci baris session lalu naikkan ronde secara atomik.
  update session
     set current_round = current_round + 1
   where id = p_session_id
  returning current_round into v_round;

  if v_round is null then
    raise exception 'session % tidak ditemukan', p_session_id;
  end if;

  insert into match (
    session_id, court_id, court_label, round,
    team_a_p1, team_a_p2, team_b_p1, team_b_p2, state
  ) values (
    p_session_id, p_court_id, p_court_label, v_round,
    p_team_a_p1, p_team_a_p2, p_team_b_p1, p_team_b_p2, p_state
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- finish_session_atomic
-- ----------------------------------------------------------------------------
-- Menandai sesi 'finished' DAN menambah sessions_played (+1) untuk semua
-- profil yang pemainnya benar-benar main (games_played > 0) — dalam satu
-- transaksi. Guard: hanya memproses bila sesi belum finished, agar retry /
-- dobel-panggil tidak menggandakan counter "ikut mabar".
create or replace function finish_session_atomic(
  p_session_id uuid
) returns void
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from session where id = p_session_id for update;
  if not found then
    raise exception 'session % tidak ditemukan', p_session_id;
  end if;
  if v_status = 'finished' then
    return; -- sudah selesai; jangan gandakan sessions_played
  end if;

  update player_profile pp
     set sessions_played = pp.sessions_played + 1
   where pp.id in (
     select distinct sp.profile_id
       from session_player sp
      where sp.session_id = p_session_id
        and sp.profile_id is not null
        and sp.games_played > 0
   );

  update session
     set status = 'finished',
         finished_at = now()
   where id = p_session_id;
end;
$$;
