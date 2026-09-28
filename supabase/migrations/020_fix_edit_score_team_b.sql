-- ============================================================================
-- Migration 020 — Fix W/L tim B di edit_match_sets_atomic + backfill statistik
-- ============================================================================
-- Bug (migration 018): saat edit skor membalik pemenang, update tim B memakai
-- tanda terbalik:
--     wins   = sp.wins   - d_loss_a   -- salah
--     losses = sp.losses - d_win_a    -- salah
-- Contoh: pemenang A -> B  =>  d_win_a = -1, d_loss_a = +1.
--   Tim A: wins -1, losses +1 (benar)
--   Tim B: wins -1, losses +1 (SALAH, harusnya wins +1, losses -1)
-- Akibatnya kolom M/K leaderboard rusak (bisa minus, total M != total K).
--
-- Perbaikan:
--   1. Ganti fungsi: tim B pakai wins + d_loss_a, losses + d_win_a.
--   2. Backfill: hitung ulang wins/losses/draws session_player dari match
--      yang sudah finished (sumber kebenaran), supaya sesi yang telanjur
--      rusak ikut beres. Poin tidak disentuh (delta poin di 018 sudah benar).
--
-- Idempotent. Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

create or replace function edit_match_sets_atomic(
  p_match_id uuid,
  p_sets     jsonb
) returns void
language plpgsql
as $$
declare
  m             match%rowtype;
  v_target      int;
  v_sets_to_win int;
  v_n           int;
  v_i           int;
  v_a           int;
  v_b           int;
  old_total_a   int;
  old_total_b   int;
  old_winner    text;
  new_total_a   int := 0;
  new_total_b   int := 0;
  new_sets_a    int := 0;
  new_sets_b    int := 0;
  new_winner    text;
  d_win_a  int; d_loss_a int; d_draw_a int;
begin
  select * into m from match where id = p_match_id for update;
  if not found then
    raise exception 'match % tidak ditemukan', p_match_id;
  end if;
  if m.state <> 'finished' then
    raise exception 'hanya match yang sudah selesai yang bisa diedit skornya';
  end if;

  v_n := jsonb_array_length(p_sets);
  if v_n is null or v_n < 1 then
    raise exception 'daftar set kosong';
  end if;

  select coalesce(sets_target, 1) into v_target from session where id = m.session_id;
  if v_target is null then v_target := 1; end if;
  v_sets_to_win := (v_target / 2) + 1;
  if v_n > v_target then
    raise exception 'jumlah set (%) melebihi format mabar (%).', v_n, v_target;
  end if;

  for v_i in 0 .. v_n - 1 loop
    v_a := (p_sets -> v_i ->> 'a')::int;
    v_b := (p_sets -> v_i ->> 'b')::int;
    if v_a is null or v_b is null or v_a < 0 or v_b < 0 then
      raise exception 'skor set % tidak valid', v_i + 1;
    end if;
    if v_a = v_b then
      raise exception 'set % tidak boleh imbang', v_i + 1;
    end if;
    new_total_a := new_total_a + v_a;
    new_total_b := new_total_b + v_b;
    if v_a > v_b then new_sets_a := new_sets_a + 1; else new_sets_b := new_sets_b + 1; end if;
  end loop;

  if new_sets_a > new_sets_b then new_winner := 'a';
  elsif new_sets_b > new_sets_a then new_winner := 'b';
  else new_winner := 'draw';
  end if;

  old_total_a := coalesce(m.score_a, 0);
  old_total_b := coalesce(m.score_b, 0);
  old_winner  := m.winner;

  delete from match_set where match_id = p_match_id;
  for v_i in 0 .. v_n - 1 loop
    v_a := (p_sets -> v_i ->> 'a')::int;
    v_b := (p_sets -> v_i ->> 'b')::int;
    insert into match_set (match_id, set_no, score_a, score_b)
    values (p_match_id, v_i + 1, v_a, v_b);
  end loop;

  update match
     set score_a = new_total_a,
         score_b = new_total_b,
         winner  = new_winner
   where id = p_match_id;

  -- Delta W/L/D dari sudut pandang tim A.
  d_win_a  := (case when new_winner = 'a' then 1 else 0 end) - (case when old_winner = 'a' then 1 else 0 end);
  d_loss_a := (case when new_winner = 'b' then 1 else 0 end) - (case when old_winner = 'b' then 1 else 0 end);
  d_draw_a := (case when new_winner = 'draw' then 1 else 0 end) - (case when old_winner = 'draw' then 1 else 0 end);

  update session_player sp
     set points_scored   = sp.points_scored   + (new_total_a - old_total_a),
         points_conceded = sp.points_conceded + (new_total_b - old_total_b),
         wins   = sp.wins   + d_win_a,
         losses = sp.losses + d_loss_a,
         draws  = sp.draws  + d_draw_a
   where sp.id in (m.team_a_p1, m.team_a_p2);

  -- Tim B: menang-nya tim B = kalah-nya tim A, dan sebaliknya (tanda TAMBAH).
  update session_player sp
     set points_scored   = sp.points_scored   + (new_total_b - old_total_b),
         points_conceded = sp.points_conceded + (new_total_a - old_total_a),
         wins   = sp.wins   + d_loss_a,
         losses = sp.losses + d_win_a,
         draws  = sp.draws  + d_draw_a
   where sp.id in (m.team_b_p1, m.team_b_p2);
end;
$$;

-- ----------------------------------------------------------------------------
-- Backfill: hitung ulang W/L/D tiap session_player dari match finished.
-- ----------------------------------------------------------------------------
with slots as (
  select m.team_a_p1 as pid, 'a' as side, m.winner from match m where m.state = 'finished' and m.winner is not null
  union all
  select m.team_a_p2, 'a', m.winner from match m where m.state = 'finished' and m.winner is not null
  union all
  select m.team_b_p1, 'b', m.winner from match m where m.state = 'finished' and m.winner is not null
  union all
  select m.team_b_p2, 'b', m.winner from match m where m.state = 'finished' and m.winner is not null
),
agg as (
  select pid,
         count(*) filter (where winner = side)                        as w,
         count(*) filter (where winner <> side and winner <> 'draw')  as l,
         count(*) filter (where winner = 'draw')                      as d
    from slots
   where pid is not null
   group by pid
)
update session_player sp
   set wins   = coalesce(agg.w, 0),
       losses = coalesce(agg.l, 0),
       draws  = coalesce(agg.d, 0)
  from session_player sp2
  left join agg on agg.pid = sp2.id
 where sp.id = sp2.id
   and (sp.wins, sp.losses, sp.draws)
       is distinct from (coalesce(agg.w, 0), coalesce(agg.l, 0), coalesce(agg.d, 0));
