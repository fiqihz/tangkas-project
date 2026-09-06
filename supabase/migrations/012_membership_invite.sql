-- ============================================================================
-- 012 — SKEMA MEMBERSHIP & INVITE (Fase 2: Auth + Multi-Tenant)
-- ============================================================================
-- Menambahkan lapisan keanggotaan (membership) yang menautkan `auth.users` ke
-- `community`, serta tabel `invite` untuk mengundang admin ke sebuah community.
--
-- Desain mengikuti bagian "Data Models → DDL migration 012" pada design.md.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- (Penerapan migrasi dilakukan manual oleh user; file ini hanya definisi SQL.)
--
-- Ekstensi pgcrypto (gen_random_uuid / gen_random_bytes) sudah aktif sejak
-- migration 000; baris berikut menjaga idempotensi bila di-run terpisah.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM — peran keanggotaan & status invite
-- ----------------------------------------------------------------------------
-- `create type` tidak mendukung `if not exists`, jadi dibungkus guard agar
-- idempoten (aman di-run ulang).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type membership_role as enum ('owner', 'admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. MEMBERSHIP — tautan user ↔ community + peran
-- ----------------------------------------------------------------------------
create table if not exists membership (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references community(id)  on delete cascade,
  role         membership_role not null,
  created_at   timestamptz not null default now(),
  unique (user_id, community_id)
);
create index if not exists idx_membership_user on membership(user_id);
create index if not exists idx_membership_community on membership(community_id);

-- ----------------------------------------------------------------------------
-- 3. INVITE — undangan admin ke sebuah community
-- ----------------------------------------------------------------------------
-- Di Fase 2 hanya role `admin` yang dapat diundang (dibatasi lewat CHECK).
create table if not exists invite (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  email        text not null,
  role         membership_role not null default 'admin' check (role = 'admin'),
  token        text not null unique,
  status       invite_status not null default 'pending',
  expires_at   timestamptz not null default (now() + interval '7 days'),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_invite_token on invite(token);
create index if not exists idx_invite_community on invite(community_id);
