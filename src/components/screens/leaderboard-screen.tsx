"use client";

import { useMemo } from "react";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { shuttlecockStats } from "@/lib/domain/shuttlecock";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";
import { EmptyCourt } from "@/components/ui/empty-court";

export function LeaderboardScreen() {
  const { players, matches, session } = useSessionStore();
  const t = useT();
  const trackShuttlecocks = session?.track_shuttlecocks ?? false;

  const rows = useMemo(
    () => buildLeaderboard(players.filter((p) => p.gamesPlayed > 0), matches),
    [players, matches],
  );

  // Poin 5: kok per pemain (angka penuh) — dihitung dari match yang finished.
  const cockPerPlayer = useMemo(
    () => shuttlecockStats(matches).perPlayer,
    [matches],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">
          {t("leaderboard.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("leaderboard.subtitle")}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyCourt
          title={t("leaderboard.emptyTitle")}
          description={t("leaderboard.empty")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-1.5 py-2 text-left">#</th>
                <th className="px-1.5 py-2 text-left">{t("leaderboard.colPlayer")}</th>
                <th className="px-1.5 py-2 text-center">M</th>
                <th className="px-1.5 py-2 text-center">K</th>
                <th className="px-1.5 py-2 text-center" title={t("leaderboard.drawTitle")}>
                  S
                </th>
                <th className="px-1.5 py-2 text-center" title={t("leaderboard.winRate")}>
                  WR
                </th>
                <th
                  className="px-1.5 py-2 text-center"
                  title={t("leaderboard.bonusTitle")}
                >
                  +M
                </th>
                <th className="px-1.5 py-2 text-center">Diff</th>
                <th className="px-1.5 py-2 text-center">Poin</th>
                {trackShuttlecocks && (
                  <th
                    className="px-1.5 py-2 text-center"
                    title={t("leaderboard.cockTitle")}
                  >
                    🏸
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.playerId}
                  className={cn(
                    "border-t border-border",
                    r.rank === 1 && "bg-amber-100 dark:bg-amber-900/30",
                  )}
                >
                  <td className="px-1.5 py-2 font-semibold">
                    {r.rank === 1
                      ? "🥇"
                      : r.rank === 2
                        ? "🥈"
                        : r.rank === 3
                          ? "🥉"
                          : r.rank}
                  </td>
                  <td className="px-1.5 py-2 font-medium">{r.name}</td>
                  <td className="px-1.5 py-2 text-center">{r.wins}</td>
                  <td className="px-1.5 py-2 text-center">{r.losses}</td>
                  <td className="px-1.5 py-2 text-center text-muted-foreground">
                    {r.draws}
                  </td>
                  <td className="px-1.5 py-2 text-center text-muted-foreground">
                    {r.winRate}%
                  </td>
                  <td className="px-1.5 py-2 text-center text-primary">
                    {r.bonusDisplay > 0 ? `+${r.bonusDisplay}` : "-"}
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    {r.pointDiffDisplay >= 0 ? "+" : ""}
                    {r.pointDiffDisplay}
                  </td>
                  <td className="px-1.5 py-2 text-center">{r.pointsDisplay}</td>
                  {trackShuttlecocks && (
                    <td className="px-1.5 py-2 text-center text-muted-foreground">
                      {cockPerPlayer.get(r.playerId) ?? 0}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
