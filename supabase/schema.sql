-- ============================================================================
-- TangkasBoard — Skema Database (Supabase / PostgreSQL)
-- ============================================================================
-- Desain MULTI-TENANT sejak awal: semua data bernaung di bawah `community`.
-- Untuk Opsi B (sekarang) hanya ada 1 komunitas default (digembok password app).
-- Untuk Opsi C (nanti) tinggal tambah auth + tabel membership, tanpa merombak.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- ============================================================================

-- Ekstensi untuk gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. COMMUNITY (tenant)
-- ----------------------------------------------------------------------------
create table if not exists community (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Komunitas default untuk Opsi B (single-tenant sementara).
insert into community (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Community')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. PLAYER PROFILE (roster — persisten lintas mabar)
-- ----------------------------------------------------------------------------
create table if not exists player_profile (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references community(id) on delete cascade,
  name            text not null,
  level           text check (level in ('newbie','beginner','intermediate','advanced')),
  sessions_played int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_player_profile_community on player_profile(community_id);

-- ----------------------------------------------------------------------------
-- 3. SESSION (satu mabar)
-- ----------------------------------------------------------------------------
create table if not exists session (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references community(id) on delete cascade,
  name          text not null default 'Mabar',
  courts        int not null default 3 check (courts between 1 and 10),
  status        text not null default 'ongoing'
                check (status in ('scheduled','ongoing','finished')),
  current_round int not null default 0,
  scheduled_at  timestamptz,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists idx_session_community on session(community_id);

-- ----------------------------------------------------------------------------
-- 4. SESSION PLAYER (state pemain dalam satu mabar)
-- ----------------------------------------------------------------------------
create table if not exists session_player (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references session(id) on delete cascade,
  profile_id            uuid references player_profile(id) on delete set null,
  name                  text not null,
  level                 text check (level in ('newbie','beginner','intermediate','advanced')),
  status                text not null default 'registered'
                        check (status in ('registered','active','resting','left')),
  checked_in_at         timestamptz,
  games_played          int not null default 0,
  last_played_round     int,
  available_since_round int not null default 0,
  wins                  int not null default 0,
  losses                int not null default 0,
  draws                 int not null default 0,
  points_scored         int not null default 0,
  points_conceded       int not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists idx_session_player_session on session_player(session_id);

-- ----------------------------------------------------------------------------
-- 5. COURT (lapangan dalam satu mabar — jumlah dinamis)
-- ----------------------------------------------------------------------------
create table if not exists court (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references session(id) on delete cascade,
  label       text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_court_session on court(session_id);

-- ----------------------------------------------------------------------------
-- 6. MATCH (pertandingan)
-- ----------------------------------------------------------------------------
create table if not exists match (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references session(id) on delete cascade,
  court_id       uuid references court(id) on delete set null,
  court_label    text,
  round          int not null,
  team_a_p1      uuid not null,
  team_a_p2      uuid not null,
  team_b_p1      uuid not null,
  team_b_p2      uuid not null,
  state          text not null default 'proposed'
                 check (state in ('proposed','playing','finished','unfinished')),
  score_a        int,
  score_b        int,
  winner         text check (winner in ('a','b','draw')),
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index if not exists idx_match_session on match(session_id);
create index if not exists idx_match_court on match(court_id);

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Opsi B: app digembok 1 password di sisi client, akses DB pakai anon key.
-- Kita aktifkan RLS dan beri policy permisif untuk role anon SEKARANG,
-- supaya saat naik ke Opsi C (auth), tinggal perketat policy per community
-- tanpa mengubah struktur tabel.
--
-- CATATAN KEAMANAN: policy permisif ini berarti siapa pun dengan anon key +
-- URL app bisa baca/tulis. Ini sesuai kesepakatan Opsi B (gembok di app).
-- Jangan sebar anon key/URL ke publik.

alter table community      enable row level security;
alter table player_profile enable row level security;
alter table session        enable row level security;
alter table session_player enable row level security;
alter table court          enable row level security;
alter table match          enable row level security;

-- Helper: buat policy "allow all untuk anon & authenticated" per tabel.
do $$
declare t text;
begin
  foreach t in array array['community','player_profile','session','session_player','court','match']
  loop
    execute format('drop policy if exists %I on %I;', t || '_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      t || '_all', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. REALTIME (untuk livescore)
-- ----------------------------------------------------------------------------
-- Aktifkan realtime pada tabel yang dipantau live. Abaikan error bila
-- publication belum ada / sudah terdaftar.
do $$
begin
  begin
    alter publication supabase_realtime add table match;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table session_player;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table court;
  exception when others then null;
  end;
end $$;
