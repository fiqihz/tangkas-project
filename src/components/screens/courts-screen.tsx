"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Pencil,
  Info,
  Play,
  Search,
  Wand2,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { GenderBadge, GenderSelect } from "@/components/ui/gender-select";
import { Fab } from "@/components/ui/fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import type {
  Gender,
  Level,
  Match,
  MatchMode,
  SessionPlayer,
} from "@/lib/domain/types";
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
    generateFirstMatch,
    canUseFirstMatch,
    setPlayerLevel,
    setPlayerGender,
  } = useSessionStore();
  // Apakah mode "Match Pertama (urut check-in)" boleh dipakai saat ini.
  const firstMatchEligible = canUseFirstMatch();
  const [autoFillMsg, setAutoFillMsg] = useState<string | null>(null);
  // Lapangan yang sedang memilih mode Auto-fill (null = sheet tertutup).
  const [modeForCourt, setModeForCourt] = useState<string | null>(null);
  // Match yang butuh lengkapi level/gender dulu sebelum Finish (null = tak ada).
  const [completeInfoFor, setCompleteInfoFor] = useState<Match | null>(null);

  const [finishFor, setFinishFor] = useState<Match | null>(null);
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<{
    id: string;
    label: string;
  } | null>(null);
  // Lapangan yang menunggu konfirmasi hapus (null = tak ada).
  const [deleteFor, setDeleteFor] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [playerAction, setPlayerAction] = useState<{
    match: Match;
    playerId: string;
  } | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Match butuh dilengkapi bila ada pemain dengan level/gender belum di-set.
  const matchNeedsInfo = (m: Match) =>
    [...m.teamA.playerIds, ...m.teamB.playerIds].some((id) => {
      const p = byId.get(id);
      return !p || p.level === null || p.gender === null;
    });

  // Klik Finish: bila ada info kurang, buka gate dulu; kalau lengkap langsung Finish.
  const handleFinish = (m: Match) => {
    haptic(12);
    if (matchNeedsInfo(m)) setCompleteInfoFor(m);
    else setFinishFor(m);
  };

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
                      setDeleteFor({ id: court.id, label: court.label });
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
                      onAutoFill={() => {
                        haptic(12);
                        setModeForCourt(court.id);
                      }}
                      onFinish={() => handleFinish(primary)}
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
                          setPlayerAction({ match: lockedPreview, playerId })
                        }
                      />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Lapangan kosong.
                    </p>
                    {firstMatchEligible && (
                      <Button
                        variant="info"
                        onClick={async () => {
                          haptic(12);
                          const res = await generateFirstMatch(court.id);
                          if (!res.ok)
                            setAutoFillMsg(
                              res.reason ?? "Gagal menyusun match pertama.",
                            );
                          else setAutoFillMsg(null);
                        }}
                      >
                        <ListOrdered size={16} /> Match Pertama (urut check-in)
                      </Button>
                    )}
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
      {modeForCourt && (
        <ModePickerSheet
          firstMatchEligible={firstMatchEligible}
          onClose={() => setModeForCourt(null)}
          onPick={async (mode) => {
            const courtId = modeForCourt;
            setModeForCourt(null);
            const res = await generateLockedPreview(courtId, mode);
            if (!res.ok)
              setAutoFillMsg(res.reason ?? "Gagal menyusun preview.");
            else setAutoFillMsg(null);
          }}
          onPickFirstMatch={async () => {
            // Hanya dipanggil saat eligible (sheet menahan kasus tidak eligible
            // & menampilkan alert inline). Tutup sheet lalu susun match pertama.
            const courtId = modeForCourt;
            setModeForCourt(null);
            const res = await generateFirstMatch(courtId);
            if (!res.ok)
              setAutoFillMsg(res.reason ?? "Gagal menyusun match pertama.");
            else setAutoFillMsg(null);
          }}
        />
      )}
      {completeInfoFor && (
        <CompleteInfoDialog
          match={completeInfoFor}
          byId={byId}
          onSetLevel={setPlayerLevel}
          onSetGender={setPlayerGender}
          onClose={() => setCompleteInfoFor(null)}
          onDone={() => {
            const m = completeInfoFor;
            setCompleteInfoFor(null);
            setFinishFor(m);
          }}
        />
      )}

      {deleteFor && (
        <DeleteCourtDialog
          label={deleteFor.label}
          hasPlaying={!!playingMatchByCourt(deleteFor.id)}
          hasProposed={!!proposedMatchByCourt(deleteFor.id)}
          onConfirm={async () => {
            const id = deleteFor.id;
            setDeleteFor(null);
            await removeCourt(id);
          }}
          onClose={() => setDeleteFor(null)}
        />
      )}

      <Toast message={autoFillMsg} onClose={() => setAutoFillMsg(null)} />
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
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium">
                {byId.get(id)?.name ?? "?"}
              </span>
              <GenderBadge gender={byId.get(id)?.gender ?? null} />
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
          <GenderBadge gender={p?.gender ?? null} />
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


