// ============================================================================
// Task 14.5 — Integration test: trigger pg_net + redeem_invite terhadap DB uji.
// Feature: phase-2-auth-multitenant — INTEGRATION TEST (contoh 1–3, bukan property).
// _Requirements: 6.3, 6.5_ — Design: Testing Strategy → Integration.
// ============================================================================
//
// PRASYARAT MENJALANKAN (bila ingin test ini benar-benar dieksekusi):
//
//   1. Sediakan database Supabase UJI (lokal via `supabase start`/CLI, atau
//      instance test terpisah — JANGAN pakai DB produksi).
//   2. Apply migrasi 012–015 ke DB uji tsb:
//        supabase/migrations/012_membership_invite.sql
//        supabase/migrations/013_rls_tenant.sql
//        supabase/migrations/014_invite_email_trigger.sql
//        supabase/migrations/015_rpc_onboarding_invite.sql
//   3. Untuk bagian email (trigger pg_net → Edge Function `send-invite`):
//      deploy Edge Function `send-invite` + set secret Resend. Pengiriman email
//      TIDAK diverifikasi di sini (butuh domain Resend terverifikasi); test
//      hanya memastikan INSERT invite (yang memicu trigger) tidak melempar error.
//   4. Set environment variables sebelum menjalankan test:
//        SUPABASE_TEST_URL                — URL DB uji (mis. http://127.0.0.1:54321)
//        SUPABASE_TEST_SERVICE_ROLE_KEY   — service_role key DB uji (menembus RLS)
//      Contoh (PowerShell):
//        $env:SUPABASE_TEST_URL="http://127.0.0.1:54321"
//        $env:SUPABASE_TEST_SERVICE_ROLE_KEY="<service_role_key>"
//        npx vitest run src/lib/invite/redeem-invite.integration.test.ts
//
// AUTO-SKIP: Bila salah satu env di atas tidak tersedia, SELURUH test di file
// ini di-SKIP (describe.skip) dengan pesan jelas — TIDAK gagal. Ini menjaga
// `npm test` tetap hijau di environment tanpa DB uji. Eksekusi penuh menunggu
// DB uji + migrasi 012–015 di-apply oleh user.
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

/** DB uji tersedia hanya bila kedua env terisi. Jika tidak → seluruh test skip. */
const hasDbEnv = Boolean(TEST_URL && TEST_SERVICE_ROLE_KEY);

// Pesan diagnostik yang tampil di output ketika suite ini di-skip.
if (!hasDbEnv) {
  console.info(
    "[Task 14.5] Integration test redeem_invite di-SKIP: set SUPABASE_TEST_URL " +
      "+ SUPABASE_TEST_SERVICE_ROLE_KEY (DB uji + migrasi 012–015) untuk menjalankan.",
  );
}

const DEFAULT_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari (cermin default kolom).

// `describe.skip` bila env DB tidak ada → test di-skip, bukan gagal.
const suite = hasDbEnv ? describe : describe.skip;

