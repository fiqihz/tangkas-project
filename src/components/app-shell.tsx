"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Trophy,
  Users,
  Flag,
  ChevronLeft,
  History,
} from "lucide-react";
import { useSessionStore } from "@/lib/store/session-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { ScreenTransition } from "@/components/ui/motion";
import { SessionsListScreen } from "@/components/screens/sessions-list-screen";
import { PlayersScreen } from "@/components/screens/players-screen";
import { CourtsScreen } from "@/components/screens/courts-screen";
import { LeaderboardScreen } from "@/components/screens/leaderboard-screen";
import { HistoryScreen } from "@/components/screens/history-screen";
import { FinishScreen } from "@/components/screens/finish-screen";
import { FinalResultScreen } from "@/components/screens/final-result-screen";

type Tab = "players" | "courts" | "leaderboard" | "history" | "finish";

const TABS: { id: Tab; icon: typeof Users; label: string }[] = [
  { id: "players", icon: Users, label: "Pemain" },
  { id: "courts", icon: LayoutGrid, label: "Lapangan" },
  { id: "leaderboard", icon: Trophy, label: "Skor" },
  { id: "history", icon: History, label: "History" },
  { id: "finish", icon: Flag, label: "Selesai" },
];

export function AppShell() {
  const { session, loadSessions, backToList, finishedResult } =
    useSessionStore();
  const [tab, setTab] = useState<Tab>("courts");

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Halaman hasil akhir setelah SELESAI MABAR (sebelum kembali ke list)
  if (finishedResult) {
    return (
      <FinalResultScreen
        name={finishedResult.name}
        players={finishedResult.players}
      />
    );
  }

  // Belum ada sesi yang dibuka -> tampilkan daftar mabar (main page)
  if (!session) {
    return <SessionsListScreen />;
  }

  // Sesi finished dibuka -> tampilan read-only (hasil), bukan board interaktif.
  // Untuk mengedit, host harus "Aktifkan lagi" dari daftar mabar.
  if (session.status === "finished") {
    return <ReadOnlyResult />;
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptic(8);
              backToList();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
            aria-label="Kembali ke daftar mabar"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-xl">🏸</span>
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight">
              {session.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {session.status === "scheduled"
                ? "Terjadwal · belum mulai"
                : `Ronde ${session.current_round} · ${session.courts} lapangan`}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-4 pb-28">
        <ScreenTransition keyId={tab}>
          {tab === "players" && <PlayersScreen />}
          {tab === "courts" && <CourtsScreen />}
          {tab === "leaderboard" && <LeaderboardScreen />}
          {tab === "history" && <HistoryScreen />}
          {tab === "finish" && <FinishScreen />}
        </ScreenTransition>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => {
                haptic(8);
                setTab(id);
              }}
              className={cn(
                "relative flex min-h-[56px] flex-1 select-none flex-col items-center justify-center gap-0.5 text-xs transition-colors active:scale-95",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ReadOnlyResult() {
  const { session, players, backToList } = useSessionStore();
  const rows = buildLeaderboard(players.filter((p) => p.gamesPlayed > 0));

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptic(8);
              backToList();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
            aria-label="Kembali ke daftar mabar"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-xl">🏁</span>
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight">
              {session?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              Hasil akhir (read-only) · aktifkan lagi untuk edit
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-8">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada pemain yang bermain di sesi ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Pemain</th>
                  <th className="px-2 py-2 text-center">M</th>
                  <th className="px-2 py-2 text-center">K</th>
                  <th className="px-2 py-2 text-center">Diff</th>
                  <th className="px-2 py-2 text-center">Poin</th>
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
                    <td className="px-2 py-2 font-semibold">
                      {r.rank === 1
                        ? "🥇"
                        : r.rank === 2
                          ? "🥈"
                          : r.rank === 3
                            ? "🥉"
                            : r.rank}
                    </td>
                    <td className="px-2 py-2 font-medium">{r.name}</td>
                    <td className="px-2 py-2 text-center">{r.wins}</td>
                    <td className="px-2 py-2 text-center">{r.losses}</td>
                    <td className="px-2 py-2 text-center">
                      {r.pointDiff >= 0 ? "+" : ""}
                      {r.pointDiff}
                    </td>
                    <td className="px-2 py-2 text-center">{r.pointsScored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
