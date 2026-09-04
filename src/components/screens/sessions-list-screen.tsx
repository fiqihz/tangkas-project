"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Play, RotateCcw, Trash2, CalendarClock, Eye, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Fab } from "@/components/ui/fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CardSkeletonList } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore, useT } from "@/lib/store/settings-store";
import type { DictKey } from "@/lib/i18n/dict";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { DbSession, SessionStatus } from "@/lib/supabase/types";
import { CreateSessionDialog } from "@/components/dialogs/create-session-dialog";
import { RosterScreen } from "@/components/screens/roster-screen";

const STATUS_META: Record<
  SessionStatus,
  { labelKey: DictKey; dot: string; order: number }
> = {
  ongoing: { labelKey: "sessions.status.ongoing", dot: "bg-primary", order: 0 },
  scheduled: { labelKey: "sessions.status.scheduled", dot: "bg-sky-500", order: 1 },
  finished: { labelKey: "sessions.status.finished", dot: "bg-muted-foreground", order: 2 },
};

export function SessionsListScreen() {
  const {
    loading,
    sessions,
    openSession,
    startSession,
    reactivateSession,
    deleteSession,
  } = useSessionStore();
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbSession | null>(null);
  const [showRoster, setShowRoster] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<SessionStatus, DbSession[]> = {
      ongoing: [],
      scheduled: [],
      finished: [],
    };
    for (const s of sessions) g[s.status].push(s);
    return g;
  }, [sessions]);

  if (showRoster) {
    return <RosterScreen onClose={() => setShowRoster(false)} />;
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏸</span>
          <div>
            <div className="font-bold leading-tight">TangkasBoard</div>
            <div className="text-xs text-muted-foreground">{t("sessions.subtitle")}</div>
          </div>
        </div>
        <button
          onClick={() => {
            haptic(8);
            setShowRoster(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium active:scale-95 active:bg-secondary"
        >
          <BarChart3 size={16} /> {t("sessions.roster")}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28">
        {loading ? (
          <CardSkeletonList count={3} />
        ) : sessions.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("sessions.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {msg && (
              <div className="rounded-xl bg-amber-100 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                {msg}
              </div>
            )}
            {(["ongoing", "scheduled", "finished"] as SessionStatus[]).map(
              (status) =>
                grouped[status].length > 0 && (
                  <div key={status}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          STATUS_META[status].dot,
                        )}
                      />
                      {t(STATUS_META[status].labelKey)} ({grouped[status].length})
                    </div>
                    <div className="flex flex-col gap-2">
                      {grouped[status].map((s, i) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          index={i}
                          onOpen={() => openSession(s.id)}
                          onStart={() => startSession(s.id)}
                          onReactivate={async () => {
                            const res = await reactivateSession(s.id);
                            if (!res.ok) setMsg(res.reason ?? t("sessions.failed"));
                          }}
                          onDelete={() => setDeleteTarget(s)}
                        />
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
      </main>

      <Fab
        onClick={() => setCreating(true)}
        icon={<Plus size={22} />}
        label={t("sessions.fab")}
      />

      {creating && <CreateSessionDialog onClose={() => setCreating(false)} />}

      <Sheet
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <SheetContent>
          <SheetTitle className="text-lg font-bold">{t("sessions.deleteTitle")}</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("sessions.deleteBody", { name: deleteTarget?.name ?? "" })}
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                haptic([20, 30]);
                if (deleteTarget) deleteSession(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {t("sessions.deleteYes")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SessionCard({
  session,
  index,
  onOpen,
  onStart,
  onReactivate,
  onDelete,
}: {
  session: DbSession;
  index: number;
  onOpen: () => void;
  onStart: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const lang = useSettingsStore((s) => s.lang);
  const locale = lang === "en" ? "en-US" : "id-ID";
  const dateStr = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date(session.created_at).toLocaleDateString(locale, {
        dateStyle: "medium",
      });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
    >
      <Card>
        <CardContent className="pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-1">
              <span className="truncate font-semibold">{session.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock size={12} /> {dateStr} · {session.courts}{" "}
                {t("sessions.courtsSuffix")}
              </span>
            </div>
            <button
              onClick={() => {
                haptic(10);
                onDelete();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
              aria-label={t("sessions.deleteAria")}
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            {session.status === "ongoing" && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  haptic(8);
                  onOpen();
                }}
              >
                {t("sessions.open")}
              </Button>
            )}
            {session.status === "scheduled" && (
              <Button
                size="sm"
                variant="info"
                className="flex-1"
                onClick={() => {
                  haptic(15);
                  onStart();
                }}
              >
                <Play size={14} /> {t("sessions.start")}
              </Button>
            )}
            {session.status === "finished" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    haptic(8);
                    onOpen();
                  }}
                >
                  <Eye size={14} /> {t("sessions.viewResult")}
                </Button>
                <Button
                  size="sm"
                  variant="info"
                  className="flex-1"
                  onClick={() => {
                    haptic(12);
                    onReactivate();
                  }}
                >
                  <RotateCcw size={14} /> {t("sessions.reactivate")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
