// ============================================================================
// Layout gambar hasil mabar untuk next/og (Satori).
// ============================================================================
// Catatan Satori: hanya subset CSS flexbox yang didukung, semua style inline,
// dan setiap <div> ber-anak lebih dari satu harus `display: flex`. Emoji tidak
// dipakai (butuh unduhan Twemoji saat render) — medali digambar sebagai
// lingkaran berwarna.
// ============================================================================
import { DICT, type DictKey, type Lang } from "@/lib/i18n/dict";
import type { ShareImagePayload, ShareImageRow } from "@/lib/share-image";

const C = {
  bg: "#0B1220",
  bgTop: "#0F2E30",
  teal: "#2DD4BF",
  tealLine: "rgba(45,212,191,0.14)",
  text: "#F1F5F9",
  muted: "#94A3B8",
  row: "rgba(255,255,255,0.05)",
  pillar: "rgba(255,255,255,0.08)",
  gold: "#FBBF24",
  silver: "#CBD5E1",
  bronze: "#D8894A",
};

const MEDAL: Record<number, string> = { 1: C.gold, 2: C.silver, 3: C.bronze };

const DIM = {
  story: {
    pad: 88,
    brand: 34,
    logo: 56,
    title: 88,
    meta: 34,
    gapTop: 80,
    avatar1: 170,
    avatar: 132,
    avatarFont1: 76,
    avatarFont: 58,
    podName: 46,
    podNameMax: 11,
    podStat: 30,
    pillar: { 1: 300, 2: 220, 3: 170 } as Record<number, number>,
    pillarNum: 88,
    gapMid: 72,
    rowH: 88,
    rowFont: 38,
    rowGap: 14,
    more: 30,
    footer: 30,
    footerLogo: 44,
  },
  square: {
    pad: 60,
    brand: 26,
    logo: 40,
    title: 60,
    meta: 26,
    gapTop: 32,
    avatar1: 100,
    avatar: 80,
    avatarFont1: 46,
    avatarFont: 36,
    podName: 32,
    podNameMax: 15,
    podStat: 22,
    pillar: { 1: 112, 2: 84, 3: 66 } as Record<number, number>,
    pillarNum: 40,
    gapMid: 28,
    rowH: 48,
    rowFont: 26,
    rowGap: 6,
    more: 22,
    footer: 22,
    footerLogo: 32,
  },
};

type Dim = (typeof DIM)["story"];

function tr(key: DictKey, lang: Lang, vars?: Record<string, string | number>) {
  const raw: string = DICT[key]?.[lang] ?? DICT[key]?.id ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

/**
 * Potong teks per karakter. Dipakai untuk nama podium yang rata-tengah: di
 * Satori, ellipsis CSS pada teks rata-tengah memotong dari KIRI juga, jadi
 * pemotongan dilakukan manual.
 */
function clip(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : s;
}

const ellipsis = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
} as const;

