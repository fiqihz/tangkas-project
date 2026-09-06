"use client";

import type { ReactNode } from "react";

/**
 * Empty-state bermotif lapangan badminton — membawa bahasa visual landing
 * (court-diagram) ke dalam /app di tempat yang tepat (layar kosong), bukan
 * dekorasi acak. Statis & ringan (tanpa motion) agar tidak mengganggu, ikut
 * tema lewat token warna (currentColor/fill token). Dipakai saat belum ada
 * sesi / pemain / skor.
 */
export function EmptyCourt({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <CourtGlyph className="h-auto w-40 max-w-full" />
      <h3 className="mt-5 font-display text-base font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Mini court glyph — versi ringkas court-diagram: petak lapangan + net + satu
 * shuttle di tengah. Garis pakai token muted; net & shuttle pakai aksen agar
 * konsisten dengan landing (teal accent + foreground).
 */
function CourtGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 130"
      className={className}
      role="img"
      aria-label="Ilustrasi lapangan badminton"
      fill="none"
    >
      {/* Karpet */}
      <rect
        x="10"
        y="10"
        width="180"
        height="110"
        rx="8"
        className="fill-accent/5 stroke-border"
        strokeWidth="1"
      />
      {/* Garis lapangan */}
      <g className="stroke-muted-foreground/40" strokeWidth="1.25" strokeLinecap="round">
        <rect x="26" y="24" width="148" height="82" />
        <line x1="72" y1="24" x2="72" y2="106" />
        <line x1="128" y1="24" x2="128" y2="106" />
        <line x1="26" y1="65" x2="72" y2="65" />
        <line x1="128" y1="65" x2="174" y2="65" />
      </g>
      {/* Net (aksen teal, putus-putus) */}
      <line
        x1="100"
        y1="24"
        x2="100"
        y2="106"
        className="stroke-accent"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      {/* Shuttle di tengah net */}
      <g>
        <circle cx="100" cy="62" r="4.5" className="fill-foreground" />
        <path
          d="M100 57.5 L95 46 M100 57.5 L100 45 M100 57.5 L105 46"
          className="stroke-muted-foreground"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
