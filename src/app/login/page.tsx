"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";
import { isRateLimitError } from "@/lib/auth/error-message";

/**
 * Key localStorage tempat halaman `/invite` menyimpan invite token saat
 * mengarahkan user belum-login ke `/login`. Harus sama persis dengan
 * `PENDING_INVITE_KEY` di `auth-store.ts` & callback OAuth.
 */
const PENDING_INVITE_KEY = "tangkas.pendingInviteToken";

/**
 * Halaman login (Fase 2 — auth multi-tenant).
 *
 * Form Email/Password + tombol "Masuk dengan Google". Sukses → `/app`
 * (route guard mengarahkan lebih lanjut ke `/onboarding` bila perlu).
 * Gagal → tampilkan pesan error tanpa membuat sesi.
 *
 * Fokus: fungsional + i18n + accessible (label, tipe tombol). Enhancement
 * visual adalah fase lain — di sini hanya memakai util/komponen yang ada.
 */
export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const signInEmail = useAuthStore((s) => s.signInEmail);
  const signInGoogle = useAuthStore((s) => s.signInGoogle);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    haptic(15);
    setError(null);
    setSubmitting(true);
    try {
      // Bila user diarahkan dari /invite (belum login) ke /login, token
      // undangan tersimpan di localStorage. Teruskan ke signInEmail agar
      // setelah login sukses langsung di-redeem + auto-switch komunitas.
      const pendingInvite =
        typeof window !== "undefined"
          ? window.localStorage.getItem(PENDING_INVITE_KEY) ?? undefined
          : undefined;
      const res = await signInEmail(email.trim(), password, pendingInvite);
      if (res.ok) {
        // Token pending sudah dipakai (atau ditolak) di dalam signInEmail;
        // bersihkan agar tidak ter-redeem ulang di alur lain.
        if (pendingInvite && typeof window !== "undefined") {
          window.localStorage.removeItem(PENDING_INVITE_KEY);
        }
        // Guard di /app akan mengarahkan ke /onboarding bila belum ada community.
        router.push("/app");
        return;
      }
      // Gagal: pesan rate-limit → versi ramah; selain itu tampilkan pesan
      // Supabase apa adanya; fallback TERAKHIR ke pesan kredensial bila kosong.
      if (isRateLimitError(res.error)) {
        setError(t("auth.rateLimited"));
      } else {
        setError(res.error ?? t("auth.invalidCredentials"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    haptic(15);
    setError(null);
    // Melakukan redirect keluar aplikasi; tidak mengembalikan sesi langsung.
    await signInGoogle();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
            {t("auth.email")}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1 block text-sm font-medium"
          >
            {t("auth.password")}
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? t("auth.signingIn") : t("auth.login")}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>·</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onGoogle}
        disabled={submitting}
      >
        <Image
          src="/google.png"
          alt=""
          aria-hidden
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0 object-contain"
        />
        {t("auth.loginGoogle")}
      </Button>

      <p className="text-center text-sm">
        <Link href="/register" className="font-medium text-primary underline">
          {t("auth.toRegister")}
        </Link>
      </p>
    </main>
  );
}
