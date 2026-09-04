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
  Settings as SettingsIcon,
} from "lucide-react";
import { WifiOff, Share2 } from "lucide-react";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore, useT } from "@/lib/store/settings-store";
import { SettingsScreen } from "@/components/screens/settings-screen";
import { useOnlineStatus } from "@/lib/use-online-status";
import { buildResultText, shareResultText } from "@/lib/share-result";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { ScreenTransition } from "@/components/ui/motion";
import { Toast } from "@/components/ui/toast";
import { SessionsListScreen } from "@/components/screens/sessions-list-screen";
import { PlayersScreen } from "@/components/screens/players-screen";
import { CourtsScreen } from "@/components/screens/courts-screen";
import { LeaderboardScreen } from "@/components/screens/leaderboard-screen";
import { HistoryScreen } from "@/components/screens/history-screen";
import { FinishScreen } from "@/components/screens/finish-screen";
import { FinalResultScreen } from "@/components/screens/final-result-screen";

type Tab = "players" | "courts" | "leaderboard" | "history" | "finish";
type View = Tab | "settings";

import type { DictKey } from "@/lib/i18n/dict";

const TABS: { id: Tab; icon: typeof Users; labelKey: DictKey }[] = [
  { id: "players", icon: Users, labelKey: "nav.players" },
  { id: "courts", icon: LayoutGrid, labelKey: "nav.courts" },
  { id: "leaderboard", icon: Trophy, labelKey: "nav.leaderboard" },
  { id: "history", icon: History, labelKey: "nav.history" },
  { id: "finish", icon: Flag, labelKey: "nav.finish" },
];

export function AppShell() {
  const actionError = useSessionStore((s) => s.actionError);
  const clearActionError = useSessionStore((s) => s.clearActionError);
  const online = useOnlineStatus();
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  // Sinkronkan tema & bahasa dari localStorage sekali di mount (client).
  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return (
    <>
      {/* Banner offline global: koneksi lapangan sering putus. Beri tahu host
          bahwa perubahan mungkin gagal tersimpan sampai koneksi kembali. */}
      {!online && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-center text-xs font-medium text-destructive-foreground pt-[calc(env(safe-area-inset-top)+0.375rem)]">
          <WifiOff size={13} className="shrink-0" />
          Kamu sedang offline — perubahan mungkin gagal tersimpan.
        </div>
      )}
      <AppShellContent />
      {/* Toast error global: menampilkan kegagalan aksi (simpan skor, ubah
          status, hapus lapangan, dll) dari screen mana pun. */}
      <Toast
        message={actionError}
        variant="error"
        onClose={clearActionError}
      />
    </>
  );
}

function AppShellContent() {
  const { session, loadSessions, backToList, finishedResult } =
    useSessionStore();
  const subscribeRealtime = useSessionStore((s) => s.subscribeRealtime);
  const unsubscribeRealtime = useSessionStore((s) => s.unsubscribeRealtime);
  const t = useT();
  const [view, setView] = useState<View>("courts");

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Realtime multi-device: saat sebuah sesi terbuka, langganan perubahan
  // (match/pemain/lapangan/sesi) agar aksi dari device lain langsung tampil.
  // Cleanup saat sesi berganti atau komponen unmount agar tidak bocor.
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!sessionId) return;
    subscribeRealtime(sessionId);
    return () => unsubscribeRealtime();
  }, [sessionId, subscribeRealtime, unsubscribeRealtime]);

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
            aria-label={t("header.backToList")}
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-xl">🏸</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">
              {session.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {session.status === "scheduled"
                ? t("header.scheduled")
                : `${t("header.roundCourts")} ${session.current_round} · ${session.courts} ${t("header.courts")}`}
            </div>
          </div>
          <button
            onClick={() => {
              haptic(8);
              setView("settings");
            }}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg active:scale-90 active:bg-secondary",
              view === "settings" ? "text-primary" : "text-muted-foreground",
            )}
            aria-label={t("settings.open")}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-4 pb-28">
        <ScreenTransition keyId={view}>
          {view === "players" && <PlayersScreen />}
          {view === "courts" && <CourtsScreen />}
          {view === "leaderboard" && <LeaderboardScreen />}
          {view === "history" && <HistoryScreen />}
          {view === "finish" && <FinishScreen />}
          {view === "settings" && <SettingsScreen />}
        </ScreenTransition>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        {TABS.map(({ id, icon: Icon, labelKey }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => {
                haptic(8);
                setView(id);
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
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ReadOnlyResult() {
  const { session, players, backToList } = useSessionStore();
  const t = useT();
  const rows = buildLeaderboard(players.filter((p) => p.gamesPlayed > 0));
  const [toast, setToast] = useState<string | null>(null);

  const share = async () => {
    if (!session) return;
    haptic(12);
    const outcome = await shareResultText(
      buildResultText(session.name, players.filter((p) => p.gamesPlayed > 0)),
    );
    if (outcome === "copied") setToast(t("result.copied"));
    else if (outcome === "failed")
      setToast(t("result.shareFailed"));
  };

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
            aria-label={t("header.backToList")}
          >
            <ChevronLeft size={22} />
          </button>
          <span className="text-xl">🏁</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">
              {session?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("result.readonly")}
            </div>
          </div>
          {rows.length > 0 && (
            <button
              onClick={share}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
              aria-label={t("result.share")}
            >
              <Share2 size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-8">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("result.noPlayers")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">{t("leaderboard.colPlayer")}</th>
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

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
