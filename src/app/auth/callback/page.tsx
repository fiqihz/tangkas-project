"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Key localStorage tempat `signInGoogle` (auth-store) menyimpan invite token
 * sebelum redirect OAuth. Harus sama persis dengan `PENDING_INVITE_KEY` di
 * `auth-store.ts` agar token bisa ditemukan setelah callback kembali.
 */
const PENDING_INVITE_KEY = "tangkas.pendingInviteToken";

/**
 * Halaman callback OAuth Google (OPSI A — client-only).
 *
 * Arsitektur project ini memakai Supabase *browser* client dengan
 * `detectSessionInUrl: true` + `persistSession: true` (lihat
 * `src/lib/supabase/client.ts`). Karena tidak ada Supabase server client,
 * penyelesaian sesi paling konsisten dilakukan di client:
 *
 * 1. Saat mount, `getSession()` memicu / menunggu `detectSessionInUrl` menukar
 *    token dari URL hash menjadi sesi persisten.
 * 2. Bila ada sesi: redeem pending invite token dari localStorage (bila ada),
 *    lalu jalankan `init()` auth-store untuk memuat memberships, dan
 *    `router.replace("/app")` (RouteGuard akan mengarahkan ke onboarding bila
 *    belum punya community).
 * 3. Bila tidak ada sesi (OAuth dibatalkan/gagal): `router.replace("/login")`.
 *
 * Sengaja TIDAK memakai `useSearchParams` — token OAuth ada di URL *hash* yang
 * sudah ditangani `detectSessionInUrl`, sehingga tidak perlu Suspense boundary.
 *
 * _Requirements: 1.2._
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const init = useAuthStore((s) => s.init);
  const redeemInviteToken = useAuthStore((s) => s.redeemInviteToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function finishCallback() {
      try {
        const supabase = getSupabase();
        // Memicu/menunggu detectSessionInUrl menukar hash menjadi sesi.
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!data.session) {
          setFailed(true);
          router.replace("/login");
          return;
        }

        // Muat sesi + memberships ke auth-store lebih dulu agar redeem
        // berjalan di atas sesi yang sudah aktif.
        await init();
        if (cancelled) return;

        // Redeem invite yang ditunda (alur "Terima undangan + Google").
        // Pakai action store `redeemInviteToken` yang menangani loadMemberships
        // + auto-switch ke komunitas hasil undangan. Kegagalan redeem tidak
        // boleh menggagalkan login — cukup dilewati.
        if (typeof window !== "undefined") {
          const token = window.localStorage.getItem(PENDING_INVITE_KEY);
          if (token) {
            try {
              await redeemInviteToken(token);
            } catch {
              // Abaikan: user tetap login walau redeem gagal (mis. token
              // kedaluwarsa). Pesan bisa ditampilkan di alur kelola admin.
            } finally {
              window.localStorage.removeItem(PENDING_INVITE_KEY);
            }
          }
        }

        if (cancelled) return;
        router.replace("/app");
      } catch {
        if (cancelled) return;
        setFailed(true);
        router.replace("/login");
      }
    }

    void finishCallback();
    return () => {
      cancelled = true;
    };
    // Dijalankan sekali saat mount; init/router stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {failed ? "Mengarahkan ke halaman masuk…" : "Menyelesaikan masuk…"}
      </p>
    </main>
  );
}
