-- ============================================================================
-- 016 — INVITE EMAIL-BOUND & LIST MEMBER DENGAN EMAIL (Fase 2: Auth + Multi-Tenant)
-- ============================================================================
-- Penyempurnaan alur invite admin:
--
--   BAGIAN 1: redeem_invite (email-bound)          — mengganti versi 015.
--   BAGIAN 2: list_community_members_with_email     — owner-only, lihat email.
--
-- Cara pakai: buka Supabase Dashboard > SQL Editor > tempel & Run.
-- (Penerapan migrasi dilakukan manual oleh user; file ini hanya definisi SQL.)
--
-- Semua fungsi memakai `create or replace` agar idempoten (aman di-run ulang).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BAGIAN 1: redeem_invite EMAIL-BOUND (mengganti versi 015)
-- ----------------------------------------------------------------------------
-- Sama seperti versi 015, tapi menambah pemeriksaan email: undangan hanya bisa
-- ditukar oleh user yang email login-nya cocok dengan `invite.email`. Ini
-- mencegah token bocor dipakai orang lain. Perbandingan case-insensitive & di-
-- trim agar toleran terhadap selisih huruf besar/kecil & spasi.
--
-- Fungsi `SECURITY DEFINER` boleh membaca `auth.users` untuk mengambil email
-- user login. Nilai balik `jsonb` `{ ok, reason?, community_id? }`:
--   - not_authenticated : auth.uid() null.                        (tolak)
--   - not_found         : token tidak ada.                        (tolak)
--   - used              : status <> 'pending'.                    (Req 6.8, tolak)
--   - expired           : kedaluwarsa → set 'expired', TIDAK buat membership.
--   - email_mismatch    : email login <> invite.email → tolak,    (BARU)
--                         TIDAK buat membership, TIDAK ubah status.
--   - ok=true           : valid → insert membership 'admin' (idempoten) +
--                         set invite 'accepted'.                  (Req 6.5, 6.6)
--
-- `for update` mengunci baris invite selama transaksi agar dua penukaran
-- serempak tidak balapan.
create or replace function public.redeem_invite(p_token text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  inv invite;
  v_uid uuid := auth.uid();
  v_email text;
begin
  -- 1. Harus terautentikasi: membership butuh user_id valid. (Req 6.x.)
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- Ambil email user login (SECURITY DEFINER boleh baca auth.users).
  select email into v_email from auth.users where id = auth.uid();

  -- 2. Ambil & kunci baris invite berdasarkan token.
  select * into inv from invite where token = p_token for update;

  -- 3. Token tidak ditemukan → tolak.
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 4. Sudah dipakai/dicabut (status bukan 'pending') → tolak. (Req 6.8.)
  if inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  -- 5. Kedaluwarsa → tandai 'expired', tolak, TIDAK buat membership. (Req 6.7.)
  if inv.expires_at < now() then
    update invite set status = 'expired' where id = inv.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- 6. Email login harus cocok dengan email undangan (case-insensitive, trim).
  --    Bila tidak cocok → tolak; TIDAK buat membership, TIDAK ubah status.
  if lower(trim(v_email)) <> lower(trim(inv.email)) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  -- 7. Valid → jadikan pemanggil admin di community; idempoten via on conflict.
  insert into membership(user_id, community_id, role)
    values (v_uid, inv.community_id, 'admin')
    on conflict (user_id, community_id) do nothing;

  -- Tandai invite terpakai lalu kembalikan sukses + community tujuan. (Req 6.5, 6.6.)
  update invite set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'community_id', inv.community_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- BAGIAN 2: list_community_members_with_email (owner-only)
-- ----------------------------------------------------------------------------
-- Daftar member sebuah community LENGKAP dengan email masing-masing agar owner
-- bisa mengelola admin (mengenali siapa dari email). Email disimpan di
-- `auth.users` yang tidak bisa dibaca langsung oleh role authenticated, jadi
-- akses dilakukan lewat RPC `SECURITY DEFINER` ini. Guard owner-only mencegah
-- non-owner mengintip email anggota. (Req 5.3.)
create or replace function public.list_community_members_with_email(p_community_id uuid)
returns table(user_id uuid, role membership_role, email text, created_at timestamptz)
language plpgsql security definer
set search_path = public as $$
begin
  -- Owner-only: hanya owner community yang boleh melihat email anggota.
  if not public.has_role(p_community_id, array['owner']::membership_role[]) then
    raise exception 'list_community_members_with_email: hanya owner';
  end if;

  return query
  select m.user_id, m.role, u.email::text, m.created_at
  from membership m
  join auth.users u on u.id = m.user_id
  where m.community_id = p_community_id
  order by m.created_at;
end;
$$;
