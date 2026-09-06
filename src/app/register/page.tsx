"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/store/settings-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { isRateLimitError } from "@/lib/auth/error-message";
import { inviteMessageKey } from "@/lib/invite/invite-message";

/**
 * Isi halaman register. Dipisah dari default export agar bisa dibungkus
 * <Suspense>: `useSearchParams` di App Router memerlukan boundary Suspense
 * (kalau tidak, `next build` gagal pada prerender).
 */
function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Token undangan (opsional) dari tautan email: /register?invite=TOKEN.
  const inviteToken = searchParams.get("invite") ?? undefined;

  const signUpEmail = useAuthStore((s) => s.signUpEmail);
  const signInGoogle = useAuthStore((s) => s.signInGoogle);
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  // Pastikan sesi termuat: bila auth-store masih loading (mis. deep-link ke
  // /register dari email), jalankan init() sekali untuk menentukan status.
  useEffect(() => {
    if (status === "loading") void init();
  }, [status, init]);

  // User yang SUDAH login membuka tautan /register?invite=TOKEN tidak perlu
  // mendaftar lagi. Pusatkan logika redeem-untuk-user-login di halaman /invite
  // agar tetap DRY: cukup arahkan ke sana.
  useEffect(() => {
    if (
      inviteToken &&
      (status === "ready" || status === "needsOnboarding")
    ) {
      router.replace(`/invite?token=${encodeURIComponent(inviteToken)}`);
    }
  }, [inviteToken, status, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Pesan error pendaftaran (gagal register → tidak redirect).
  const [error, setError] = useState<string | null>(null);
  // Pesan terkait invite (redeem gagal tapi akun tetap dibuat).
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setInviteMsg(null);
    setSubmitting(true);
    try {
      const res = await signUpEmail(email.trim(), password, inviteToken);
      if (!res.ok) {
        // Gagal register → tampilkan error sebenarnya (jangan redirect).
        // Rate-limit → versi ramah; error lain → pesan Supabase apa adanya;
        // fallback generik netral (BUKAN "password salah") bila kosong.
        if (isRateLimitError(res.error)) {
          setError(t("auth.rateLimited"));
        } else {
          setError(res.error ?? t("auth.genericError"));
        }
        setSubmitting(false);
        return;
      }
      // Register sukses. Bila redeem invite gagal (res.error terisi meski
      // ok:true), tampilkan pesan invite sesuai reason — tapi tetap arahkan
      // user karena akunnya sudah dibuat.
      if (res.error) {
        setInviteMsg(t(inviteMessageKey(res.error)));
      }
      router.push("/app");
    } catch (e) {
      // Error tak terduga → pesan generik netral (bukan "password salah");
      // rate-limit yang ter-throw tetap dipetakan ke versi ramah.
      const msg = e instanceof Error ? e.message : undefined;
      setError(isRateLimitError(msg) ? t("auth.rateLimited") : t("auth.genericError"));
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (submitting) return;
    setError(null);
    setInviteMsg(null);
    setSubmitting(true);
    // Redirect keluar aplikasi; token disimpan store untuk redeem pasca-callback.
    await signInGoogle(inviteToken);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          {t("auth.register")}
        </h1>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-email"
              className="text-sm font-medium text-foreground"
            >
              {t("auth.email")}
            </label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="register-password"
              className="text-sm font-medium text-foreground"
            >
              {t("auth.password")}
            </label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {inviteMsg && (
            <p role="status" className="text-sm text-muted-foreground">
              {inviteMsg}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? t("auth.signingIn") : t("auth.register")}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-3 w-full"
          disabled={submitting}
          onClick={onGoogle}
        >
          {t("auth.registerGoogle")}
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.toLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * Halaman register (`/register`). Membungkus `RegisterForm` dalam <Suspense>
 * karena form memakai `useSearchParams` (butuh Suspense boundary di App Router).
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
