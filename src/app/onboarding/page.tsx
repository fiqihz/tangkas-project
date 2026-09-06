"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/store/settings-store";
import * as repo from "@/lib/supabase/repo";
import { haptic } from "@/lib/haptics";

/**
 * Halaman onboarding (`/onboarding`) — Fase 2 auth multi-tenant.
 *
 * Ditujukan untuk user yang sudah login namun belum punya community
 * (`status === "needsOnboarding"`). User memasukkan nama community lalu submit;
 * memanggil RPC `create_community_with_owner` (via repo) yang membuat community,
 * membership owner, dan mengklaim data lama secara atomik (idempoten — cukup
 * dipanggil sekali). Setelah sukses: muat ulang memberships di auth-store lalu
 * arahkan ke `/app`. Bila gagal: tampilkan pesan error dan tetap di halaman.
 *
 * Guard berbasis `auth-store.status`:
 * - `loading` → panggil `init()`, render null sambil sesi dibaca.
 * - `signedOut` → redirect `/login`.
 * - `ready` (sudah punya community) → redirect `/app`.
 * - `needsOnboarding` → tampilkan form.
 *
 * Fokus: fungsional + i18n + accessible; bukan enhancement visual.
 */
export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);
  const loadMemberships = useAuthStore((s) => s.loadMemberships);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inisialisasi sesi sekali saat mount bila status masih "loading".
  useEffect(() => {
    if (status === "loading") {
      void init();
    }
    // Hanya sekali saat mount; init sendiri idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect di luar fase render agar tidak update Router saat render.
  useEffect(() => {
    if (status === "signedOut") {
      router.replace("/login");
    } else if (status === "ready") {
      router.replace("/app");
    }
  }, [status, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    haptic(15);
    setError(null);
    setSubmitting(true);
    try {
      // RPC atomik: buat community + membership owner + klaim data lama.
      await repo.createCommunityWithOwner(trimmed);
      // Muat ulang memberships → status berubah ke "ready" + set activeCommunityId.
      await loadMemberships();
      router.push("/app");
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : t("auth.invalidCredentials"),
      );
      setSubmitting(false);
    }
  };

  // Hanya tampilkan form saat butuh onboarding; state lain ditangani guard.
  if (status !== "needsOnboarding") {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("onboarding.title")}</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label
            htmlFor="onboarding-name"
            className="mb-1 block text-sm font-medium"
          >
            {t("onboarding.communityName")}
          </label>
          <Input
            id="onboarding-name"
            type="text"
            autoComplete="off"
            placeholder={t("onboarding.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={submitting || name.trim().length === 0}
        >
          {submitting ? t("onboarding.creating") : t("onboarding.create")}
        </Button>
      </form>
    </main>
  );
}
