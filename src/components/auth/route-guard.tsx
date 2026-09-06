"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { guardDecision } from "./guard-decision";

/**
 * Route guard untuk `/app`. Menggerakkan navigasi berdasarkan
 * `auth-store.status`:
 * - `loading` → render null (loader ringan) sambil sesi dibaca.
 * - `signedOut` → redirect ke `/login`.
 * - `needsOnboarding` → redirect ke `/onboarding`.
 * - `ready` → render `children`.
 *
 * Redirect dijalankan di dalam `useEffect` (bukan saat render) agar tidak
 * memicu update Router selama fase render.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  // Inisialisasi sesi sekali saat mount bila status masih "loading".
  useEffect(() => {
    if (status === "loading") {
      void init();
    }
    // Hanya dijalankan sekali saat mount; init sendiri idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const action = guardDecision(status);

  // Redirect di luar fase render agar tidak update Router saat render.
  useEffect(() => {
    if (action === "toLogin") {
      router.replace("/login");
    } else if (action === "toOnboarding") {
      router.replace("/onboarding");
    }
  }, [action, router]);

  if (action === "render") {
    return <>{children}</>;
  }

  // loading / toLogin / toOnboarding → tidak render konten app.
  return null;
}
