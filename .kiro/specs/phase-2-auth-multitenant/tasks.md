# Implementation Plan — Fase 2: Auth + Multi-Tenant

## Overview

Rencana implementasi ini menjabarkan design menjadi langkah coding inkremental.
Urutan mengikuti dependensi teknis: migrasi skema → RLS/helper → RPC bisnis →
trigger + Edge Function → tipe TS → client/store auth → repo layer → wiring store
ke `activeCommunityId` → halaman/guard auth → UI switcher & kelola admin → i18n →
pengujian (property-based + unit/integration). Setiap task membangun di atas hasil
task sebelumnya sehingga tidak ada kode yatim; task terakhir merangkai semuanya dan
memvalidasi lewat build.

Bahasa implementasi: **TypeScript** (aplikasi Next.js) dan **SQL** (migrasi Supabase)
sesuai design — tidak ada pertanyaan pemilihan bahasa karena design memakai bahasa konkret.

### Prasyarat lingkungan (BUKAN task agen — dilakukan manual di luar checklist)

Catatan berikut adalah prasyarat operasional yang **tidak** dikerjakan agen dan tidak
tercentang sebagai task:

- Menerapkan (apply) migrasi ke project Supabase cloud `cvuqtwikykyhcaxyjqba`.
- Meng-enable provider Google + set redirect URL di dashboard Supabase.
- Verifikasi domain Resend dan set secret `RESEND_API_KEY` / `INVITE_FROM` / `APP_URL`
  pada Edge Function; sebelum domain terverifikasi, email hanya sampai ke pemilik akun Resend.
- Deploy Edge Function `send-invite`.
- Uji manual multi-user untuk anti-kebocoran RLS dan uji migrasi data lama pada data nyata.

### Verifikasi otomatis wajib tiap task

`npm run typecheck` → `npm run lint` → `npm run build` (semua exit 0). Penghapusan
default `DEFAULT_COMMUNITY_ID` pada repo membuat typecheck menandai setiap call site
yang belum di-wire.

## Tasks

- [x] 1. Migrasi skema membership & invite (migration 012)
  - Buat `supabase/migrations/012_membership_invite.sql`.
  - Definisikan enum `membership_role` (`owner`,`admin`,`member`) dan `invite_status` (`pending`,`accepted`,`expired`,`revoked`).
  - Buat tabel `membership` (id, user_id→auth.users, community_id→community, role, created_at) dengan `unique (user_id, community_id)` dan index `idx_membership_user`, `idx_membership_community`.
  - Buat tabel `invite` (id, community_id, email, role default `admin` + `check (role='admin')`, token unik, status default `pending`, expires_at default `now()+7d`, invited_by, created_at) dengan index `idx_invite_token`, `idx_invite_community`.
  - _Requirements: 4.1, 4.3, 4.4, 6.1, 6.10_
  - _Design: Data Models → DDL migration 012_

- [x] 2. Helper function + RLS ketat per-community (migration 013)
  - [x] 2.1 Buat helper `SECURITY DEFINER` anti-rekursi
    - Buat `supabase/migrations/013_rls_tenant.sql`.
    - Definisikan `public.is_member(target uuid)` dan `public.has_role(target uuid, roles membership_role[])` (`stable security definer`, `set search_path = public`).
    - _Requirements: 7.3, 7.4, 7.6_
    - _Design: RLS Design → Helper function_
  - [x] 2.2 Drop policy permisif lama & aktifkan RLS tabel baru
    - Drop policy `*_all` permisif `anon using(true)` pada `community`, `player_profile`, `session`, `session_player`, `court`, `match`.
    - `enable row level security` pada `membership` dan `invite`.
    - _Requirements: 7.1_
    - _Design: RLS Design → DDL migration 013 (bagian 1–2)_
  - [x] 2.3 Policy per-tabel berbasis keanggotaan
    - `community`: select `is_member(id)`, delete owner-only, update owner/admin (tanpa policy INSERT authenticated).
    - `player_profile` & `session`: policy `for all` dengan `is_member(community_id)` (using + with check).
    - `session_player`, `court`, `match`: policy `for all` via join `exists (select 1 from session s where s.id=<t>.session_id and is_member(s.community_id))`.
    - `membership`: select `is_member(community_id)` (tulis lewat RPC saja).
    - `invite`: select owner-only + insert owner-only dengan `role='admin'` (tukar lewat RPC).
    - Semua write `to authenticated`.
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_
    - _Design: RLS Design → DDL migration 013 (bagian 3–7)_