export function ShareCard({
  data,
  logoSrc,
  host,
}: {
  data: ShareImagePayload;
  logoSrc: string;
  host: string;
}) {
  const d = DIM[data.format];
  const lang = data.lang;
  const podium = data.rows.slice(0, 3);
  const rest = data.rows.slice(3);
  const moreCount = Math.max(0, data.playerCount - data.rows.length);

  const meta = [
    data.dateLabel,
    tr("shareImage.matches", lang, { n: data.matchCount }),
    tr("shareImage.players", lang, { n: data.playerCount }),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: C.bg,
        backgroundImage: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bg} 55%)`,
        color: C.text,
        fontFamily: "Inter",
        padding: d.pad,
      }}
    >
      {/* Motif lapangan: garis luar + garis net, samar di belakang konten. */}
      <div
        style={{
          position: "absolute",
          top: d.pad / 2,
          left: d.pad / 2,
          right: d.pad / 2,
          bottom: d.pad / 2,
          border: `3px solid ${C.tealLine}`,
          borderRadius: 24,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: d.pad / 2,
          right: d.pad / 2,
          top: "50%",
          height: 3,
          backgroundColor: C.tealLine,
          display: "flex",
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={d.logo} height={d.logo} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: d.brand,
            color: C.teal,
            fontWeight: 600,
            letterSpacing: 1,
            ...ellipsis,
          }}
        >
          {data.communityName
            ? `${data.communityName}  ·  ${tr("shareImage.finalResult", lang)}`
            : tr("shareImage.finalResult", lang)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: d.brand * 0.6,
          fontFamily: "Space Grotesk",
          fontSize: d.title,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: -1,
          ...ellipsis,
        }}
      >
        {data.sessionName}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: d.meta * 0.5,
          fontSize: d.meta,
          color: C.muted,
        }}
      >
        {meta}
      </div>

      {/* Podium 2 - 1 - 3 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: d.pad / 3,
          marginTop: d.gapTop,
        }}
      >
        {[podium[1], podium[0], podium[2]]
          .filter((r): r is ShareImageRow => Boolean(r))
          .map((r) => (
            <PodiumColumn key={r.rank} row={r} d={d} lang={lang} />
          ))}
      </div>

      {/* Peringkat 4–8 */}
      {rest.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: d.rowGap,
            marginTop: d.gapMid,
          }}
        >
          {rest.map((r) => (
            <div
              key={r.rank}
              style={{
                display: "flex",
                alignItems: "center",
                height: d.rowH,
                padding: `0 ${d.rowFont}px`,
                borderRadius: d.rowH / 4,
                backgroundColor: C.row,
                fontSize: d.rowFont,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: d.rowFont * 1.8,
                  color: C.muted,
                  fontWeight: 600,
                }}
              >
                {r.rank}
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  fontWeight: 600,
                  ...ellipsis,
                }}
              >
                {r.name}
              </div>
              <div
                style={{
                  display: "flex",
                  color: C.muted,
                  marginLeft: 16,
                  whiteSpace: "nowrap",
                }}
              >
                {tr("shareImage.wl", lang, { w: r.wins, l: r.losses })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  width: d.rowFont * 5.2,
                  flexShrink: 0,
                  color: C.teal,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {tr("shareImage.winRate", lang, { n: r.winRate })}
              </div>
            </div>
          ))}
          {moreCount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: d.rowGap,
                fontSize: d.more,
                color: C.muted,
              }}
            >
              {tr("shareImage.more", lang, { n: moreCount })}
            </div>
          )}
        </div>
      )}

      {/* Footer watermark (didorong ke bawah) */}
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: d.footer,
          color: C.muted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={d.footerLogo} height={d.footerLogo} alt="" />
          <div style={{ display: "flex" }}>
            {tr("shareImage.madeWith", lang)}
          </div>
          <div
            style={{
              display: "flex",
              color: C.text,
              fontFamily: "Space Grotesk",
              fontWeight: 700,
            }}
          >
            TangkasBoard
          </div>
        </div>
        <div style={{ display: "flex", color: C.teal, fontWeight: 600 }}>
          {host}
        </div>
      </div>
    </div>
  );
}

function PodiumColumn({
  row,
  d,
  lang,
}: {
  row: ShareImageRow;
  d: Dim;
  lang: Lang;
}) {
  const first = row.rank === 1;
  const medal = MEDAL[row.rank] ?? C.muted;
  const size = first ? d.avatar1 : d.avatar;
  const initial = row.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: size,
          border: `${first ? 8 : 6}px solid ${medal}`,
          backgroundColor: "rgba(255,255,255,0.06)",
          fontFamily: "Space Grotesk",
          fontSize: first ? d.avatarFont1 : d.avatarFont,
          fontWeight: 700,
          color: medal,
        }}
      >
        {initial}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: d.podStat * 0.6,
          fontSize: d.podName,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {clip(row.name, d.podNameMax)}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 4,
          fontSize: d.podStat,
          color: C.muted,
        }}
      >
        {`${tr("shareImage.wl", lang, { w: row.wins, l: row.losses })}  ·  ${tr("shareImage.winRate", lang, { n: row.winRate })}`}
      </div>
      {first && (
        <div
          style={{
            display: "flex",
            marginTop: 4,
            fontSize: d.podStat,
            color: C.gold,
            fontWeight: 600,
          }}
        >
          {tr("shareImage.points", lang, { n: row.points })}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          width: "100%",
          height: d.pillar[row.rank] ?? d.pillar[3],
          marginTop: d.podStat * 0.6,
          paddingTop: d.pillarNum * 0.25,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: first ? C.gold : C.pillar,
          // Satori crash bila properti style bernilai undefined → spread kondisional.
          ...(first
            ? { backgroundImage: `linear-gradient(180deg, ${C.gold} 0%, #D97706 100%)` }
            : {}),
          fontFamily: "Space Grotesk",
          fontSize: d.pillarNum,
          fontWeight: 700,
          color: first ? "#1F1300" : C.text,
        }}
      >
        {row.rank}
      </div>
    </div>
  );
}
