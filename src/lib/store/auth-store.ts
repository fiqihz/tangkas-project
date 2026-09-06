"use client";

import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";
import * as repo from "@/lib/supabase/repo";
import type { Membership } from "@/lib/supabase/repo";
import { resolveActiveCommunity } from "@/lib/store/active-community";

/**
 * Keanggotaan user pada sebuah community (bentuk siap-UI).
 * Sumber kanonik tipe ada di `repo.ts` (`repo.listMyMemberships()`); di-re-export
 * di sini agar konsumen store tidak perlu tahu asal tipenya.
 */
export type { Membership };

/** Status auth + konteks tenant yang menggerakkan route guard. */
export type AuthStatus = "loading" | "signedOut" | "needsOnboarding" | "ready";

/**
 * Key localStorage untuk menyimpan community aktif terakhir yang dipilih user.
 * Dipakai untuk resolusi `activeCommunityId` saat memuat memberships.
 */
const ACTIVE_COMMUNITY_KEY = "tangkas.activeCommunityId";

/**
 * Key localStorage sementara untuk menyimpan invite token pada alur OAuth
 * Google (redirect). Karena `signInGoogle` melakukan redirect keluar aplikasi,
 * token disimpan agar bisa di-redeem setelah callback kembali.
 */
const PENDING_INVITE_KEY = "tangkas.pendingInviteToken";

/** Baca activeCommunityId tersimpan dari localStorage (aman di server). */
function readStoredActiveCommunity(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_COMMUNITY_KEY);
}

/** Persist activeCommunityId ke localStorage (aman di server). */
function persistActiveCommunity(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_COMMUNITY_KEY, id);
  else window.localStorage.removeItem(ACTIVE_COMMUNITY_KEY);
}

