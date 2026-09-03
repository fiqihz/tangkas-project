"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Search, Trophy, Users2 } from "lucide-react";
import { LevelBadge } from "@/components/ui/level-badge";
import { GenderBadge } from "@/components/ui/gender-select";
import { Input } from "@/components/ui/input";
import { CardSkeletonList } from "@/components/ui/skeleton";
import {
  computeHeadToHead,
  computePartners,
  type ProfileStats,
} from "@/lib/domain/roster-stats";
import { useRosterStats } from "@/lib/store/use-roster-stats";
import type { DbPlayerProfile } from "@/lib/supabase/types";
import { haptic } from "@/lib/haptics";

/**
 * Halaman Roster: statistik pemain LINTAS-MABAR + head-to-head.
 * Overlay penuh layar; dibuka dari daftar mabar, ditutup lewat tombol kembali.
 */
export function RosterScreen({ onClose }: { onClose: () => void }) {
  const { profiles, matches, statsById, loading } = useRosterStats();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DbPlayerProfile | null>(null);

  const nameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.name])),
    [profiles],
  );

  // Urutkan: paling banyak main dulu, lalu nama.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? profiles.filter((p) => p.name.toLowerCase().includes(q))
      : profiles;
    return [...list].sort((a, b) => {
      const ga = statsById.get(a.id)?.games ?? 0;
      const gb = statsById.get(b.id)?.games ?? 0;
      if (ga !== gb) return gb - ga;
      return a.name.localeCompare(b.name);
    });
  }, [profiles, statsById, query]);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          onClick={() => {
            haptic(8);
            if (selected) setSelected(null);
            else onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg active:scale-90 active:bg-secondary"
          aria-label="Kembali"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <div className="font-bold leading-tight">
            {selected ? selected.name : "Roster & Statistik"}
          </div>
          <div className="text-xs text-muted-foreground">
            {selected ? "Statistik lintas mabar" : "Rekap semua pemain"}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-10">
        {loading ? (
          <CardSkeletonList count={4} />
        ) : selected ? (
          <ProfileDetail
            profile={selected}
            stats={statsById.get(selected.id)}
            matches={matches}
            nameById={nameById}
          />
        ) : profiles.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Roster masih kosong. Tambah pemain dari dalam mabar.
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Cari nama pemain…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2">
              {sorted.map((p) => {
                const s = statsById.get(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      haptic(8);
                      setSelected(p);
                    }}
                    className="flex select-none items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all active:scale-[0.99] active:bg-secondary"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <LevelBadge level={p.level} />
                      <GenderBadge gender={p.gender} />
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      {s && s.games > 0 ? (
                        <>
                          <span className="font-medium text-foreground">
                            {s.games}
                          </span>{" "}
                          main · {s.winRate}% WR
                        </>
                      ) : (
                        "belum main"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProfileDetail({
  profile,
  stats,
  matches,
  nameById,
}: {
  profile: DbPlayerProfile;
  stats: ProfileStats | undefined;
  matches: import("@/lib/domain/roster-stats").ResolvedMatch[];
  nameById: Map<string, string>;
}) {
  const h2h = useMemo(
    () => computeHeadToHead(matches, profile.id),
    [matches, profile.id],
  );
  const partners = useMemo(
    () => computePartners(matches, profile.id),
    [matches, profile.id],
  );

  if (!stats || stats.games === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {profile.name} belum punya riwayat main. Statistik akan muncul setelah
        ikut mabar & menyelesaikan match.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Main" value={String(stats.games)} />
        <StatBox label="Menang" value={String(stats.wins)} accent="win" />
        <StatBox label="Kalah" value={String(stats.losses)} />
        <StatBox label="Win rate" value={`${stats.winRate}%`} />
        <StatBox label="Ikut mabar" value={String(stats.sessions)} />
        <StatBox
          label="Selisih poin"
          value={`${stats.pointsScored - stats.pointsConceded >= 0 ? "+" : ""}${stats.pointsScored - stats.pointsConceded}`}
        />
      </div>

      {/* Head-to-head */}
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Trophy size={15} /> Head-to-head
        </div>
        {h2h.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada lawan yang tercatat.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-2 text-left">Lawan</th>
                  <th className="px-2 py-2 text-center">Ketemu</th>
                  <th className="px-2 py-2 text-center">M-K</th>
                </tr>
              </thead>
              <tbody>
                {h2h.map((h) => (
                  <tr key={h.opponentId} className="border-t border-border">
                    <td className="px-2.5 py-2 font-medium">
                      {nameById.get(h.opponentId) ?? "?"}
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground">
                      {h.meetings}x
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="font-medium text-primary">{h.wins}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="font-medium text-destructive">
                        {h.losses}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Partner tersering */}
      {partners.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Users2 size={15} /> Partner tersering
          </div>
          <div className="flex flex-wrap gap-2">
            {partners.slice(0, 6).map((p) => (
              <span
                key={p.partnerId}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs"
              >
                {nameById.get(p.partnerId) ?? "?"}{" "}
                <span className="text-muted-foreground">· {p.count}x</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "win";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 text-center">
      <div
        className={
          "text-lg font-bold " + (accent === "win" ? "text-primary" : "")
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
