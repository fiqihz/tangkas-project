"use client";

// ============================================================================
// Gembok password bersama (Opsi B).
// Sederhana & client-side: cukup untuk menahan orang iseng, sesuai kesepakatan.
// Untuk keamanan sungguhan (Opsi C) nanti diganti Supabase Auth.
// ============================================================================

const STORAGE_KEY = "tangkasboard_unlocked";

/** Password bersama dari env (di-set saat deploy). */
export function appPassword(): string | null {
  return process.env.NEXT_PUBLIC_APP_PASSWORD ?? null;
}

/** Apakah gembok password diaktifkan (password di-set & tidak kosong). */
export function isGateEnabled(): boolean {
  const p = appPassword();
  return Boolean(p && p.trim().length > 0);
}

/** Apakah sesi browser sudah terbuka (unlocked). */
export function isUnlocked(): boolean {
  if (!isGateEnabled()) return true; // tanpa password = selalu terbuka
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/** Coba buka gembok dengan input password. Return true bila cocok. */
export function tryUnlock(input: string): boolean {
  if (!isGateEnabled()) return true;
  if (input === appPassword()) {
    window.localStorage.setItem(STORAGE_KEY, "1");
    return true;
  }
  return false;
}

/** Kunci kembali (logout). */
export function lock(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
