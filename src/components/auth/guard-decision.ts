import type { AuthStatus } from "@/lib/store/auth-store";

/**
 * Aksi yang harus diambil route guard `/app` untuk suatu status auth.
 * Memisahkan keputusan (fungsi murni, mudah diuji) dari efek samping
 * (redirect / render) yang dijalankan komponen `RouteGuard`.
 *
 * - `loading`      → tampilkan loader (guard render null) sambil sesi dibaca.
 * - `toLogin`      → redirect ke `/login` (belum sign-in).
 * - `toOnboarding` → redirect ke `/onboarding` (sudah sign-in, belum punya community).
 * - `render`       → tampilkan konten aplikasi (`children`).
 */
export type GuardAction = "loading" | "toLogin" | "toOnboarding" | "render";

/**
 * Petakan `auth-store.status` → aksi guard. Deterministik & tanpa I/O.
 *
 * _Requirements: 1.7, 2.1, 2.3, 3.2, 3.4_
 * _Design: Components and Interfaces → 3. Route guard_
 */
export function guardDecision(status: AuthStatus): GuardAction {
  switch (status) {
    case "signedOut":
      return "toLogin";
    case "needsOnboarding":
      return "toOnboarding";
    case "ready":
      return "render";
    case "loading":
    default:
      return "loading";
  }
}