suite(
  "Feature: phase-2-auth-multitenant — Integration: trigger + redeem_invite terhadap DB",
  () => {
    let db: SupabaseClient;

    // Bahan uji yang dibuat di beforeAll & dibersihkan di afterAll.
    let communityId: string;
    let ownerUserId: string;
    let inviteeUserId: string;

    // Token invite yang dibuat per-contoh.
    const validToken = `it-valid-${crypto.randomUUID()}`.replace(/-/g, "");
    const expiredToken = `it-expired-${crypto.randomUUID()}`.replace(/-/g, "");

    /** Bangkitkan user auth uji lewat admin API service role; kembalikan id. */
    async function createTestUser(email: string): Promise<string> {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: `Pw-${crypto.randomUUID()}`,
        email_confirm: true,
      });
      if (error) throw error;
      return data.user.id;
    }

    beforeAll(async () => {
      db = createClient(TEST_URL!, TEST_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Buat owner + invitee sebagai user auth nyata (FK membership.user_id).
      ownerUserId = await createTestUser(
        `owner-${crypto.randomUUID()}@example.test`,
      );
      inviteeUserId = await createTestUser(
        `invitee-${crypto.randomUUID()}@example.test`,
      );

      // Buat community + membership owner langsung via service role (menembus RLS).
      // Kita seed langsung daripada RPC create_community_with_owner karena RPC
      // memakai auth.uid() (butuh sesi user); seed langsung lebih deterministik
      // untuk fokus contoh pada redeem_invite.
      const { data: community, error: cErr } = await db
        .from("community")
        .insert({ name: `IT Community ${crypto.randomUUID()}` })
        .select("id")
        .single();
      if (cErr) throw cErr;
      communityId = community.id as string;

      const { error: mErr } = await db.from("membership").insert({
        user_id: ownerUserId,
        community_id: communityId,
        role: "owner",
      });
      if (mErr) throw mErr;
    });

    afterAll(async () => {
      if (!db) return;
      // Bersihkan bahan uji (urutan aman terhadap FK): invite → membership →
      // community → user auth. Abaikan error pembersihan agar tidak menutupi
      // hasil assertion.
      await db.from("invite").delete().eq("community_id", communityId);
      await db.from("membership").delete().eq("community_id", communityId);
      await db.from("community").delete().eq("id", communityId);
      if (ownerUserId) await db.auth.admin.deleteUser(ownerUserId);
      if (inviteeUserId) await db.auth.admin.deleteUser(inviteeUserId);
    });

    // ------------------------------------------------------------------------
    // Contoh 1 — Trigger pg_net saat INSERT invite tidak melempar error, lalu
    // redeem_invite untuk token valid membuat membership admin + invite
    // 'accepted'. (Req 6.3 sebagian: INSERT memicu trigger tanpa error; Req 6.5.)
    // ------------------------------------------------------------------------
    it("Contoh 1: INSERT invite (memicu trigger) tidak error; redeem token valid → membership admin + invite 'accepted' (Req 6.3, 6.5)", async () => {
      // INSERT invite valid → memicu trigger `notify_invite_created` (pg_net →
      // Edge Function send-invite). Kita hanya memverifikasi INSERT tidak error;
      // pengiriman email TIDAK diverifikasi di sini (butuh Edge Function +
      // Resend ter-deploy; itu uji manual). *Req 6.3.*
      const { error: insErr } = await db.from("invite").insert({
        community_id: communityId,
        email: "invitee@example.test",
        role: "admin",
        token: validToken,
        status: "pending",
        expires_at: new Date(Date.now() + DEFAULT_EXPIRES_MS).toISOString(),
        invited_by: ownerUserId,
      });
      expect(insErr).toBeNull();

      // Redeem sebagai invitee: RPC redeem_invite pakai auth.uid(), maka kita
      // panggil melalui klien ber-JWT user invitee. Buat sesi user invitee.
      const inviteeDb = await signInAsUser(inviteeUserId);

      const { data, error } = await inviteeDb.rpc("redeem_invite", {
        p_token: validToken,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ ok: true, community_id: communityId });

      // Membership admin dibuat untuk invitee.
      const { data: mem } = await db
        .from("membership")
        .select("role")
        .eq("community_id", communityId)
        .eq("user_id", inviteeUserId)
        .single();
      expect(mem?.role).toBe("admin");

      // Invite ditandai 'accepted'.
      const { data: inv } = await db
        .from("invite")
        .select("status")
        .eq("token", validToken)
        .single();
      expect(inv?.status).toBe("accepted");
    });

    // ------------------------------------------------------------------------
    // Contoh 2 — Redeem kedua atas token yang sama ditolak 'used' (idempoten).
    // (Req 6.6, 6.8.)
    // ------------------------------------------------------------------------
    it("Contoh 2: redeem kedua token yang sama → ditolak 'used'; membership tetap satu (Req 6.6, 6.8)", async () => {
      const inviteeDb = await signInAsUser(inviteeUserId);

      const { data, error } = await inviteeDb.rpc("redeem_invite", {
        p_token: validToken,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ ok: false, reason: "used" });

      // Idempoten: tetap tepat satu membership invitee di community.
      const { data: mems } = await db
        .from("membership")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("user_id", inviteeUserId);
      expect(mems?.length).toBe(1);
    });

    // ------------------------------------------------------------------------
    // Contoh 3 — Invite kedaluwarsa ditolak 'expired' tanpa membuat membership.
    // (Req 6.7.)
    // ------------------------------------------------------------------------
    it("Contoh 3: redeem invite kedaluwarsa → ditolak 'expired' tanpa membership (Req 6.7)", async () => {
      // Buat user ketiga khusus contoh ini agar bebas dari membership contoh 1.
      const expiredUserId = await createTestUser(
        `expired-${crypto.randomUUID()}@example.test`,
      );

      try {
        // INSERT invite yang sudah kedaluwarsa (expires_at di masa lalu).
        const { error: insErr } = await db.from("invite").insert({
          community_id: communityId,
          email: "expired@example.test",
          role: "admin",
          token: expiredToken,
          status: "pending",
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          invited_by: ownerUserId,
        });
        expect(insErr).toBeNull();

        const expiredDb = await signInAsUser(expiredUserId);
        const { data, error } = await expiredDb.rpc("redeem_invite", {
          p_token: expiredToken,
        });
        expect(error).toBeNull();
        expect(data).toMatchObject({ ok: false, reason: "expired" });

        // Tidak ada membership untuk user ini.
        const { data: mem } = await db
          .from("membership")
          .select("user_id")
          .eq("community_id", communityId)
          .eq("user_id", expiredUserId);
        expect(mem?.length ?? 0).toBe(0);

        // Invite ditandai 'expired' (cermin update RPC).
        const { data: inv } = await db
          .from("invite")
          .select("status")
          .eq("token", expiredToken)
          .single();
        expect(inv?.status).toBe("expired");
      } finally {
        await db.auth.admin.deleteUser(expiredUserId);
      }
    });

    /**
     * Buat klien Supabase ber-JWT untuk `userId` tertentu supaya `auth.uid()`
     * di RPC terisi. Memakai admin generateLink untuk mendapatkan sesi tanpa
     * password, lalu set session pada klien anon baru. Bila cara ini tidak
     * didukung DB uji, test akan gagal dengan pesan jelas (bukan diam-diam).
     */
    async function signInAsUser(userId: string): Promise<SupabaseClient> {
      const { data: userData, error: uErr } =
        await db.auth.admin.getUserById(userId);
      if (uErr) throw uErr;
      const email = userData.user.email!;

      const { data: linkData, error: lErr } =
        await db.auth.admin.generateLink({ type: "magiclink", email });
      if (lErr) throw lErr;

      const tokenHash = linkData.properties.hashed_token;
      const userClient = createClient(TEST_URL!, TEST_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: vErr } = await userClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });
      if (vErr) throw vErr;
      return userClient;
    }
  },
);