/** Ekstrak pesan error yang manusiawi dari objek error apa pun. */
function describe(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Terjadi kesalahan tak terduga.";
}

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  memberships: Membership[];
  activeCommunityId: string | null;

  /** Baca sesi Supabase + subscribe onAuthStateChange + load memberships. */
  init: () => Promise<void>;
  /**
   * Login email/password. Sukses → set sesi + load memberships. Bila
   * `inviteToken` diberikan, token di-redeem setelah login sukses (auto-switch
   * ke komunitas undangan). Kegagalan redeem tidak membatalkan login.
   */
  signInEmail: (
    email: string,
    password: string,
    inviteToken?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Daftar email/password (+ redeem invite bila ada) lalu load memberships. */
  signUpEmail: (
    email: string,
    password: string,
    inviteToken?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Login via Google OAuth (redirect; tidak mengembalikan sesi langsung). */
  signInGoogle: (inviteToken?: string) => Promise<void>;
  /** Logout: bersihkan sesi + konteks tenant. */
  signOut: () => Promise<void>;
  /**
   * Redeem invite token untuk user yang SUDAH login. Sukses → reload
   * memberships lalu auto-switch ke komunitas hasil undangan (bila ada
   * communityId). Dipakai halaman `/invite` & callback OAuth.
   */
  redeemInviteToken: (
    token: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  /** Muat memberships → set status ready/needsOnboarding + resolusi active. */
  loadMemberships: () => Promise<void>;
  /** Pilih community aktif + persist ke localStorage. */
  setActiveCommunity: (id: string) => void;
}

// Guard agar init() tidak memasang listener onAuthStateChange lebih dari sekali
// (mis. StrictMode / re-mount). Disimpan di level modul, bukan state React.
let authSubscribed = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  userId: null,
  memberships: [],
  activeCommunityId: null,

  async init() {
    const supabase = getSupabase();

    // Pasang listener sekali saja: sign-in/out/refresh langsung memperbarui
    // status + memberships sehingga route guard ikut bereaksi.
    if (!authSubscribed) {
      authSubscribed = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        const userId = session?.user?.id ?? null;
        if (!userId) {
          set({
            status: "signedOut",
            userId: null,
            memberships: [],
            activeCommunityId: null,
          });
          return;
        }
        set({ userId });
        void get().loadMemberships();
      });
    }

    // Baca sesi awal.
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;
    if (!userId) {
      set({ status: "signedOut", userId: null, memberships: [] });
      return;
    }
    set({ userId });
    await get().loadMemberships();
  },

  async signInEmail(email, password, inviteToken) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: describe(error) };
    set({ userId: data.user?.id ?? null });
    await get().loadMemberships();

    // Login lewat undangan: redeem token setelah sesi ada. Kegagalan redeem
    // (mis. email_mismatch/expired) tidak membatalkan login.
    if (inviteToken) {
      try {
        const res = await get().redeemInviteToken(inviteToken);
        if (!res.ok) return { ok: true, error: res.reason ?? "invalid" };
      } catch (e) {
        return { ok: true, error: describe(e) };
      }
    }
    return { ok: true };
  },

  async signUpEmail(email, password, inviteToken) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: describe(error) };
    set({ userId: data.user?.id ?? null });

    // Bila mendaftar lewat undangan, tukarkan token → membership admin.
    // Akun sudah terlanjur dibuat, jadi kegagalan redeem TIDAK membatalkan
    // pendaftaran (tetap ok:true). Alasan penolakan (mis. expired/used/
    // not_found) dikembalikan lewat `error` agar UI bisa menampilkan pesan
    // invite yang sesuai, sementara user tetap diarahkan masuk.
    if (inviteToken) {
      try {
        const res = await repo.redeemInvite(inviteToken);
        if (!res.ok) {
          await get().loadMemberships();
          return { ok: true, error: res.reason ?? "invalid" };
        }
        // Redeem sukses → muat memberships lalu auto-switch ke komunitas
        // undangan agar user langsung berada di konteks yang benar.
        await get().loadMemberships();
        if (res.communityId) get().setActiveCommunity(res.communityId);
        return { ok: true };
      } catch (e) {
        await get().loadMemberships();
        return { ok: true, error: describe(e) };
      }
    }

    await get().loadMemberships();
    return { ok: true };
  },

  async signInGoogle(inviteToken) {
    const supabase = getSupabase();
    // Simpan token sementara agar bisa di-redeem setelah callback OAuth kembali.
    if (typeof window !== "undefined") {
      if (inviteToken)
        window.localStorage.setItem(PENDING_INVITE_KEY, inviteToken);
      else window.localStorage.removeItem(PENDING_INVITE_KEY);
    }
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    // Redirect terjadi di sini; tidak ada sesi yang dikembalikan langsung.
  },

  async signOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    persistActiveCommunity(null);
    set({
      status: "signedOut",
      userId: null,
      memberships: [],
      activeCommunityId: null,
    });
  },

  async redeemInviteToken(token) {
    const res = await repo.redeemInvite(token);
    if (!res.ok) return { ok: false, reason: res.reason };
    // Sukses: user kini punya membership admin tambahan. Reload memberships
    // lalu auto-switch ke komunitas hasil undangan (komunitas lama tetap ada).
    await get().loadMemberships();
    if (res.communityId) get().setActiveCommunity(res.communityId);
    return { ok: true };
  },

  async loadMemberships() {
    const memberships = await repo.listMyMemberships();
    if (memberships.length === 0) {
      set({ memberships, status: "needsOnboarding", activeCommunityId: null });
      return;
    }

    // Resolusi active_community lewat fungsi murni (lihat
    // `active-community.ts`): pakai id tersimpan bila masih ada di daftar,
    // jika tidak pilih membership pertama. localStorage tetap dikelola di sini.
    const storedId = readStoredActiveCommunity();
    const active = resolveActiveCommunity(memberships, storedId);

    persistActiveCommunity(active);
    set({ memberships, status: "ready", activeCommunityId: active });
  },

  setActiveCommunity(id) {
    persistActiveCommunity(id);
    set({ activeCommunityId: id });
  },
}));
