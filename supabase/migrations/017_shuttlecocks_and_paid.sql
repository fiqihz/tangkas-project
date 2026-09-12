-- ============================================================================
-- Migration 017 — Perhitungan kok (shuttlecock) & status bayar pemain
-- ============================================================================
-- Poin 5 (feedback host):
--   1. session.track_shuttlecocks : flag per-mabar. Bila true, host mencatat
--      jumlah kok yang dipakai tiap match (saat Finish). Default false —
--      banyak mabar harga lapangan sudah termasuk kok, jadi fitur ini opt-in.
--   2. match.shuttlecocks          : jumlah kok yang dipakai di sebuah match
--      (per biji). Default 0; UI mengisi 1 sebagai nilai awal saat toggle aktif.
--   3. session_player.paid         : status bayar pemain (lunas / belum).
--      Selalu ada (tidak ikut toggle di atas). Default false.
--
-- Semua kolom punya default & tidak merusak data lama — aman walau kode
-- di-rollback. Idempotent.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

alter table session
  add column if not exists track_shuttlecocks boolean not null default false;

alter table match
  add column if not exists shuttlecocks integer not null default 0;

alter table session_player
  add column if not exists paid boolean not null default false;

-- ----------------------------------------------------------------------------
-- finish_match_atomic — tambah parameter p_shuttlecocks
-- ----------------------------------------------------------------------------
-- Sama seperti sebelumnya (set match finished + update statistik 4 pemain),
-- ditambah menyimpan jumlah kok yang dipakai di match tsb. Parameter baru
-- diberi DEFAULT 0 agar pemanggil lama (tanpa kok) tetap kompatibel.
create or replace function finish_match_atomic(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_winner       text,
  p_shuttlecocks int default 0
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
         shuttlecocks = greatest(0, coalesce(p_shuttlecocks, 0)),
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
