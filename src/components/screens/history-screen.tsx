"use client";

import { useMemo, useState } from "react";
import { Clock, Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { EditScoreDialog } from "@/components/dialogs/edit-score-dialog";

export function HistoryScreen({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { matches, players } = useSessionStore();
  const t = useT();
  const [editFor, setEditFor] = useState<Match | null>(null);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // hanya match yang sudah berlalu: finished atau unfinished
  const past = useMemo(
    () =>
      matches.filter((m) => m.state === "finished" || m.state === "unfinished"),
    [matches],
  );

  // kelompokkan per lapangan (pakai courtLabel snapshot; fallback courtId).
  // matchNumber di-hitung SEBELUM filter agar "Match ke-N" tetap merujuk urutan
  // asli di lapangan itu, tidak bergeser saat pencarian menyaring sebagian.
  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of past) {
      const key = m.courtLabel ?? "\u0000deleted"; // sentinel; diterjemahkan saat render
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    // urutkan match tiap lapangan by round, lalu lampirkan nomor urut asli
    return Array.from(map.entries()).map(([label, arr]) => {
      const sorted = [...arr].sort(
        (a, b) => a.round - b.round || a.id.localeCompare(b.id),
      );
      return [
        label,
        sorted.map((m, idx) => ({ match: m, matchNumber: idx + 1 })),
      ] as const;
    });
  }, [past]);

  // Filter per nama pemain: match tampil bila salah satu dari 4 slot (teamA +
  // teamB) namanya mengandung query. Grup yang jadi kosong disembunyikan.
  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map(([label, rows]) => {
        const matched = rows.filter(({ match }) =>
          [...match.teamA.playerIds, ...match.teamB.playerIds].some((id) =>
            (byId.get(id)?.name ?? "").toLowerCase().includes(q),
          ),
        );
        return [label, matched] as const;
      })
      .filter(([, rows]) => rows.length > 0);
  }, [groups, q, byId]);

  // Total match yang cocok dengan pencarian (untuk badge "N match ditemukan").
  const matchCount = useMemo(
    () => filteredGroups.reduce((sum, [, rows]) => sum + rows.length, 0),
    [filteredGroups],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">
          {t("history.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("history.subtitle")}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("history.empty")}
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={t("history.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {q && filteredGroups.length > 0 && (
            <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t("history.searchCount", { n: matchCount })}
            </span>
          )}

          {filteredGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("history.noMatchForSearch", { q: query.trim() })}
            </p>
          ) : (
            filteredGroups.map(([label, rows]) => (
              <div key={label}>
                <div className="mb-2 text-sm font-medium">
                  {label === "\u0000deleted"
                    ? t("courts.deletedCourt")
                    : label}
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map(({ match: m, matchNumber }) => (
                    <MatchHistoryRow
                      key={m.id}
                      match={m}
                      matchNumber={matchNumber}
                      byId={byId}
                      t={t}
                      highlight={q}
                      // Mode read-only (dibuka dari hasil mabar finished):
                      // sembunyikan tombol edit skor — host hanya melihat.
                      onEdit={
                        readOnly
                          ? undefined
                          : () => {
                              haptic(10);
                              setEditFor(m);
                            }
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {editFor && (
        <EditScoreDialog
          match={editFor}
          byId={byId}
          onClose={() => setEditFor(null)}
        />
      )}
    </div>
  );
}

function MatchHistoryRow({
  match,
  matchNumber,
  byId,
  t,
  onEdit,
  highlight,
}: {
  match: Match;
  matchNumber: number;
  byId: Map<string, SessionPlayer>;
  t: ReturnType<typeof useT>;
  onEdit?: () => void;
  /** Query pencarian aktif (lowercased). Nama yang cocok di-highlight. */
  highlight?: string;
}) {
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const level = (id: string) => byId.get(id)?.level ?? null;
  const unfinished = match.state === "unfinished";
  const aWon = match.winner === "a";
  const bWon = match.winner === "b";
  // Punya rincian per-set? (match multi-set atau Best of 1 yang tercatat via
  // match_set). Bila ya, tampilkan skor per set alih-alih total agregat.
  const hasSets = (match.sets?.length ?? 0) > 0;
  const duration = formatMatchDuration(match.startedAt, match.finishedAt);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
            {t("courts.matchNo", { n: matchNumber })}
          </span>
          {duration && (
            <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-muted-foreground">
              <Clock size={11} /> {duration}
            </span>
          )}
          {unfinished && (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">
              {t("history.unfinished")}
            </span>
          )}
        </span>
        {!unfinished && onEdit && (
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
            aria-label={t("history.editScore")}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {match.teamA.playerIds.map((id) => (
            <div key={id} className="flex flex-col gap-0.5">
              <span className={cn("truncate text-sm", aWon && "font-semibold")}>
                <HighlightedName name={name(id)} query={highlight} />
              </span>
              <LevelBadge level={level(id)} className="w-fit shrink-0" />
            </div>
          ))}
        </div>

        <div className="shrink-0 px-1 text-center">
          {unfinished ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : hasSets ? (
            // Match dengan rincian set: tampilkan SKOR PER SET (bukan total
            // agregat — total gabungan tak lazim di badminton). Skor per set
            // jadi tampilan utama; tim pemenang tiap set ditebalkan.
            <div className="flex flex-col items-center gap-0.5">
              {match.sets!.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 font-bold tabular-nums"
                >
                  <span className={cn(s.a > s.b && "text-primary")}>{s.a}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className={cn(s.b > s.a && "text-primary")}>{s.b}</span>
                </div>
              ))}
              {match.winner === "draw" && (
                <span className="rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {t("history.draw")}
                </span>
              )}
            </div>
          ) : (
            // Fallback: match lama / Best of 1 tanpa baris set -> skor tunggal.
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 font-bold">
                <span className={cn(aWon && "text-primary")}>
                  {match.score?.a}
                </span>
                <span className="text-muted-foreground">-</span>
                <span className={cn(bWon && "text-primary")}>
                  {match.score?.b}
                </span>
              </div>
              {match.winner === "draw" && (
                <span className="rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {t("history.draw")}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
          {match.teamB.playerIds.map((id) => (
            <div key={id} className="flex flex-col items-end gap-0.5">
              <span className={cn("truncate text-sm", bWon && "font-semibold")}>
                <HighlightedName name={name(id)} query={highlight} />
              </span>
              <LevelBadge level={level(id)} className="w-fit shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Render nama pemain dengan bagian yang cocok dengan `query` di-highlight.
 * Pencocokan case-insensitive, hanya kemunculan pertama yang ditandai (nama
 * pemain pendek → satu highlight sudah cukup). Tanpa query, render apa adanya.
 */
function HighlightedName({
  name,
  query,
}: {
  name: string;
  query?: string;
}) {
  const q = query?.trim();
  if (!q) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{name}</>;
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + q.length);
  const after = name.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-primary/25 px-0.5 text-inherit">
        {match}
      </mark>
      {after}
    </>
  );
}

/**
 * Durasi match dari startedAt s/d finishedAt, diformat ringkas:
 *  - < 1 menit  -> "Xd" (detik)
 *  - >= 1 menit -> "Nm" (menit, dibulatkan)
 * Mengembalikan null bila salah satu waktu tak tersedia atau tidak valid
 * (mis. match lama sebelum fitur timer, atau data ganjil).
 */
function formatMatchDuration(
  startedAt?: string | null,
  finishedAt?: string | null,
): string | null {
  if (!startedAt || !finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const sec = Math.round((end - start) / 1000);
  if (sec <= 0) return null;
  if (sec < 60) return `${sec}d`;
  return `${Math.round(sec / 60)}m`;
}
