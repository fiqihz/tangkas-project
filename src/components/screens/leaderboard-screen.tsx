"use client";

import { useMemo } from "react";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

export function LeaderboardScreen() {
  const { players } = useSessionStore();
  const t = useT();

  const rows = useMemo(
    () => buildLeaderboard(players.filter((p) => p.gamesPlayed > 0)),
    [players],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold">{t("leaderboard.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("leaderboard.subtitle")}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("leaderboard.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-1.5 py-2 text-left">#</th>
                <th className="px-1.5 py-2 text-left">{t("leaderboard.colPlayer")}</th>
                <th className="px-1.5 py-2 text-center">M</th>
                <th className="px-1.5 py-2 text-center">K</th>
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
                    {r.winRate}%
                  </td>
                  <td className="px-1.5 py-2 text-center text-primary">
                    {r.bonus > 0 ? `+${r.bonus}` : "-"}
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    {r.pointDiff >= 0 ? "+" : ""}
                    {r.pointDiff}
                  </td>
                  <td className="px-1.5 py-2 text-center">{r.pointsScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
