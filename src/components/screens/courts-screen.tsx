"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Info, Play, Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Fab } from "@/components/ui/fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
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
    playingMatchByCourt,
    proposedMatchByCourt,
    courtMatchNumber,
    startMatch,
    generateLockedPreview,
  } = useSessionStore();
  const [autoFillMsg, setAutoFillMsg] = useState<string | null>(null);

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
  const [previewEdit, setPreviewEdit] = useState<{
    match: Match;
    playerId: string;
  } | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const activePlayers = players.filter((p) => p.status === "active");
  // "Main" = pemain di match yang sedang playing. Pemain di preview (proposed)
  // dianggap masih "menunggu" giliran, bukan main.
  const playingIds = new Set<string>();
  for (const m of useSessionStore.getState().matches) {
    if (m.state === "playing") {
      [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
        playingIds.add(id),
      );
    }
  }
  const playingCount = activePlayers.filter((p) => playingIds.has(p.id)).length;
  const waiting = activePlayers.filter((p) => !playingIds.has(p.id));
  const noLevelWaiting = waiting.filter((p) => p.level === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {activePlayers.length} aktif · {playingCount} main · {waiting.length}{" "}
          menunggu
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

      {autoFillMsg && (
        <div className="rounded-xl bg-amber-100 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          {autoFillMsg}
        </div>
      )}

      {courts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Belum ada lapangan. Tap tombol + untuk menambah.
        </p>
      )}

      {courts.map((court, i) => {
        const playing = playingMatchByCourt(court.id);
        const proposed = proposedMatchByCourt(court.id);
        // Match utama yang ditampilkan: yang sedang playing, atau kalau tidak
        // ada, proposed yang siap dimulai.
        const primary = playing ?? proposed;
        // Preview terkunci hanya tampil kalau ada match playing + proposed.
        const lockedPreview = playing && proposed ? proposed : null;
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

                {primary ? (
                  <>
                    <MatchView
                      match={primary}
                      matchNumber={courtMatchNumber(court.id, primary.id)}
                      byId={byId}
                      hasPreview={!!lockedPreview}
                      onAutoFill={async () => {
                        haptic(12);
                        const res = await generateLockedPreview(court.id);
                        if (!res.ok)
                          setAutoFillMsg(res.reason ?? "Gagal menyusun preview.");
                        else setAutoFillMsg(null);
                      }}
                      onFinish={() => {
                        haptic(12);
                        setFinishFor(primary);
                      }}
                      onStart={() => {
                        haptic(15);
                        startMatch(primary.id);
                      }}
                      onTapPlayer={(playerId) =>
                        setPlayerAction({ match: primary, playerId })
                      }
                    />
                    {lockedPreview && (
                      <LockedPreview
                        preview={lockedPreview}
                        byId={byId}
                        onTapPlayer={(playerId) =>
                          setPreviewEdit({ match: lockedPreview, playerId })
                        }
                      />
                    )}
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
      {previewEdit && (
        <EditPreviewDialog
          match={previewEdit.match}
          playerId={previewEdit.playerId}
          onClose={() => setPreviewEdit(null)}
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
  hasPreview,
  onAutoFill,
  onFinish,
  onStart,
  onTapPlayer,
}: {
  match: Match;
  matchNumber: number;
  byId: Map<string, SessionPlayer>;
  hasPreview: boolean;
  onAutoFill: () => void;
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
        <div className="flex gap-2">
          <Button
            variant="info"
            className="flex-1"
            onClick={onAutoFill}
            disabled={hasPreview}
          >
            <Wand2 size={16} /> Auto-fill
          </Button>
          <Button variant="warning" className="flex-1" onClick={onFinish}>
            Finish &amp; Skor
          </Button>
        </div>
      )}
    </div>
  );
}

function LockedPreview({
  preview,
  byId,
  onTapPlayer,
}: {
  preview: Match;
  byId: Map<string, SessionPlayer>;
  onTapPlayer: (playerId: string) => void;
}) {
  const ids = [...preview.teamA.playerIds, ...preview.teamB.playerIds];
  // Warning bila ada pemain preview yang statusnya sudah rest/left.
  const problem = ids.filter((id) => {
    const st = byId.get(id)?.status;
    return st === "resting" || st === "left";
  });

  const PlayerChip = ({ id }: { id: string }) => {
    const p = byId.get(id);
    const bad = p?.status === "resting" || p?.status === "left";
    return (
      <button
        onClick={() => {
          haptic(8);
          onTapPlayer(id);
        }}
        className={cn(
          "flex min-h-[44px] w-full select-none flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-all active:scale-[0.98]",
          bad
            ? "border-destructive/50 bg-destructive/10"
            : "border-border bg-background active:bg-secondary",
        )}
      >
        <span className="flex items-center gap-1 truncate text-sm font-medium">
          {p?.name ?? "?"}
          {bad && <span className="shrink-0 text-xs text-destructive">⚠️</span>}
        </span>
        <LevelBadge level={p?.level ?? null} className="w-fit shrink-0" />
      </button>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        ⏭️ Main berikutnya (terkunci — tap pemain untuk ganti)
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {preview.teamA.playerIds.map((id) => (
            <PlayerChip key={id} id={id} />
          ))}
        </div>
        <div className="flex shrink-0 items-center text-xs font-bold text-muted-foreground">
          vs
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {preview.teamB.playerIds.map((id) => (
            <PlayerChip key={id} id={id} />
          ))}
        </div>
      </div>
      {problem.length > 0 && (
        <p className="mt-2 text-xs text-destructive">
          ⚠️ {problem.map((id) => byId.get(id)?.name).join(", ")} sudah
          istirahat/pulang. Ganti dulu sebelum match ini mulai.
        </p>
      )}
    </div>
  );
}

/**
 * Dialog edit pemain di preview terkunci: ganti 1 pemain dengan pemain Active
 * yang menunggu (bukan yang sedang main). Menukar dengan pemain di preview
 * lapangan lain ditangani otomatis oleh store (tetap eksklusif).
 */
function EditPreviewDialog({
  match,
  playerId,
  onClose,
}: {
  match: Match;
  playerId: string;
  onClose: () => void;
}) {
  const { players, matches, editProposedPlayer } = useSessionStore();
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const outPlayer = players.find((p) => p.id === playerId);

  // Pemain yang sedang di preview (proposed) lain — untuk swap antar preview.
  const inOtherPreview = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.state === "proposed" && m.id !== match.id) {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          ids.add(id),
        );
      }
    }
    return ids;
  }, [matches, match.id]);

  // Pemain yang sedang playing (di lapangan) — tidak bisa dipilih untuk preview.
  const playingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.state === "playing") {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          ids.add(id),
        );
      }
    }
    return ids;
  }, [matches]);

  const q = query.trim().toLowerCase();
  const matchIds = new Set([
    ...match.teamA.playerIds,
    ...match.teamB.playerIds,
  ]);

  // Kelompok 1: pemain Active menunggu (bebas, tidak di preview/playing manapun).
  const waiting = useMemo(
    () =>
      players.filter(
        (p) =>
          p.status === "active" &&
          p.level !== null &&
          !playingIds.has(p.id) &&
          !inOtherPreview.has(p.id) &&
          !matchIds.has(p.id) &&
          (!q || p.name.toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, playingIds, inOtherPreview, q],
  );

  // Kelompok 2: pemain di preview lapangan lain (swap antar preview).
  const swapCandidates = useMemo(
    () =>
      players.filter(
        (p) =>
          inOtherPreview.has(p.id) &&
          (!q || p.name.toLowerCase().includes(q)),
      ),
    [players, inOtherPreview, q],
  );

  const pick = async (inId: string) => {
    haptic(15);
    setWorking(true);
    const res = await editProposedPlayer(match.id, playerId, inId);
    setWorking(false);
    if (!res.ok) return setMsg(res.reason ?? "Gagal.");
    onClose();
  };

  const Row = ({
    p,
    swap,
  }: {
    p: SessionPlayer;
    swap?: boolean;
  }) => (
    <button
      onClick={() => pick(p.id)}
      disabled={working}
      className="flex min-h-[48px] select-none items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm transition-all active:scale-[0.98] active:bg-secondary"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{p.name}</span>
        <LevelBadge level={p.level} className="shrink-0" />
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {swap && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-600">
            preview lain
          </span>
        )}
        {p.gamesPlayed}x
      </span>
    </button>
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">
          Ganti {outPlayer?.name}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih dari pemain menunggu, atau tukar dengan pemain di preview
          lapangan lain.
        </p>
        {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}

        <div className="relative mt-3 mb-2">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Cari nama…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Menunggu
            </div>
            <div className="flex flex-col gap-1.5">
              {waiting.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Tidak ada pemain menunggu.
                </p>
              ) : (
                waiting.map((p) => <Row key={p.id} p={p} />)
              )}
            </div>
          </div>

          {swapCandidates.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Tukar dengan preview lapangan lain
              </div>
              <div className="flex flex-col gap-1.5">
                {swapCandidates.map((p) => (
                  <Row key={p.id} p={p} swap />
                ))}
              </div>
            </div>
          )}
        </div>

        <Button className="mt-4 w-full" variant="ghost" onClick={onClose}>
          Batal
        </Button>
      </SheetContent>
    </Sheet>
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
