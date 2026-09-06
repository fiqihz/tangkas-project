-- ============================================================================
-- 015 — RPC ONBOARDING, KLAIM DATA LAMA & REDEEM INVITE (Fase 2: Auth + Multi-Tenant)
-- ============================================================================
-- Kumpulan fungsi RPC bisnis yang dipanggil klien lewat repo layer. Isi file
-- dibagi menjadi beberapa bagian yang saling melengkapi dan di-apply sebagai
-- satu migrasi:
--
--   BAGIAN 1: claim_legacy_data          — klaim data lama (DEFAULT) → community baru.
--   BAGIAN 2: create_community_with_owner — onboarding (Task 3.2).
--   BAGIAN 3: redeem_invite              — tukar token invite (Task 3.3).
--
-- Desain mengikuti bagian "Onboarding & Migrasi Data Lama" pada design.md.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- (Penerapan migrasi dilakukan manual oleh user; file ini hanya definisi SQL.)
--
-- Semua fungsi memakai `create or replace` agar idempoten (aman di-run ulang).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BAGIAN 1: claim_legacy_data — klaim data lama satu kali & idempoten  (Task 3.1)
-- ----------------------------------------------------------------------------
-- Memindahkan baris warisan ber-`community_id = DEFAULT_COMMUNITY_ID`
-- ('00000000-0000-0000-0000-000000000001') ke community `p_target`. Tabel anak
-- (`session_player`, `court`, `match`) tidak punya `community_id` dan tertaut ke
-- `session` via FK, jadi cukup memindahkan induk (`player_profile`, `session`) —
-- anak ikut lewat relasi, tidak melanggar FK.
--
-- Idempotensi: `UPDATE ... WHERE community_id = DEFAULT` — panggilan kedua tidak
-- menemukan baris DEFAULT lagi (sudah pindah) → nol baris diubah. Hanya kolom
-- `community_id` induk yang berubah; kolom lain dipertahankan dan FK anak tetap
-- menunjuk id yang tidak berubah. (Req 10.1, 10.2, 10.3, 10.4.)
create or replace function public.claim_legacy_data(p_target uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update player_profile set community_id = p_target where community_id = '00000000-0000-0000-0000-000000000001';
  update session         set community_id = p_target where community_id = '00000000-0000-0000-0000-000000000001';
end;
$$;

-- ----------------------------------------------------------------------------
-- BAGIAN 2: create_community_with_owner (Task 3.2)
-- ----------------------------------------------------------------------------
-- Onboarding satu-langkah: buat community baru, jadikan pemanggil owner-nya,
-- lalu klaim data lama (DEFAULT) ke community baru tsb. Ketiga langkah berada
-- dalam satu fungsi sehingga bersifat transaksional secara implisit (bila salah
-- satu gagal, seluruhnya di-rollback).
--
-- `SECURITY DEFINER` menembus RLS: INSERT community & membership tidak punya
-- policy tulis langsung untuk role authenticated (lihat migration 013), jadi
-- HARUS lewat RPC ini. `return v_row` mengembalikan SATU baris `community` →
-- PostgREST menyajikannya sebagai objek tunggal (bukan array), cocok dengan
-- repo `createCommunityWithOwner` yang melakukan `return data as DbCommunity`.
-- (Req 3.3, 4.5, 10.1.)
create or replace function public.create_community_with_owner(p_name text)
returns community language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row community;
begin
  -- Harus terautentikasi: owner membership butuh user_id yang valid.
  if v_uid is null then
    raise exception 'create_community_with_owner: butuh autentikasi (auth.uid() null)';
  end if;

  -- 1. Buat community baru, tangkap seluruh baris untuk nilai balik.
  insert into community(name) values (p_name)
  returning * into v_row;

  -- 2. Jadikan pemanggil sebagai owner community baru. (Req 3.3, 4.5.)
  insert into membership(user_id, community_id, role)
  values (v_uid, v_row.id, 'owner');

  -- 3. Klaim data lama (DEFAULT) ke community baru; idempoten. (Req 10.1.)
  perform public.claim_legacy_data(v_row.id);

  -- 4. Kembalikan satu baris community → objek tunggal di PostgREST.
  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- BAGIAN 2b: kick_member (owner-only)
-- ----------------------------------------------------------------------------
-- Keluarkan seorang member dari community. Penulisan langsung ke `membership`
-- diblok RLS (tidak ada policy DELETE untuk authenticated di migration 013),
-- jadi operasi ini HARUS lewat RPC `SECURITY DEFINER` owner-only. Dipanggil oleh
-- repo `kickMember(p_community_id, p_user_id)`. (Req 5.3, 5.4.)
create or replace function public.kick_member(p_community_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  -- Owner-only: pemanggil harus punya role 'owner' di community tsb. (Req 5.3.)
  if not public.has_role(p_community_id, array['owner']::membership_role[]) then
    raise exception 'kick_member: hanya owner yang boleh mengeluarkan member';
  end if;

  -- Owner tidak boleh dikeluarkan (target ber-role 'owner'). (Req 5.4.)
  if exists (
    select 1 from membership
    where community_id = p_community_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'kick_member: member ber-role owner tidak bisa dikeluarkan';
  end if;

  -- Keluarkan member dari community.
  delete from membership
  where community_id = p_community_id and user_id = p_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- BAGIAN 3: redeem_invite (Task 3.3)
-- ----------------------------------------------------------------------------
-- Tukar token undangan menjadi membership `admin`. Dipanggil oleh repo
-- `redeemInvite(token)` setelah register sukses (register selalu login duluan,
-- jadi `auth.uid()` normalnya terisi). Penulisan langsung ke `membership`
-- diblok RLS, jadi penukaran HARUS lewat RPC `SECURITY DEFINER` ini.
--
-- Nilai balik `jsonb` `{ ok, reason?, community_id? }`:
--   - not_found : token tidak ada.                                (tolak)
--   - used      : status <> 'pending' (accepted/revoked/expired). (Req 6.8, tolak)
--   - expired   : sudah kedaluwarsa → set status 'expired',       (Req 6.7)
--                 TIDAK membuat membership.                       (tolak)
--   - ok=true   : valid → insert membership 'admin' (idempoten via
--                 on conflict) + set invite 'accepted'.           (Req 6.5, 6.6)
--
-- `for update` mengunci baris invite selama transaksi agar dua penukaran
-- serempak tidak balapan. Idempoten: token yang sudah 'accepted' gagal di cabang
-- `used` tanpa membuat membership kedua (dijaga pula oleh unique (user_id,
-- community_id)). (Req 6.5, 6.6, 6.7, 6.8.)
create or replace function public.redeem_invite(p_token text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  inv invite;
  v_uid uuid := auth.uid();
begin
  -- Harus terautentikasi: membership butuh user_id valid. Register selalu login
  -- duluan, tapi jaga eksplisit agar tidak menabrak NOT NULL user_id.
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- 1. Ambil & kunci baris invite berdasarkan token.
  select * into inv from invite where token = p_token for update;

  -- 2. Token tidak ditemukan → tolak.
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 3. Sudah dipakai/dicabut (status bukan 'pending') → tolak. (Req 6.8.)
  if inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  -- 4. Kedaluwarsa → tandai 'expired', tolak, TIDAK buat membership. (Req 6.7.)
  if inv.expires_at < now() then
    update invite set status = 'expired' where id = inv.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- 5. Valid → jadikan pemanggil admin di community; idempoten via on conflict.
  insert into membership(user_id, community_id, role)
    values (v_uid, inv.community_id, 'admin')
    on conflict (user_id, community_id) do nothing;

  -- Tandai invite terpakai lalu kembalikan sukses + community tujuan. (Req 6.5, 6.6.)
  update invite set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'community_id', inv.community_id);
end;
$$;
