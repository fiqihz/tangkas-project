"use client";

import { useMemo, useState } from "react";
import { Clock, Pencil } from "lucide-react";
import { LevelBadge } from "@/components/ui/level-badge";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { EditScoreDialog } from "@/components/dialogs/edit-score-dialog";

export function HistoryScreen() {
  const { matches, players } = useSessionStore();
  const t = useT();
  const [editFor, setEditFor] = useState<Match | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // hanya match yang sudah berlalu: finished atau unfinished
  const past = useMemo(
    () =>
      matches.filter((m) => m.state === "finished" || m.state === "unfinished"),
    [matches],
  );

  // kelompokkan per lapangan (pakai courtLabel snapshot; fallback courtId)
  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of past) {
      const key = m.courtLabel ?? "\u0000deleted"; // sentinel; diterjemahkan saat render
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    // urutkan match tiap lapangan by round
    for (const arr of map.values()) {
      arr.sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
    }
    return Array.from(map.entries());
  }, [past]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">{t("history.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("history.subtitle")}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("history.empty")}
        </p>
      ) : (
        groups.map(([label, list]) => (
          <div key={label}>
            <div className="mb-2 text-sm font-medium">
              {label === "\u0000deleted" ? t("courts.deletedCourt") : label}
            </div>
            <div className="flex flex-col gap-2">
              {list.map((m, idx) => (
                <MatchHistoryRow
                  key={m.id}
                  match={m}
                  matchNumber={idx + 1}
                  byId={byId}
                  t={t}
                  onEdit={() => {
                    haptic(10);
                    setEditFor(m);
                  }}
                />
              ))}
            </div>
          </div>
        ))
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
}: {
  match: Match;
  matchNumber: number;
  byId: Map<string, SessionPlayer>;
  t: ReturnType<typeof useT>;
  onEdit: () => void;
}) {
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const level = (id: string) => byId.get(id)?.level ?? null;
  const unfinished = match.state === "unfinished";
  const aWon = match.winner === "a";
  const bWon = match.winner === "b";
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
        {!unfinished && (
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
                {name(id)}
              </span>
              <LevelBadge level={level(id)} className="w-fit shrink-0" />
            </div>
          ))}
        </div>

        <div className="shrink-0 px-1 text-center">
          {unfinished ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex items-center gap-1 font-bold">
              <span className={cn(aWon && "text-primary")}>
                {match.score?.a}
              </span>
              <span className="text-muted-foreground">-</span>
              <span className={cn(bWon && "text-primary")}>
                {match.score?.b}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
          {match.teamB.playerIds.map((id) => (
            <div key={id} className="flex flex-col items-end gap-0.5">
              <span className={cn("truncate text-sm", bWon && "font-semibold")}>
                {name(id)}
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
