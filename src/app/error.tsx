"use client";

import { useEffect } from "react";

/**
 * Error boundary level route (App Router). Menangkap error render/efek di
 * dalam pohon halaman sehingga user TIDAK melihat layar putih kosong saat
 * ada yang gagal (mis. data tak terduga, bug render). Menyediakan tombol
 * "Coba lagi" (reset) dan "Muat ulang" (reload penuh) untuk pemulihan cepat
 * di tengah sesi.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log ke console agar terlihat saat inspect di HP/desktop.
    console.error("[TangkasBoard] Route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="text-5xl">🏸</div>
      <div>
        <h1 className="text-xl font-bold">Ada yang tidak beres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Terjadi error tak terduga. Data mabar kamu aman — coba lagi atau muat
          ulang halaman.
        </p>
      </div>

      {error?.message && (
        <pre className="max-h-32 w-full overflow-auto rounded-lg bg-secondary p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}

      <div className="flex w-full flex-col gap-2">
        <button
          onClick={() => reset()}
          className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground active:scale-95 active:bg-primary/90"
        >
          Coba lagi
        </button>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[44px] w-full rounded-xl border border-border bg-transparent px-4 py-2 font-medium active:scale-95 active:bg-secondary"
        >
          Muat ulang halaman
        </button>
      </div>
    </main>
  );
}
