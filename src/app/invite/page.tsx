"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/store/settings-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { inviteMessageKey } from "@/lib/invite/invite-message";

/**
 * Key localStorage untuk menyimpan invite token sementara saat user belum
 * login diarahkan ke /login atau /register. Harus sama persis dengan
 * `PENDING_INVITE_KEY` di `auth-store.ts`, callback OAuth, dan halaman login.
 */
const PENDING_INVITE_KEY = "tangkas.pendingInviteToken";

/**
 * Isi halaman "terima undangan pintar". Dipisah agar bisa dibungkus <Suspense>:
 * `useSearchParams` di App Router memerlukan boundary Suspense.
 *
 * Alur (client-only, mengikuti status auth-store):
 * - status `loading` → panggil init() untuk menentukan sesi, tampilkan spinner.
 * - status `signedOut` → simpan token ke localStorage lalu arahkan ke
 *   /register?invite=TOKEN (alur register existing akan redeem). Sediakan juga
 *   tautan ke /login (login juga akan redeem token pending).
 * - status `ready`/`needsOnboarding` (SUDAH login) → langsung redeem token via
 *   auth-store.redeemInviteToken (menangani loadMemberships + auto-switch).
 *     * Sukses → router.replace("/app").
 *     * Gagal → tampilkan pesan sesuai reason + tautan ke /app.
 */
function InviteLanding() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;

  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);
  const redeemInviteToken = useAuthStore((s) => s.redeemInviteToken);

  // Pesan error redeem (bila gagal untuk user yang sudah login).
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // State hasil eksplisit: true setelah redeem sukses. Dipakai untuk memicu
  // navigasi ke /app lewat effect terpisah (lihat di bawah), sehingga navigasi
  // tidak bergantung pada satu titik saja dan tetap terjadi setelah commit
  // render meskipun status auth-store berubah beberapa kali.
  const [done, setDone] = useState(false);
  // Guard agar redeem hanya dijalankan sekali (StrictMode / re-render). Hanya
  // di-set true ketika benar-benar mulai redeem di status authenticated —
  // TIDAK saat status masih "loading" — agar retry yang sah tetap bisa jalan.
  const redeemedRef = useRef(false);

  // Muat sesi bila belum ditentukan.
  useEffect(() => {
    if (status === "loading") void init();
  }, [status, init]);

  useEffect(() => {
    // Token wajib ada & sesi harus sudah ditentukan sebelum lanjut.
    if (!token) return;
    if (status === "loading") return;

    if (status === "signedOut") {
      // Simpan token agar login/registrasi berikutnya bisa me-redeem, lalu
      // arahkan ke register (alur daftar existing akan redeem).
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PENDING_INVITE_KEY, token);
      }
      router.replace(`/register?invite=${encodeURIComponent(token)}`);
      return;
    }

    // status ready / needsOnboarding → user sudah login, redeem langsung.
    if (redeemedRef.current) return;
    redeemedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await redeemInviteToken(token);
        if (cancelled) return;
        if (res.ok) {
          // Token pending (bila ada dari alur sebelumnya) sudah tak relevan.
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(PENDING_INVITE_KEY);
          }
          // Tandai selesai + langsung coba navigasi. Effect `done` di bawah
          // menjamin navigasi tetap terjadi setelah commit render.
          setDone(true);
          router.replace("/app");
          return;
        }
        setErrorMsg(t(inviteMessageKey(res.reason)));
      } catch {
        if (cancelled) return;
        setErrorMsg(t("invite.invalid"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, status, router, redeemInviteToken, t]);

  // Navigasi handal ke /app setelah redeem sukses. Redundan dengan
  // router.replace di atas, tapi memastikan navigasi terjadi setelah commit
  // render — tidak ter-drop oleh update state auth-store yang beruntun
  // (loadMemberships dari listener + dari redeemInviteToken).
  useEffect(() => {
    if (done) router.replace("/app");
  }, [done, router]);

  // Untuk user belum login, kita sudah replace ke /register — tampilkan pesan
  // ringkas + tautan login sementara redirect berlangsung.
  const showNeedLogin = status === "signedOut" && !!token;
  // Token hilang dari URL → langsung anggap undangan tidak valid (dihitung saat
  // render, tanpa setState di effect).
  const effectiveError = !token ? t("invite.invalid") : errorMsg;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        {t("invite.title")}
      </h1>

      {effectiveError ? (
        <>
          <p role="alert" className="text-sm text-destructive">
            {effectiveError}
          </p>
          <Link
            href="/app"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("landing.footer.openApp")}
          </Link>
        </>
      ) : showNeedLogin ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {t("invite.needLogin")}
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("auth.toLogin")}
          </Link>
        </>
      ) : (
        <>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
            aria-hidden
          />
          <p
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {t("invite.accepting")}
          </p>
        </>
      )}
    </main>
  );
}

/**
 * Halaman `/invite` — landing "terima undangan pintar". Membungkus
 * `InviteLanding` dalam <Suspense> karena memakai `useSearchParams`.
 */
export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteLanding />
    </Suspense>
  );
}