- [x] 3. RPC onboarding, klaim data lama, dan redeem invite (migration 015)
  - [x] 3.1 Implementasi `claim_legacy_data(p_target uuid)`
    - Buat `supabase/migrations/015_rpc_onboarding_invite.sql`.
    - `SECURITY DEFINER`; `UPDATE player_profile/session SET community_id=p_target WHERE community_id=DEFAULT_COMMUNITY_ID` (idempoten via kondisi WHERE, tanpa mengubah kolom lain).
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
    - _Design: Onboarding & Migrasi Data Lama → claim_legacy_data_
  - [x] 3.2 Implementasi `create_community_with_owner(p_name text)`
    - `SECURITY DEFINER`: insert `community`, insert `membership` role `owner` untuk `auth.uid()`, lalu panggil `claim_legacy_data(community_id_baru)` dalam satu transaksi.
    - _Requirements: 3.3, 4.5, 10.1_
    - _Design: Onboarding & Migrasi Data Lama → create_community_with_owner_
  - [x] 3.3 Implementasi `redeem_invite(p_token text)`
    - `SECURITY DEFINER`, kembalikan `jsonb`: cabang `not_found`, `used` (status≠pending), `expired` (set status `expired`, tidak buat membership), sukses (insert membership `admin` `on conflict do nothing` + set invite `accepted`).
    - _Requirements: 6.5, 6.6, 6.7, 6.8_
    - _Design: Invite Flow → Penukaran token (redeem)_

- [x] 4. Trigger email invite + Edge Function send-invite (migration 014 + fungsi)
  - [x] 4.1 Buat trigger `pg_net` pada INSERT invite (migration 014)
    - Buat `supabase/migrations/014_invite_email_trigger.sql`.
    - Fungsi `notify_invite_created()` (`security definer`, `search_path=public,extensions`) memanggil `net.http_post` ke Edge Function `send-invite` dengan header Authorization Bearer anon key dan body `record` (pola migration 011).
    - Trigger `after insert on invite for each row`.
    - _Requirements: 6.3_
    - _Design: Invite Flow → trigger pg_net → Edge Function, migration 014_
  - [x] 4.2 Implementasi Edge Function `send-invite`
    - Buat `supabase/functions/send-invite/index.ts` (runtime Deno, pola `notify-feedback`).
    - Terima payload, susun tautan `${APP_URL}/register?invite=${token}`, kirim via Resend (`RESEND_API_KEY`, `INVITE_FROM`, `APP_URL` dari secret); kembalikan 502 + log bila gagal.
    - _Requirements: 6.3_
    - _Design: Invite Flow → Edge Function send-invite; Error Handling_
  - [x] 4.3 Unit test penyusunan payload/link invite (Edge Function)*
    - Uji contoh representatif: format tautan `/register?invite=TOKEN` dan pembentukan body email benar.
    - _Requirements: 6.3, 6.4_
    - _Design: Testing Strategy → Unit_

- [x] 5. Tipe TypeScript baru di `types.ts`
  - Tambah `MembershipRole`, `InviteStatus`, `DbMembership`, `DbInvite` di `src/lib/supabase/types.ts`.
  - Pertahankan konstanta `DEFAULT_COMMUNITY_ID` (dipakai klaim data lama) tetapi tidak lagi sebagai default argumen repo.
  - _Requirements: 4.1, 6.1, 9.2_
  - _Design: Data Models → Tipe TypeScript baru_

- [x] 6. Konfigurasi client Supabase (`persistSession: true`)
  - Ubah `src/lib/supabase/client.ts`: `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`.
  - _Requirements: 1.6_
  - _Design: Components and Interfaces → 1. Supabase client_

- [x] 7. Auth store (`auth-store.ts`)
  - [x] 7.1 Implementasi state & aksi auth store
    - Buat `src/lib/store/auth-store.ts` (zustand): state `status`/`userId`/`memberships`/`activeCommunityId`; aksi `init`, `signInEmail`, `signUpEmail`, `signInGoogle`, `signOut`, `loadMemberships`, `setActiveCommunity`.
    - `init` membaca sesi + subscribe `onAuthStateChange`; `loadMemberships` set status `ready`/`needsOnboarding`; `setActiveCommunity` persist ke localStorage.
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 3.2, 3.4, 8.1, 8.5_
    - _Design: Components and Interfaces → 2. Auth store_
  - [x] 7.2 Fungsi murni resolusi active_community
    - Ekstrak fungsi murni `resolveActiveCommunity(memberships, storedId)` (tanpa I/O): pilih storedId bila masih ada di daftar, jika tidak membership pertama; daftar satu → community tunggal.
    - _Requirements: 8.1, 8.5_
    - _Design: Correctness Properties → Property 6_
  - [x]* 7.3 Property test resolusi active_community
    - **Feature: phase-2-auth-multitenant, Property 6: Resolusi active_community deterministik dari daftar membership** (min. 100 iterasi, fast-check).
    - **Validates: Requirements 8.1, 8.5**

