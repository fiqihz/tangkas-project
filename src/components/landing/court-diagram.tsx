"use client";

/**
 * Hero visual: diagram lapangan badminton (2v2) — satu orchestrated moment saat
 * load (garis ke-draw, shuttle jatuh, pemain pop). Statis setelahnya. Ikut tema
 * (warna dari currentColor / token). Reduced-motion dihormati via globals.css.
 *
 * Motif "lapangan" ini adalah bahasa visual utama landing (bukan kartu generik).
 */
export function CourtDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 260"
      className={className}
      role="img"
      aria-label="Diagram lapangan badminton dua lawan dua dengan shuttlecock di tengah"
      fill="none"
    >
      {/* Karpet lapangan */}
      <rect
        x="24"
        y="20"
        width="352"
        height="220"
        rx="10"
        className="fill-accent/5 stroke-border"
        strokeWidth="1"
      />

      {/* Garis lapangan — di-draw sekali saat load */}
      <g
        className="stroke-muted-foreground/50"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {/* Batas luar */}
        <rect
          x="48"
          y="40"
          width="304"
          height="180"
          className="court-line-anim"
          style={{ ["--dash" as string]: 970, animationDelay: "0.1s" }}
        />
        {/* Garis tengah (net) */}
        <line
          x1="200"
          y1="40"
          x2="200"
          y2="220"
          className="court-line-anim stroke-accent"
          style={{ ["--dash" as string]: 180, animationDelay: "0.35s" }}
          strokeDasharray="4 5"
        />
        {/* Garis servis */}
        <line
          x1="130"
          y1="40"
          x2="130"
          y2="220"
          className="court-line-anim"
          style={{ ["--dash" as string]: 180, animationDelay: "0.5s" }}
        />
        <line
          x1="270"
          y1="40"
          x2="270"
          y2="220"
          className="court-line-anim"
          style={{ ["--dash" as string]: 180, animationDelay: "0.55s" }}
        />
        {/* Garis tengah servis kiri & kanan */}
        <line
          x1="48"
          y1="130"
          x2="130"
          y2="130"
          className="court-line-anim"
          style={{ ["--dash" as string]: 82, animationDelay: "0.6s" }}
        />
        <line
          x1="270"
          y1="130"
          x2="352"
          y2="130"
          className="court-line-anim"
          style={{ ["--dash" as string]: 82, animationDelay: "0.62s" }}
        />
      </g>

      {/* Tim A (hijau/shuttle) — kiri */}
      <g className="player-anim" style={{ animationDelay: "0.75s" }}>
        <circle cx="88" cy="90" r="13" className="fill-primary" />
        <text
          x="88"
          y="94"
          textAnchor="middle"
          className="fill-primary-foreground font-display"
          fontSize="11"
          fontWeight="700"
        >
          A1
        </text>
      </g>
      <g className="player-anim" style={{ animationDelay: "0.85s" }}>
        <circle cx="88" cy="170" r="13" className="fill-primary" />
        <text
          x="88"
          y="174"
          textAnchor="middle"
          className="fill-primary-foreground font-display"
          fontSize="11"
          fontWeight="700"
        >
          A2
        </text>
      </g>

      {/* Tim B (teal/accent) — kanan */}
      <g className="player-anim" style={{ animationDelay: "0.8s" }}>
        <circle cx="312" cy="90" r="13" className="fill-accent" />
        <text
          x="312"
          y="94"
          textAnchor="middle"
          className="fill-accent-foreground font-display"
          fontSize="11"
          fontWeight="700"
        >
          B1
        </text>
      </g>
      <g className="player-anim" style={{ animationDelay: "0.9s" }}>
        <circle cx="312" cy="170" r="13" className="fill-accent" />
        <text
          x="312"
          y="174"
          textAnchor="middle"
          className="fill-accent-foreground font-display"
          fontSize="11"
          fontWeight="700"
        >
          B2
        </text>
      </g>

      {/* Shuttlecock — jatuh di tengah net */}
      <g className="shuttle-anim">
        <circle cx="200" cy="118" r="6" className="fill-foreground" />
        <path
          d="M200 112 L194 98 M200 112 L200 96 M200 112 L206 98"
          className="stroke-muted-foreground"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
