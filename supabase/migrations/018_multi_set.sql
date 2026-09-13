-- ============================================================================
-- Migration 018 — Multi-set (Best of 1 / 2 / 3) per match
-- ============================================================================
-- Host memilih format saat membuat mabar: 1, 2, atau 3 set (session.sets_target).
-- Skor diisi PER SET (input begitu satu set selesai). Match baru dianggap
-- 'finished' ketika salah satu tim memenangkan mayoritas set, ATAU seluruh set
-- (sets_target) sudah dimainkan. Selama belum tercapai, match tetap 'playing'.
--
-- Pemenang match = mayoritas set menang; set imbang total (mis. Best of 2 -> 1-1)
-- => winner 'draw'. Poin leaderboard = TOTAL poin semua set (skema existing);
-- selisih total jadi tie-break. Satu SET individual TIDAK boleh imbang (dijaga
-- di RPC finish_set_atomic).
--
-- match.score_a / score_b / winner tetap dipakai sebagai AGREGAT (total poin +
-- pemenang akhir) sehingga leaderboard, history lintas-mabar, dan konsumen lama
-- tidak perlu berubah. Detail per-set disimpan di tabel baru match_set.
--
-- Idempotent & aman terhadap data lama (sets_target default 1; mabar lama =
-- Best of 1, match lama tetap terbaca dari score_a/score_b walau match_set kosong).
--
-- Cara pakai: Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. session.sets_target — format jumlah set (1/2/3)
-- ----------------------------------------------------------------------------
alter table session
  add column if not exists sets_target int not null default 1
  check (sets_target in (1, 2, 3));

-- ----------------------------------------------------------------------------
-- 2. match_set — satu baris per set dari sebuah match
-- ----------------------------------------------------------------------------
create table if not exists match_set (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references match(id) on delete cascade,
  set_no     int not null check (set_no >= 1),
  score_a    int not null check (score_a >= 0),
  score_b    int not null check (score_b >= 0),
  created_at timestamptz not null default now(),
  -- Cegah dobel set_no untuk match yang sama (mis. dobel-tap "Selesai Set").
  unique (match_id, set_no)
);
create index if not exists idx_match_set_match on match_set(match_id);

-- RLS: selaras dengan tabel lain (Opsi B — allow all untuk anon & authenticated).
alter table match_set enable row level security;
do $$
begin
  drop policy if exists match_set_all on match_set;
  create policy match_set_all on match_set
    for all to anon, authenticated using (true) with check (true);
end $$;

-- ----------------------------------------------------------------------------
-- 3. finish_set_atomic — catat satu set & finalisasi match bila sudah diputus
-- ----------------------------------------------------------------------------
-- Menambahkan satu baris match_set (set berikutnya) DAN, bila match sudah
-- diputus, menyelesaikan match + update statistik 4 pemain — semua dalam SATU
-- transaksi. Statistik hanya di-apply SEKALI (saat match jadi 'finished').
--
-- Aturan diputus:
--   * setsToWin = floor(sets_target / 2) + 1  (BoF1=1, BoF2=2, BoF3=2)
--   * decided bila salah satu tim mencapai setsToWin, ATAU jumlah set yang
--     dimainkan sudah == sets_target (semua set habis).
--
-- Guard:
--   * Tolak bila match sudah 'finished' (idempoten terhadap retry).
--   * Tolak set imbang (p_score_a == p_score_b) — satu set harus ada pemenang.
--   * set_no dihitung server-side (max+1) sehingga aman dari race multi-device;
--     unique(match_id,set_no) menjadi jaring pengaman terakhir.
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

  -- Belum diputus: cukup pastikan state 'playing', jangan sentuh statistik.
  if v_sets_a < v_sets_to_win and v_sets_b < v_sets_to_win and v_played < v_target then
    update match set state = 'playing' where id = p_match_id;
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

-- ----------------------------------------------------------------------------
-- 4. edit_match_sets_atomic — koreksi skor per-set untuk match yang FINISHED
-- ----------------------------------------------------------------------------
-- Mengganti seluruh set sebuah match yang sudah selesai dengan daftar set baru,
-- lalu MENGHITUNG ULANG agregat match + selisih statistik pemain (delta),
-- dalam satu transaksi. Dipakai oleh dialog "Edit Skor" agar host bisa
-- membetulkan salah ketik tanpa merusak akumulasi statistik.
--
-- p_sets: jsonb array of {a:int, b:int} terurut set 1..n. Semua set harus punya
-- pemenang (a != b). Match harus dalam state 'finished'.
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
  -- lama (dari kolom agregat match) untuk hitung delta statistik
  old_total_a   int;
  old_total_b   int;
  old_winner    text;
  -- baru
  new_total_a   int := 0;
  new_total_b   int := 0;
  new_sets_a    int := 0;
  new_sets_b    int := 0;
  new_winner    text;
  -- delta W/L/D per posisi (a-side)
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

  -- Validasi tiap set & hitung agregat baru.
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

  -- Simpan nilai lama untuk delta.
  old_total_a := coalesce(m.score_a, 0);
  old_total_b := coalesce(m.score_b, 0);
  old_winner  := m.winner;

  -- Ganti baris match_set: hapus lama, sisipkan baru.
  delete from match_set where match_id = p_match_id;
  for v_i in 0 .. v_n - 1 loop
    v_a := (p_sets -> v_i ->> 'a')::int;
    v_b := (p_sets -> v_i ->> 'b')::int;
    insert into match_set (match_id, set_no, score_a, score_b)
    values (p_match_id, v_i + 1, v_a, v_b);
  end loop;

  -- Update agregat match.
  update match
     set score_a = new_total_a,
         score_b = new_total_b,
         winner  = new_winner
   where id = p_match_id;

  -- Delta W/L/D untuk sisi-A (sisi-B kebalikannya untuk win/loss; draw sama).
  d_win_a  := (case when new_winner = 'a' then 1 else 0 end) - (case when old_winner = 'a' then 1 else 0 end);
  d_loss_a := (case when new_winner = 'b' then 1 else 0 end) - (case when old_winner = 'b' then 1 else 0 end);
  d_draw_a := (case when new_winner = 'draw' then 1 else 0 end) - (case when old_winner = 'draw' then 1 else 0 end);

  -- Tim A: delta poin + delta W/L/D.
  update session_player sp
     set points_scored   = sp.points_scored   + (new_total_a - old_total_a),
         points_conceded = sp.points_conceded + (new_total_b - old_total_b),
         wins   = sp.wins   + d_win_a,
         losses = sp.losses + d_loss_a,
         draws  = sp.draws  + d_draw_a
   where sp.id in (m.team_a_p1, m.team_a_p2);

  -- Tim B: poin tertukar; win/loss kebalikan sisi-A; draw sama.
  update session_player sp
     set points_scored   = sp.points_scored   + (new_total_b - old_total_b),
         points_conceded = sp.points_conceded + (new_total_a - old_total_a),
         wins   = sp.wins   - d_loss_a,
         losses = sp.losses - d_win_a,
         draws  = sp.draws  + d_draw_a
   where sp.id in (m.team_b_p1, m.team_b_p2);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. REALTIME untuk match_set (livescore per set multi-device)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table match_set;
  exception when others then null;
  end;
end $$;

-- REPLICA IDENTITY FULL agar langganan berfilter mengirim semua kolom.
alter table match_set replica identity full;