- [x] 8. Repo layer — fungsi auth/tenant baru & hapus default community
  - [x] 8.1 Tambah fungsi repo baru
    - Di `src/lib/supabase/repo.ts`: `listMyMemberships`, `createCommunityWithOwner` (RPC), `createInvite` (role paksa `admin`), `redeemInvite` (RPC), `listCommunityMembers`, `kickMember`, `deleteCommunity`.
    - _Requirements: 3.3, 4.2, 5.1, 5.2, 5.3, 5.4, 6.2, 6.5, 6.9, 6.10, 8.1, 10.1_
    - _Design: Components and Interfaces → 8. Repo Layer_
  - [x] 8.2 Hapus default `DEFAULT_COMMUNITY_ID` pada fungsi data community
    - Ubah tanda tangan fungsi baca/tulis data (mis. `listProfiles`, `listSessions`, `createSession`, `createProfile`, `listResolvedMatches`, `getOngoingSession`) agar `communityId: string` menjadi argumen wajib.
    - _Requirements: 9.2, 9.3_
    - _Design: Components and Interfaces → 8. Repo Layer (perubahan fungsi existing)_
  - [x]* 8.3 Property test create invite selalu role admin
    - **Feature: phase-2-auth-multitenant, Property 3: Invite selalu ber-role admin di Fase 2** (min. 100 iterasi, model murni logika createInvite).
    - **Validates: Requirements 6.10**

- [x] 9. Wiring store/hook pemanggil repo ke `activeCommunityId`
  - [x] 9.1 Wiring `session-store.ts`
    - `loadSessions`, `getOngoingSession`, `createSession`, `createProfile` membaca `activeCommunityId` dari `auth-store` dan meneruskannya ke repo.
    - _Requirements: 8.4, 9.1, 9.3_
    - _Design: Components and Interfaces → 9. Store yang memanggil repo_
  - [x] 9.2 Wiring `use-profiles.ts` dan `use-roster-stats.ts`
    - `listProfiles`/`createProfile` (use-profiles) dan `listProfiles`/`listResolvedMatches` (use-roster-stats) memakai `activeCommunityId`.
    - _Requirements: 8.4, 9.1_
    - _Design: Components and Interfaces → 9. Store yang memanggil repo_

- [x] 10. Checkpoint — pastikan build & test hijau
  - Pastikan `npm run typecheck`, `npm run lint`, `npm run build`, dan seluruh test lulus; tanyakan ke user bila muncul pertanyaan.

- [x] 11. Halaman auth, onboarding, callback, dan route guard
  - [x] 11.1 Route guard `/app`
    - Buat `src/components/auth/route-guard.tsx` (loading→null, signedOut→`/login`, needsOnboarding→`/onboarding`, ready→children).
    - Ubah `src/app/app/page.tsx` membungkus `AppShell` dengan `RouteGuard` (bukan `PasswordGate`).
    - _Requirements: 1.7, 2.1, 2.3, 3.2, 3.4_
    - _Design: Components and Interfaces → 3. Route guard_
  - [x] 11.2 Halaman login
    - Buat `src/app/login/page.tsx`: form Email/Password + tombol Google; sukses→`/app`; gagal→pesan error tanpa sesi.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
    - _Design: Components and Interfaces → 4. Halaman auth_
  - [x] 11.3 Halaman register (dengan `?invite=TOKEN`)
    - Buat `src/app/register/page.tsx`: form register; baca query `invite`; setelah register sukses panggil `redeemInvite(token)` bila ada.
    - _Requirements: 6.4, 6.5_
    - _Design: Components and Interfaces → 4. Halaman auth_
  - [x] 11.4 Halaman onboarding
    - Buat `src/app/onboarding/page.tsx`: minta nama community lalu panggil `createCommunityWithOwner(name)`; error→tetap di halaman.
    - _Requirements: 3.3, 3.5, 10.1_
    - _Design: Components and Interfaces → 4. Halaman auth; Error Handling_
  - [x] 11.5 Auth callback OAuth Google
    - Buat `src/app/auth/callback/route.ts`: `exchangeCodeForSession(code)` lalu redirect `/app`; gagal→`/login`.
    - _Requirements: 1.2_
    - _Design: Components and Interfaces → 4. Halaman auth; Error Handling_
  - [x] 11.6 Retire PasswordGate & tambah CTA landing
    - Hapus `src/components/password-gate.tsx` dan `src/lib/auth/gate.ts`; hilangkan ketergantungan `NEXT_PUBLIC_APP_PASSWORD` untuk akses `/app`.
    - Tambah CTA menuju `/login` dan `/register` di `src/components/landing/landing-page.tsx`.
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 1.5_
    - _Design: Components and Interfaces → 5. Landing; Lapisan & tanggung jawab (Retire gate)_
  - [x]* 11.7 Unit test validasi form + integration test guard
    - Unit: validasi form login/register. Integration (contoh 1–3): guard route pada state signedOut/needsOnboarding/ready.
    - _Requirements: 1.4, 1.7, 3.2, 3.4_
    - _Design: Testing Strategy → Unit & integration_

