"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import type { SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { buildResultText, shareResultText } from "@/lib/share-result";
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
}: {
  name: string;
  players: SessionPlayer[];
}) {
  const { clearFinishedResult } = useSessionStore();
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => buildLeaderboard(players), [players]);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const newSession = () => {
    haptic([20, 40]);
    clearFinishedResult();
  };

  const share = async () => {
    haptic(12);
    const outcome = await shareResultText(buildResultText(name, players));
    if (outcome === "copied") setToast("Hasil disalin ke clipboard.");
    else if (outcome === "failed")
      setToast("Gagal membagikan hasil. Coba lagi.");
    // 'shared' -> tidak perlu toast (share sheet HP sudah muncul)
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
            Tidak ada pemain yang bermain di sesi ini.
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
                      <th className="px-1.5 py-2 text-left">Pemain</th>
                      <th className="px-1.5 py-2 text-center">M</th>
                      <th className="px-1.5 py-2 text-center">K</th>
                      <th className="px-1.5 py-2 text-center">WR</th>
                      <th className="px-1.5 py-2 text-center">+M</th>
                      <th className="px-1.5 py-2 text-center">Diff</th>
                      <th className="px-1.5 py-2 text-center">Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r) => (
                      <tr key={r.playerId} className="border-t border-border">
                        <td className="px-1.5 py-2 font-semibold">{r.rank}</td>
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
                        <td className="px-1.5 py-2 text-center">
                          {r.pointsScored}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            {row.wins}M · {row.pointDiff >= 0 ? "+" : ""}
            {row.pointDiff}
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
