"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { shuttlecockStats } from "@/lib/domain/shuttlecock";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { buildResultText } from "@/lib/share-result";
import { ShareImageSheet } from "@/components/dialogs/share-image-sheet";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Halaman hasil akhir setelah SELESAI MABAR: podium juara + ranking lengkap.
 * Muncul menggantikan seluruh layar; tombol "Mulai Mabar Baru" mengembalikan
 * ke halaman setup.
 */
export function FinalResultScreen({
  name,
  players,
  matches = [],
  trackShuttlecocks = false,
  dateIso = null,
}: {
  name: string;
  players: SessionPlayer[];
  matches?: Match[];
  trackShuttlecocks?: boolean;
  dateIso?: string | null;
}) {
  const { clearFinishedResult } = useSessionStore();
  const t = useT();
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const rows = useMemo(() => buildLeaderboard(players, matches), [players, matches]);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const cocks = useMemo(() => shuttlecockStats(matches), [matches]);

  const newSession = () => {
    haptic([20, 40]);
    clearFinishedResult();
  };

  const matchCount = useMemo(
    () => matches.filter((m) => m.state === "finished").length,
    [matches],
  );
  const resultText = useMemo(
    () => buildResultText(name, players, matches),
    [name, players, matches],
  );

  const share = () => {
    haptic(12);
    setShareOpen(true);
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="text-sm text-muted-foreground">Hasil Akhir</div>
          <h1 className="text-2xl font-bold">{name}</h1>
        </motion.div>

        {rows.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("result.noPlayers")}
          </p>
        ) : (
          <>
            <Podium podium={podium} />

            {rest.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs text-muted-foreground">
                    <tr>
                      <th className="px-1.5 py-2 text-left">#</th>
                      <th className="px-1.5 py-2 text-left">{t("leaderboard.colPlayer")}</th>
                      <th className="px-1.5 py-2 text-center">M</th>
                      <th className="px-1.5 py-2 text-center">K</th>
                      <th className="px-1.5 py-2 text-center">S</th>
                      <th className="px-1.5 py-2 text-center">WR</th>
                      <th className="px-1.5 py-2 text-center">+M</th>
                      <th className="px-1.5 py-2 text-center">Diff</th>
                      <th className="px-1.5 py-2 text-center">Poin</th>
                      {trackShuttlecocks && (
                        <th className="px-1.5 py-2 text-center">🏸</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r) => (
                      <tr key={r.playerId} className="border-t border-border">
                        <td className="px-1.5 py-2 font-semibold">{r.rank}</td>
                        <td className="px-1.5 py-2 font-medium">{r.name}</td>
                        <td className="px-1.5 py-2 text-center">{r.wins}</td>
                        <td className="px-1.5 py-2 text-center">{r.losses}</td>
                        <td className="px-1.5 py-2 text-center">{r.draws}</td>
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
                        <td className="px-1.5 py-2 text-center">
                          {r.pointsDisplay}
                        </td>
                        {trackShuttlecocks && (
                          <td className="px-1.5 py-2 text-center text-muted-foreground">
                            {cocks.perPlayer.get(r.playerId) ?? 0}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {trackShuttlecocks && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  🏸 Total kok kepakai
                </span>
                <span className="text-lg font-bold">{cocks.sessionTotal}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2 border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {rows.length > 0 && (
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={share}
          >
            <Share2 size={18} /> Bagikan
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={newSession}>
          <RotateCcw size={18} /> Mabar Baru
        </Button>
      </div>

      <ShareImageSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        sessionName={name}
        dateIso={dateIso}
        matchCount={matchCount}
        rows={rows}
        resultText={resultText}
        onToast={setToast}
      />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Podium({
  podium,
}: {
  podium: ReturnType<typeof buildLeaderboard>;
}) {
  // urutan tampil: 2 - 1 - 3 (juara di tengah, lebih tinggi)
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const heights: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-16" };
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="mt-6 flex items-end justify-center gap-2">
      {order.map((row) => (
        <motion.div
          key={row.playerId}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="flex flex-1 flex-col items-center"
        >
          <div className="text-3xl">{medals[row.rank]}</div>
          <div className="max-w-full truncate px-1 text-center text-sm font-semibold">
            {row.name}
          </div>
          <div className="mb-1 text-xs text-muted-foreground">
            {row.wins}M · {row.pointDiffDisplay >= 0 ? "+" : ""}
            {row.pointDiffDisplay}
          </div>
          <div
            className={cn(
              "flex w-full items-start justify-center rounded-t-lg pt-2 text-lg font-bold",
              row.rank === 1
                ? "bg-amber-300 text-amber-950 dark:bg-amber-500"
                : "bg-secondary text-secondary-foreground",
              heights[row.rank],
            )}
          >
            {row.rank}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