- [x] 12. Community switcher & dialog kelola admin
  - [x] 12.1 Community switcher
    - Buat `src/components/app/community-switcher.tsx`; tampil hanya bila `memberships.length > 1`; memilih memanggil `setActiveCommunity(id)`; pasang di header `AppShell`.
    - _Requirements: 8.2, 8.3, 8.5_
    - _Design: Components and Interfaces → 6. Community switcher_
  - [x] 12.2 Dialog kelola admin (owner-only)
    - Buat `src/components/app/manage-admins-dialog.tsx`: undang admin (`createInvite`), daftar member (`listCommunityMembers`), kick admin non-owner (`kickMember`), hapus community (`deleteCommunity`).
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.2, 6.9_
    - _Design: Components and Interfaces → 7. Kelola admin_

- [x] 13. i18n wording baru (`dict.ts`)
  - Tambah key auth/onboarding/community/admin/invite ke `DICT` di `src/lib/i18n/dict.ts` (format `{ id, en }`) sesuai bagian i18n design.
  - _Requirements: 1.4, 3.5, 6.7, 6.8, 8.2_
  - _Design: i18n — Wording baru_

- [x] 14. Property & integration test invite + klaim data lama
  - [x]* 14.1 Property test redeem invite kedaluwarsa
    - **Feature: phase-2-auth-multitenant, Property 1: Penukaran invite kedaluwarsa tidak pernah membuat membership** (min. 100 iterasi, model murni redeem).
    - **Validates: Requirements 6.7**
  - [x]* 14.2 Property test redeem invite idempoten
    - **Feature: phase-2-auth-multitenant, Property 2: Penukaran invite idempoten (tidak bisa dipakai dua kali)** (min. 100 iterasi).
    - **Validates: Requirements 6.5, 6.6, 6.8**
  - [x]* 14.3 Property test klaim data lama idempoten
    - **Feature: phase-2-auth-multitenant, Property 4: Klaim data lama idempoten** (min. 100 iterasi, model murni claim_legacy_data).
    - **Validates: Requirements 10.2, 10.3**
  - [x]* 14.4 Property test klaim data lama mempertahankan kolom
    - **Feature: phase-2-auth-multitenant, Property 5: Klaim data lama mempertahankan semua kolom selain community_id** (min. 100 iterasi).
    - **Validates: Requirements 10.1, 10.4**
  - [x]* 14.5 Integration test trigger + redeem terhadap DB
    - Contoh 1–3: trigger `pg_net` memanggil Edge Function; `redeem_invite` terhadap DB uji.
    - _Requirements: 6.3, 6.5_
    - _Design: Testing Strategy → Integration_

- [x] 15. Checkpoint akhir — pastikan seluruh test & build lulus
  - Pastikan `npm run typecheck`, `npm run lint`, `npm run build`, dan seluruh property/unit/integration test lulus; tanyakan ke user bila muncul pertanyaan.

## Notes

- Task berpostfiks `*` bersifat opsional (pengujian) dan boleh dilewati untuk MVP lebih cepat; task inti tidak boleh dilewati.
- Setiap task merujuk requirement spesifik untuk keterlacakan, dan mengacu bagian design bila relevan.
- Property test memakai `fast-check` (min. 100 iterasi) dan di-tag `Feature: phase-2-auth-multitenant, Property N`.
- Prasyarat non-coding (apply migrasi, enable Google, verifikasi domain Resend, deploy Edge Function, uji manual multi-user) berada di luar checklist ini sesuai bagian "Prasyarat lingkungan".
- Penomoran migrasi mengikuti urutan penerapan (012→013→014→015); nomor 014 (trigger) diterapkan setelah 015 (RPC `send-invite` target) tersedia secara logis, namun keduanya dapat di-apply berurutan karena trigger hanya aktif saat INSERT invite.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "5", "6"] },
    { "id": 2, "tasks": ["2.2", "7.1", "8.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "7.2", "8.2"] },
    { "id": 4, "tasks": ["3.2", "3.3", "7.3", "8.3", "9.1"] },
    { "id": 5, "tasks": ["4.1", "9.2", "13"] },
    { "id": 6, "tasks": ["4.2", "11.1", "11.6"] },
    { "id": 7, "tasks": ["4.3", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 8, "tasks": ["11.7", "12.1", "12.2"] },
    { "id": 9, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5"] }
  ]
}
```
