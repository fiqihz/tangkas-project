-- ============================================================================
-- Migration 019 — Carry-over kok (shuttlecock) antar set
-- ============================================================================
-- Perbaikan perilaku pencatatan kok pada match multi-set.
--
-- Masalah (migration 018): finish_set_atomic hanya menulis match.shuttlecocks
-- saat match DIPUTUS (set terakhir). Untuk set-set sebelumnya, angka kok yang
-- diisi host dibuang. Akibatnya dialog set berikutnya kehilangan konteks &
-- total kok akhir hanya mencerminkan input set terakhir.
--
-- Perbaikan: kok bersifat KUMULATIF (carry-over). Nilai `p_shuttlecocks` yang
-- dikirim tiap set adalah TOTAL kok berjalan sampai set itu. finish_set_atomic
-- kini menyimpan match.shuttlecocks di SETIAP set (baik saat match belum
-- diputus maupun saat finished), sehingga dialog set berikutnya bisa memuat
-- nilai tersimpan sebagai default dan host tinggal menambah.
--
-- Hanya mengganti definisi fungsi (CREATE OR REPLACE). Tidak ada perubahan
-- skema/data. Idempotent.
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

create or replace function finish_set_atomic(
  p_match_id     uuid,
  p_score_a      int,
  p_score_b      int,
  p_shuttlecocks int default 0
) returns void
language plpgsql
as $$
declare
  m            match%rowtype;
  v_target     int;
  v_next_set   int;
  v_sets_a     int;
  v_sets_b     int;
  v_played     int;
  v_sets_to_win int;
  v_total_a    int;
  v_total_b    int;
  v_winner     text;
  v_cocks      int := greatest(0, coalesce(p_shuttlecocks, 0));
begin
  if p_score_a < 0 or p_score_b < 0 then
    raise exception 'skor set tidak boleh negatif';
  end if;
  if p_score_a = p_score_b then
    raise exception 'satu set tidak boleh imbang (%-%): harus ada pemenang', p_score_a, p_score_b;
  end if;

  -- Kunci baris match; abaikan bila sudah finished (idempoten terhadap retry).
  select * into m from match where id = p_match_id for update;
  if not found then
    raise exception 'match % tidak ditemukan', p_match_id;
  end if;
  if m.state = 'finished' then
    return; -- sudah diproses; jangan gandakan statistik
  end if;

  -- Ambil format set dari session (default 1 bila null).
  select coalesce(sets_target, 1) into v_target
    from session where id = m.session_id;
  if v_target is null then
    v_target := 1;
  end if;
  v_sets_to_win := (v_target / 2) + 1; -- floor div: BoF1=1, BoF2=2, BoF3=2

  -- Nomor set berikutnya = jumlah set yang sudah tercatat + 1.
  select coalesce(max(set_no), 0) + 1 into v_next_set
    from match_set where match_id = p_match_id;

  -- Bila set berikutnya melebihi target, match seharusnya sudah selesai.
  if v_next_set > v_target then
    raise exception 'match % sudah mencapai jumlah set maksimum (%).', p_match_id, v_target;
  end if;

  -- Catat set ini.
  insert into match_set (match_id, set_no, score_a, score_b)
  values (p_match_id, v_next_set, p_score_a, p_score_b);

  -- Rekap seluruh set match ini.
  select
    count(*) filter (where score_a > score_b),
    count(*) filter (where score_b > score_a),
    count(*),
    coalesce(sum(score_a), 0),
    coalesce(sum(score_b), 0)
  into v_sets_a, v_sets_b, v_played, v_total_a, v_total_b
  from match_set where match_id = p_match_id;

  -- Belum diputus: pastikan state 'playing' & SIMPAN kok berjalan (carry-over).
  -- Kok bersifat kumulatif: nilai yang dikirim tiap set adalah TOTAL berjalan;
  -- dialog set berikutnya memuat nilai ini sebagai default. Statistik pemain
  -- belum disentuh (baru di-apply saat match finished).
  if v_sets_a < v_sets_to_win and v_sets_b < v_sets_to_win and v_played < v_target then
    update match
       set state = 'playing',
           shuttlecocks = v_cocks
     where id = p_match_id;
    return;
  end if;

  -- Diputus: tentukan pemenang match (mayoritas set; imbang => draw).
  if v_sets_a > v_sets_b then
    v_winner := 'a';
  elsif v_sets_b > v_sets_a then
    v_winner := 'b';
  else
    v_winner := 'draw';
  end if;

  -- Simpan AGREGAT ke match + set finished.
  update match
     set state       = 'finished',
         score_a     = v_total_a,
         score_b     = v_total_b,
         winner      = v_winner,
         shuttlecocks = v_cocks,
         finished_at = now()
   where id = p_match_id;

  -- Tim A — statistik dari agregat total poin semua set.
  update session_player sp
     set games_played     = sp.games_played + 1,
         last_played_round = m.round,
         wins              = sp.wins   + (case when v_winner = 'a' then 1 else 0 end),
         losses            = sp.losses + (case when v_winner = 'b' then 1 else 0 end),
         draws             = sp.draws  + (case when v_winner = 'draw' then 1 else 0 end),
         points_scored     = sp.points_scored   + v_total_a,
         points_conceded   = sp.points_conceded + v_total_b
   where sp.id in (m.team_a_p1, m.team_a_p2);

  -- Tim B
  update session_player sp
     set games_played     = sp.games_played + 1,
         last_played_round = m.round,
         wins              = sp.wins   + (case when v_winner = 'b' then 1 else 0 end),
         losses            = sp.losses + (case when v_winner = 'a' then 1 else 0 end),
         draws             = sp.draws  + (case when v_winner = 'draw' then 1 else 0 end),
         points_scored     = sp.points_scored   + v_total_b,
         points_conceded   = sp.points_conceded + v_total_a
   where sp.id in (m.team_b_p1, m.team_b_p2);
end;
$$;
