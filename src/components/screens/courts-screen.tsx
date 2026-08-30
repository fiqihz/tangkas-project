"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Fab } from "@/components/ui/fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { haptic } from "@/lib/haptics";
import { FinishMatchDialog } from "@/components/dialogs/finish-match-dialog";
import { ManualFillDialog } from "@/components/dialogs/manual-fill-dialog";
import { PlayerActionDialog } from "@/components/dialogs/player-action-dialog";

export function CourtsScreen() {
  const {
    courts,
    players,
    addCourt,
    removeCourt,
    renameCourt,
    currentMatchByCourt,
    courtMatchNumber,
    previewNextFour,
    startMatch,
    busyPlayerIds,
  } = useSessionStore();

  const [finishFor, setFinishFor] = useState<Match | null>(null);
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [playerAction, setPlayerAction] = useState<{
    match: Match;
    playerId: string;
  } | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const busy = busyPlayerIds();
  const activePlayers = players.filter((p) => p.status === "active");
  const waiting = activePlayers.filter((p) => !busy.has(p.id));
  const noLevelWaiting = waiting.filter((p) => p.level === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {activePlayers.length} aktif · {waiting.length} menunggu
        </span>
      </div>

      {/* Info: pemain belum ber-level di-skip dari rekomendasi otomatis */}
      {noLevelWaiting.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>{noLevelWaiting.length} pemain</b> belum di-set level, jadi belum
            ikut rekomendasi otomatis. Set level mereka di tab Pemain, atau isi
            manual.
          </span>
        </div>
      )}

      {courts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Belum ada lapangan. Tap tombol + untuk menambah.
        </p>
      )}

      {courts.map((court, i) => {
        const match = currentMatchByCourt(court.id);
        const preview =
          match?.state === "playing" ? previewNextFour(court.id) : null;
        return (
          <motion.div
            key={court.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.2) }}
          >
            <Card>
              <CardContent className="pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() => {
                      haptic(8);
                      setRenameFor({ id: court.id, label: court.label });
                    }}
                    className="flex select-none items-center gap-1.5 rounded-lg py-1 pr-2 font-semibold active:opacity-70"
                    aria-label="Ubah nama lapangan"
                  >
                    {court.label}
                    <Pencil size={13} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => {
                      haptic(10);
                      removeCourt(court.id);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-secondary"
                    aria-label="Hapus lapangan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {match ? (
                  <>
                    <MatchView
                      match={match}
                      matchNumber={courtMatchNumber(court.id, match.id)}
                      byId={byId}
                      onFinish={() => {
                        haptic(12);
                        setFinishFor(match);
                      }}
                      onStart={() => {
                        haptic(15);
                        startMatch(match.id);
                      }}
                      onTapPlayer={(playerId) =>
                        setPlayerAction({ match, playerId })
                      }
                    />
                    {preview && <PreviewNext preview={preview} byId={byId} />}
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Lapangan kosong.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        haptic(10);
                        setManualFor(court.id);
                      }}
                    >
                      <Pencil size={16} /> Isi manual
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Fab onClick={addCourt} icon={<Plus size={22} />} label="Lapangan" />

      {finishFor && (
        <FinishMatchDialog
          match={finishFor}
          byId={byId}
          onClose={() => setFinishFor(null)}
        />
      )}
      {manualFor && (
        <ManualFillDialog
          courtId={manualFor}
          onClose={() => setManualFor(null)}
        />
      )}
      {renameFor && (
        <RenameCourtDialog
          initialLabel={renameFor.label}
          onSave={(label) => renameCourt(renameFor.id, label)}
          onClose={() => setRenameFor(null)}
        />
      )}
      {playerAction && (
        <PlayerActionDialog
          match={playerAction.match}
          player={byId.get(playerAction.playerId)!}
          onClose={() => setPlayerAction(null)}
        />
      )}
    </div>
  );
}

function TeamBlock({
  ids,
  label,
  byId,
  onTapPlayer,
}: {
  ids: [string, string];
  label: string;
  byId: Map<string, SessionPlayer>;
  onTapPlayer?: (playerId: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-secondary/50 p-2">
      <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {ids.map((id) => {
        const content = (
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="truncate font-medium">
              {byId.get(id)?.name ?? "?"}
            </span>
            <LevelBadge
              level={byId.get(id)?.level ?? null}
              className="w-fit shrink-0"
            />
          </span>
        );
        return onTapPlayer ? (
          <button
            key={id}
            onClick={() => {
              haptic(8);
              onTapPlayer(id);
            }}
            className="flex min-h-[44px] w-full select-none items-center gap-1 rounded-lg px-1 py-1 text-left transition-all active:scale-[0.98] active:bg-background"
          >
            {content}
          </button>
        ) : (
          <div
            key={id}
            className="flex min-h-[40px] w-full items-center gap-1 px-1 py-1"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

function MatchView({
  match,
  matchNumber,
  byId,
  onFinish,
  onStart,
  onTapPlayer,
}: {
  match: Match;
  matchNumber: number;
  byId: Map<string, SessionPlayer>;
  onFinish: () => void;
  onStart: () => void;
  onTapPlayer: (playerId: string) => void;
}) {
  const isProposed = match.state === "proposed";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
          Match ke-{matchNumber}
        </span>
        <span
          className={
            isProposed ? "text-amber-600" : "text-muted-foreground"
          }
        >
          {isProposed ? "belum mulai" : "sedang berjalan"}
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        <TeamBlock
          ids={match.teamA.playerIds}
          label="Tim A"
          byId={byId}
          onTapPlayer={onTapPlayer}
        />
        <div className="flex shrink-0 items-center text-xs font-bold text-muted-foreground">
          VS
        </div>
        <TeamBlock
          ids={match.teamB.playerIds}
          label="Tim B"
          byId={byId}
          onTapPlayer={onTapPlayer}
        />
      </div>
      {isProposed ? (
        <Button variant="info" onClick={onStart}>
          <Play size={16} /> Mulai Main
        </Button>
      ) : (
        <Button variant="warning" onClick={onFinish}>
          Finish &amp; Input Skor
        </Button>
      )}
    </div>
  );
}

function PreviewNext({
  preview,
  byId,
}: {
  preview:
    | { teamA: [string, string]; teamB: [string, string] }
    | { reason: string };
  byId: Map<string, SessionPlayer>;
}) {
  const name = (id: string) => byId.get(id)?.name ?? "?";

  // Kasus: belum bisa rekomendasi (kurang pemain / kombinasi tidak valid)
  if ("reason" in preview) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border p-2.5 text-xs text-muted-foreground">
        ⏭️ Rekomendasi berikutnya: {preview.reason}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-2.5">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        ⏭️ Rekomendasi main berikutnya (otomatis naik saat match ini selesai)
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {preview.teamA.map(name).join(" & ")}
        </span>
        <span className="shrink-0 text-xs font-bold text-muted-foreground">
          vs
        </span>
        <span className="min-w-0 flex-1 truncate text-right">
          {preview.teamB.map(name).join(" & ")}
        </span>
      </div>
    </div>
  );
}

function RenameCourtDialog({
  initialLabel,
  onSave,
  onClose,
}: {
  initialLabel: string;
  onSave: (label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim()) return;
    haptic(15);
    setSaving(true);
    await onSave(label);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Ubah Nama Lapangan</SheetTitle>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nama lapangan (mis. Lapangan 14)"
            data-vaul-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={save}
              disabled={!label.trim() || saving}
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
