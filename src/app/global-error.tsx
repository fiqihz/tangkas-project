"use client";

import { useEffect } from "react";

/**
 * Error boundary level ROOT (menangkap error yang terjadi di root layout).
 * Karena menggantikan layout, komponen ini WAJIB me-render <html> dan <body>
 * sendiri. Pakai inline style agar tidak bergantung pada CSS global yang
 * mungkin belum ter-load saat root gagal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TangkasBoard] Global error:", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#0f172a",
          background: "#ffffff",
        }}
      >
        <div style={{ fontSize: "3rem" }}>🏸</div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Aplikasi gagal dimuat
          </h1>
          <p
            style={{
              marginTop: "0.25rem",
              fontSize: "0.875rem",
              color: "#64748b",
            }}
          >
            Terjadi error tak terduga di level utama. Coba muat ulang.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
            maxWidth: "20rem",
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              minHeight: "44px",
              width: "100%",
              borderRadius: "0.75rem",
              border: "none",
              background: "#16a34a",
              color: "#ffffff",
              fontWeight: 500,
            }}
          >
            Coba lagi
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              minHeight: "44px",
              width: "100%",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              background: "transparent",
              color: "#0f172a",
              fontWeight: 500,
            }}
          >
            Muat ulang halaman
          </button>
        </div>
      </body>
    </html>
  );
}