function CompleteInfoDialog({
  match,
  byId,
  onSetLevel,
  onSetGender,
  onDone,
  onClose,
}: {
  match: Match;
  byId: Map<string, SessionPlayer>;
  onSetLevel: (playerId: string, level: Level) => Promise<void>;
  onSetGender: (playerId: string, gender: Gender) => Promise<void>;
  onDone: () => void;
  onClose: () => void;
}) {
  const ids = [...match.teamA.playerIds, ...match.teamB.playerIds];
  const playersInMatch = ids
    .map((id) => byId.get(id))
    .filter((p): p is SessionPlayer => Boolean(p));
  // Semua lengkap bila tak ada lagi yang level/gender-nya null.
  const allComplete = playersInMatch.every(
    (p) => p.level !== null && p.gender !== null,
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">
          Lengkapi data pemain
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Match ini sudah selesai — set <b>level</b> & <b>gender</b> pemain yang
          belum terisi sebelum input skor. Data tersimpan ke roster.
        </p>

        <div className="mt-4 flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
          {playersInMatch.map((p) => {
            const done = p.level !== null && p.gender !== null;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-3",
                  done
                    ? "border-border bg-secondary/30"
                    : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
                )}
              >
                <div className="mb-2 flex items-center gap-2 font-medium">
                  {p.name}
                  <LevelBadge level={p.level} />
                  <GenderBadge gender={p.gender} />
                  {done && (
                    <span className="ml-auto text-xs text-primary">✓ lengkap</span>
                  )}
                </div>
                {p.level === null && (
                  <div className="mb-2">
                    <div className="mb-1 text-xs text-muted-foreground">
                      Set level
                    </div>
                    <LevelSelect
                      value={p.level}
                      onChange={(lv) => {
                        haptic(8);
                        void onSetLevel(p.id, lv);
                      }}
                      size="sm"
                    />
                  </div>
                )}
                {p.gender === null && (
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Set gender
                    </div>
                    <GenderSelect
                      value={p.gender}
                      onChange={(g) => {
                        haptic(8);
                        void onSetGender(p.id, g);
                      }}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="warning"
            className="flex-1"
            onClick={() => {
              haptic(15);
              onDone();
            }}
            disabled={!allComplete}
          >
            {allComplete ? "Lanjut ke Skor" : "Lengkapi dulu"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const MODE_OPTIONS: {
  value: MatchMode;
  label: string;
  desc: string;
  emoji: string;
}[] = [
  {
    value: "balanced",
    label: "Seimbang",
    emoji: "⚖️",
    desc: "Default. Susun tim seimbang, minimalkan selisih level.",
  },
  {
    value: "mixed",
    label: "Campuran",
    emoji: "👫",
    desc: "Ganda campuran: tiap tim 1 cowok + 1 cewek (best-effort).",
  },
  {
    value: "ladies",
    label: "Ganda Putri",
    emoji: "👩",
    desc: "Semua pemain cewek. Aturan Newbie+Newbie dilonggarkan.",
  },
  {
    value: "gendongan",
    label: "Gendongan",
    emoji: "🤝",
    desc: "Tiap tim 1 kuat + 1 lemah, dua tim dibuat seimbang.",
  },
  {
    value: "kelas",
    label: "Sesuai Kelas",
    emoji: "🎯",
    desc: "Pasangkan pemain dengan level yang sama.",
  },
];

function ModePickerSheet({
  firstMatchEligible,
  onPick,
  onPickFirstMatch,
  onClose,
}: {
  firstMatchEligible: boolean;
  onPick: (mode: MatchMode) => void;
  onPickFirstMatch: () => void;
  onClose: () => void;
}) {
  // Alert inline (di dalam sheet) saat "Match Pertama" ditekan tapi belum
  // memenuhi syarat — agar terlihat tanpa tertutup drawer, dan host tetap
  // bisa memilih mode lain di daftar bawahnya.
  const [firstMatchAlert, setFirstMatchAlert] = useState(false);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Pilih Mode Match</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Mode menentukan cara pemain disusun untuk preview berikutnya.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {/* Match Pertama: hanya untuk pemain yang belum pernah main (0x),
              disusun murni berdasarkan urutan check-in (abaikan level). */}
          <button
            onClick={() => {
              haptic(12);
              if (!firstMatchEligible) {
                setFirstMatchAlert(true);
                return;
              }
              onPickFirstMatch();
            }}
            className={cn(
              "flex select-none items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]",
              firstMatchEligible
                ? "border-primary/40 bg-primary/10 active:bg-primary/20"
                : "border-border bg-secondary/40 opacity-60 active:bg-secondary",
            )}
          >
            <span className="text-xl leading-none">🔢</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">
                Match Pertama (urut check-in)
              </span>
              <span className="text-xs text-muted-foreground">
                {firstMatchEligible
                  ? "Susun 4 pemain yang belum pernah main, urut kedatangan. Abaikan level."
                  : "Butuh min. 4 pemain yang belum pernah main (0x)."}
              </span>
            </span>
          </button>

          {firstMatchAlert && !firstMatchEligible && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              ⚠️ Mode <b>Match Pertama</b> tidak bisa dipakai: pemain yang belum
              pernah main (0x) kurang dari 4. Pilih mode lain di bawah.
            </div>
          )}

          <div className="my-1 h-px bg-border" />

          {MODE_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                haptic(12);
                onPick(m.value);
              }}
              className="flex select-none items-start gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-3 text-left transition-all active:scale-[0.99] active:bg-secondary"
            >
              <span className="text-xl leading-none">{m.emoji}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          ))}
          <Button variant="outline" className="mt-1" onClick={onClose}>
            Batal
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeleteCourtDialog({
  label,
  hasPlaying,
  hasProposed,
  onConfirm,
  onClose,
}: {
  label: string;
  hasPlaying: boolean;
  hasProposed: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (deleting) return;
    haptic(15);
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && !deleting && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Hapus {label}?</SheetTitle>
        {hasPlaying ? (
          <div className="mt-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            ⚠️ Ada match yang <b>sedang berjalan</b> di lapangan ini. Menghapus
            lapangan akan <b>membatalkan match tersebut</b> — skor yang belum
            di-input hilang dan pemainnya dikembalikan ke status aktif. Tindakan
            ini tidak bisa dibatalkan.
          </div>
        ) : hasProposed ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ada preview match berikutnya di lapangan ini. Menghapus lapangan akan
            membatalkan preview tersebut. Tindakan ini tidak bisa dibatalkan.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Lapangan ini akan dihapus dari sesi. Tindakan ini tidak bisa
            dibatalkan.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={deleting}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={confirm}
            disabled={deleting}
          >
            {deleting ? "Menghapus…" : "Hapus lapangan"}
          </Button>
        </div>
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
