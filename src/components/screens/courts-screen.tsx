"use client";

import { useEffect, useMemo, useState } from "react";
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
  Clock,
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
import {
  LEVEL_LABEL,
  type Gender,
  type Level,
  type Match,
  type MatchMode,
  type SessionPlayer,
} from "@/lib/domain/types";
import type { WaitingSummary } from "@/lib/domain/pool-insight";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import {
  feasibilityForModes,
  summarizeWaiting,
  type ModeFeasibility,
} from "@/lib/domain/pool-insight";
import { planCompositionReserve } from "@/lib/domain/reserve-plan";
import type { DictKey } from "@/lib/i18n/dict";
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
    busyPlayerIds,
    reservableCandidates,
    session,
  } = useSessionStore();
  const t = useT();
  // Apakah mode "Match Pertama (urut check-in)" boleh dipakai saat ini.
  const firstMatchEligible = canUseFirstMatch();
  const [autoFillMsg, setAutoFillMsg] = useState<string | null>(null);
  // Lapangan yang sedang memilih mode Auto-fill (null = sheet tertutup).
  const [modeForCourt, setModeForCourt] = useState<string | null>(null);
  // Match yang butuh lengkapi level/gender dulu sebelum Finish (null = tak ada).
  const [completeInfoFor, setCompleteInfoFor] = useState<Match | null>(null);
  // Poin D: konfirmasi pinjam pemain dari lapangan lain (null = tak ada).
  const [reserveConfirm, setReserveConfirm] = useState<{
    courtId: string;
    mode: MatchMode;
    borrow: SessionPlayer[];
  } | null>(null);

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

  // Poin 3 (A & C): ringkasan pool menunggu + kelayakan tiap mode dari pemain
  // yang benar-benar TERSEDIA (kecualikan yang di proposed/playing = busy).
  const busy = busyPlayerIds();
  const round = (session?.current_round ?? 0) + 1;
  // busy adalah Set baru tiap render; pakai kunci stabil dari isinya sebagai
  // dependency memo (hindari re-compute tiap render, tapi tetap update saat
  // isi berubah).
  const busyKey = [...busy].sort().join(",");
  const waitingSummary = useMemo(
    () => summarizeWaiting(players, busy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, busyKey],
  );
  // Kandidat pinjam (sedang main, ber-level) — supaya badge feasibility ikut
  // memperhitungkan skenario Poin D (pinjam pemain), konsisten dgn autofill.
  const reservable = reservableCandidates();
  const reservableKey = reservable.map((p) => p.id).sort().join(",");
  const feasibility = useMemo(
    () =>
      feasibilityForModes(
        players,
        busy,
        MODE_OPTIONS.map((m) => m.value),
        round,
        reservable,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, busyKey, round, reservableKey],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t("courts.summary", {
            active: activePlayers.length,
            playing: playingCount,
            waiting: waiting.length,
          })}
        </span>
      </div>

      {/* Poin 3C: ringkasan pemain menunggu — bantu host lihat sekilas
          "siapa yang siap main berikutnya" & komposisinya (gender/level),
          supaya tidak trial-and-error di mode picker. */}
      {waitingSummary.waitingTotal > 0 && (
        <WaitingPanel summary={waitingSummary} />
      )}

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
          {t("courts.emptyNoCourt")}
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
                    aria-label={t("courts.renameCourt")}
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
                    aria-label={t("courts.deleteCourt")}
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
                        playingIds={playingIds}
                        onTapPlayer={(playerId) =>
                          setPlayerAction({ match: lockedPreview, playerId })
                        }
                      />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {t("courts.emptyCourt")}
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
                        <ListOrdered size={16} /> {t("courts.firstMatch")}
                      </Button>
                    )}
                    {/* Smart Matchmaking untuk lapangan KOSONG: buka pemilih mode
                        lalu susun match langsung dari pool menunggu. Sama seperti
                        di lapangan yang sedang jalan, hanya saja hasilnya mengisi
                        lapangan ini (proposed -> siap Mulai Main), bukan preview
                        match berikutnya. */}
                    <Button
                      variant="info"
                      onClick={() => {
                        haptic(12);
                        setModeForCourt(court.id);
                      }}
                    >
                      <Wand2 size={16} /> {t("courts.smartMatchmaking")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        haptic(10);
                        setManualFor(court.id);
                      }}
                    >
                      <Pencil size={16} /> {t("courts.fillManual")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Fab onClick={addCourt} icon={<Plus size={22} />} label={t("courts.addCourt")} />

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
          feasibility={feasibility}
          // Sembunyikan opsi "Match Pertama" di dalam sheet bila sheet dibuka
          // dari lapangan KOSONG — di sana sudah ada tombol First Match sendiri
          // di kartu (hindari redundansi). Di lapangan yang sedang jalan
          // (Auto-fill), sheet TETAP menampilkannya karena itu satu-satunya
          // jalan menyusun match pertama untuk pemain gelombang baru.
          showFirstMatch={!!playingMatchByCourt(modeForCourt)}
          onClose={() => setModeForCourt(null)}
          onPick={async (mode) => {
            const courtId = modeForCourt;
            setModeForCourt(null);
            const res = await generateLockedPreview(courtId, mode);
            if (res.ok) {
              setAutoFillMsg(null);
              return;
            }
            // Poin D: gagal menyusun dari pemain menunggu. Coba rencana pinjam
            // pemain dari lapangan lain — bila ada, minta konfirmasi host dulu
            // (opt-in). Bila tak ada solusi, tampilkan pesan error seperti biasa.
            const waitingLeveled = players.filter(
              (p) => p.status === "active" && p.level !== null && !busy.has(p.id),
            );
            const plan = planCompositionReserve(
              waitingLeveled,
              reservableCandidates(),
              mode,
              round,
            );
            if (plan && plan.borrow.length > 0) {
              setReserveConfirm({ courtId, mode, borrow: plan.borrow });
            } else {
              setAutoFillMsg(res.reason ?? "Gagal menyusun preview.");
            }
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
      {reserveConfirm && (
        <ReserveConfirmSheet
          borrow={reserveConfirm.borrow}
          onClose={() => setReserveConfirm(null)}
          onConfirm={async () => {
            const { courtId, mode, borrow } = reserveConfirm;
            setReserveConfirm(null);
            const res = await generateLockedPreview(
              courtId,
              mode,
              new Set(borrow.map((p) => p.id)),
            );
            if (!res.ok)
              setAutoFillMsg(res.reason ?? "Gagal menyusun preview.");
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

/**
 * Timer durasi match berjalan. Menampilkan mm:ss sejak `startedAt`, tick tiap
 * detik. Berubah warna jadi amber setelah 15 menit sebagai pengingat halus
 * bahwa match sudah lama (host bisa pertimbangkan rotasi).
 */
function MatchTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const started = new Date(startedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((now - started) / 1000));
  const mm = Math.floor(elapsedSec / 60);
  const ss = elapsedSec % 60;
  const longRunning = mm >= 15;

  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums",
        longRunning
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-secondary text-muted-foreground",
      )}
    >
      <Clock size={11} />
      {mm}:{ss.toString().padStart(2, "0")}
    </span>
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
  const t = useT();
  const session = useSessionStore((s) => s.session);
  const setsTarget = Math.min(3, Math.max(1, session?.sets_target ?? 1));
  const isMultiSet = setsTarget > 1;
  const isProposed = match.state === "proposed";
  const playedSets = match.sets ?? [];
  const currentSetNo = Math.min(setsTarget, playedSets.length + 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
          {t("courts.matchNo", { n: matchNumber })}
        </span>
        {isMultiSet && !isProposed && (
          <span className="rounded-md bg-secondary px-2 py-0.5">
            {t("courts.setBadge", { s: currentSetNo, n: setsTarget })}
          </span>
        )}
        <span
          className={
            isProposed ? "text-amber-600" : "text-muted-foreground"
          }
        >
          {isProposed ? t("courts.notStarted") : t("courts.running")}
        </span>
        {!isProposed && match.startedAt && (
          <MatchTimer startedAt={match.startedAt} />
        )}
      </div>

      {isMultiSet && playedSets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {playedSets.map((s, i) => (
            <span
              key={i}
              className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-xs font-semibold tabular-nums"
            >
              {s.a}–{s.b}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <TeamBlock
          ids={match.teamA.playerIds}
          label={t("courts.teamA")}
          byId={byId}
          onTapPlayer={onTapPlayer}
        />
        <div className="flex shrink-0 items-center text-xs font-bold text-muted-foreground">
          VS
        </div>
        <TeamBlock
          ids={match.teamB.playerIds}
          label={t("courts.teamB")}
          byId={byId}
          onTapPlayer={onTapPlayer}
        />
      </div>
      {isProposed ? (
        <Button variant="info" onClick={onStart}>
          <Play size={16} /> {t("courts.startMatch")}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="info"
            className="flex-1"
            onClick={onAutoFill}
          >
            <Wand2 size={16} />{" "}
            {hasPreview ? t("courts.regenerate") : t("courts.smartMatchmaking")}
          </Button>
          <Button variant="warning" className="flex-1" onClick={onFinish}>
            {isMultiSet ? t("courts.finishSet") : t("courts.finishScore")}
          </Button>
        </div>
      )}
    </div>
  );
}

function LockedPreview({
  preview,
  byId,
  playingIds,
  onTapPlayer,
}: {
  preview: Match;
  byId: Map<string, SessionPlayer>;
  playingIds: Set<string>;
  onTapPlayer: (playerId: string) => void;
}) {
  const t = useT();
  const ids = [...preview.teamA.playerIds, ...preview.teamB.playerIds];
  // Warning bila ada pemain preview yang statusnya sudah rest/left.
  const problem = ids.filter((id) => {
    const st = byId.get(id)?.status;
    return st === "resting" || st === "left";
  });
  // Poin 5: pemain preview yang masih main di lapangan lain (di-reserve).
  const reserved = ids.filter((id) => playingIds.has(id));

  const PlayerChip = ({ id }: { id: string }) => {
    const p = byId.get(id);
    const bad = p?.status === "resting" || p?.status === "left";
    const isReserved = playingIds.has(id);
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
            : isReserved
              ? "border-amber-400/60 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
              : "border-border bg-background active:bg-secondary",
        )}
      >
        <span className="flex items-center gap-1 truncate text-sm font-medium">
          {p?.name ?? "?"}
          <GenderBadge gender={p?.gender ?? null} />
          {bad && <span className="shrink-0 text-xs text-destructive">⚠️</span>}
          {!bad && isReserved && (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              main
            </span>
          )}
        </span>
        <LevelBadge level={p?.level ?? null} className="w-fit shrink-0" />
      </button>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {t("courts.nextLocked")}
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
      {reserved.length > 0 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          ⏳ {reserved.map((id) => byId.get(id)?.name).join(", ")} masih main di
          lapangan lain (di-booking). Bisa mulai setelah match mereka selesai.
        </p>
      )}
    </div>
  );
}


/**
 * Poin 3C: panel ringkasan pemain menunggu. Menunjukkan berapa yang siap main
 * berikutnya + komposisi gender & level, supaya host bisa langsung paham mode
 * mana yang realistis (mis. "cewek cuma 2 → ganda putri belum bisa") tanpa
 * harus coba-coba di mode picker.
 */
function WaitingPanel({ summary }: { summary: WaitingSummary }) {
  const levelOrder: Level[] = ["advanced", "intermediate", "beginner", "newbie"];
  const levelChips = levelOrder
    .filter((lv) => summary.byLevel[lv] > 0)
    .map((lv) => ({ label: LEVEL_LABEL[lv], count: summary.byLevel[lv] }));

  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold">
          {summary.readyLeveled} siap main
        </span>
        <span className="text-muted-foreground">
          dari {summary.waitingTotal} menunggu
        </span>
        {summary.noLevel > 0 && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            {summary.noLevel} belum ber-level
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-md bg-background px-1.5 py-0.5 text-muted-foreground">
          ♂ {summary.byGender.male} · ♀ {summary.byGender.female}
          {summary.byGender.unknown > 0 && ` · ? ${summary.byGender.unknown}`}
        </span>
        {levelChips.map((c) => (
          <span
            key={c.label}
            className="rounded-md bg-background px-1.5 py-0.5 text-muted-foreground"
          >
            {c.label} {c.count}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Poin D: sheet konfirmasi meminjam pemain dari lapangan lain. Muncul saat mode
 * yang dipilih tidak bisa terbentuk dari pemain menunggu, tapi BISA bila pemain
 * tertentu yang sedang main ikut dipinjam. Pemain tidak dicabut dari match
 * berjalan — hanya di-booking untuk match berikutnya (mulai setelah match
 * mereka selesai). Keputusan ada di host.
 */
function ReserveConfirmSheet({
  borrow,
  onConfirm,
  onClose,
}: {
  borrow: SessionPlayer[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);

  return (
    <Sheet open onOpenChange={(o) => !o && !submitting && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">
          {t("reserve.title")}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("reserve.body")}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {borrow.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {p.name}
              </span>
              <GenderBadge gender={p.gender} />
              <LevelBadge level={p.level} />
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {t("reserve.playing")}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {t("reserve.note")}
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="info"
            className="flex-1"
            onClick={() => {
              haptic(15);
              setSubmitting(true);
              onConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? t("reserve.arranging") : t("reserve.confirm")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
  const t = useT();
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
          {t("completeInfo.title")}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("completeInfo.body")}
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
                    <span className="ml-auto text-xs text-primary">{t("completeInfo.done")}</span>
                  )}
                </div>
                {p.level === null && (
                  <div className="mb-2">
                    <div className="mb-1 text-xs text-muted-foreground">
                      {t("players.setLevel")}
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
                      {t("players.setGender")}
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
            {t("common.cancel")}
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
            {allComplete ? t("completeInfo.continue") : t("completeInfo.incomplete")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const MODE_OPTIONS: {
  value: MatchMode;
  labelKey: DictKey;
  descKey: DictKey;
  emoji: string;
}[] = [
  { value: "balanced", labelKey: "mode.balanced", emoji: "⚖️", descKey: "mode.balancedDesc" },
  { value: "mixed", labelKey: "mode.mixed", emoji: "👫", descKey: "mode.mixedDesc" },
  { value: "ladies", labelKey: "mode.ladies", emoji: "👩", descKey: "mode.ladiesDesc" },
  { value: "gendongan", labelKey: "mode.gendongan", emoji: "🤝", descKey: "mode.gendonganDesc" },
  { value: "kelas", labelKey: "mode.kelas", emoji: "🎯", descKey: "mode.kelasDesc" },
];

function ModePickerSheet({
  firstMatchEligible,
  feasibility,
  showFirstMatch,
  onPick,
  onPickFirstMatch,
  onClose,
}: {
  firstMatchEligible: boolean;
  /** Kelayakan tiap mode dari pool pemain menunggu saat ini (Poin 3A). */
  feasibility: Record<MatchMode, ModeFeasibility>;
  /** Tampilkan opsi "Match Pertama" di dalam sheet. False untuk lapangan kosong
   *  (sudah punya tombol tersendiri di kartu → hindari redundansi). */
  showFirstMatch: boolean;
  onPick: (mode: MatchMode) => void;
  onPickFirstMatch: () => void;
  onClose: () => void;
}) {
  // Alert inline (di dalam sheet) saat "Match Pertama" ditekan tapi belum
  // memenuhi syarat — agar terlihat tanpa tertutup drawer, dan host tetap
  // bisa memilih mode lain di daftar bawahnya.
  const [firstMatchAlert, setFirstMatchAlert] = useState(false);
  const t = useT();

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("mode.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("mode.subtitle")}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {/* Match Pertama: hanya untuk pemain yang belum pernah main (0x),
              disusun murni berdasarkan urutan check-in (abaikan level).
              Ditampilkan hanya bila sheet dibuka dari lapangan yang sedang
              jalan — di lapangan kosong opsi ini sudah ada sebagai tombol
              tersendiri di kartu (hindari redundansi). */}
          {showFirstMatch && (
            <>
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
                  <span className="font-semibold">{t("mode.firstMatch")}</span>
                  <span className="text-xs text-muted-foreground">
                    {firstMatchEligible
                      ? t("mode.firstMatchDescOk")
                      : t("mode.firstMatchDescNo")}
                  </span>
                </span>
              </button>

              {firstMatchAlert && !firstMatchEligible && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  {t("mode.firstMatchAlert")}
                </div>
              )}

              <div className="my-1 h-px bg-border" />
            </>
          )}

          {MODE_OPTIONS.map((m) => {
            const feas = feasibility[m.value];
            const state = feas?.state ?? "ok";
            // 3 keadaan:
            //  - ok          : normal, tanpa badge.
            //  - needsBorrow : bisa TAPI perlu pinjam pemain (Poin D). Tetap
            //    dipilih; saat diklik akan muncul sheet konfirmasi pinjam.
            //  - impossible  : tak bisa walau dipinjam. Tampil redup + "belum bisa".
            const needsBorrow = state === "needsBorrow";
            const impossible = state === "impossible";
            return (
              <button
                key={m.value}
                onClick={() => {
                  haptic(12);
                  onPick(m.value);
                }}
                className={cn(
                  "flex select-none items-start gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-all active:scale-[0.99] active:bg-secondary",
                  impossible ? "bg-secondary/20 opacity-60" : "bg-secondary/40",
                )}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {t(m.labelKey)}
                    {needsBorrow && (
                      <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                        {t("mode.needsBorrow")}
                      </span>
                    )}
                    {impossible && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        {t("mode.unavailable")}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(needsBorrow || impossible) && feas?.hint
                      ? feas.hint
                      : t(m.descKey)}
                  </span>
                </span>
              </button>
            );
          })}
          <Button variant="outline" className="mt-1" onClick={onClose}>
            {t("common.cancel")}
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
  const t = useT();
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
        <SheetTitle className="text-lg font-bold">
          {t("deleteCourt.title", { label })}
        </SheetTitle>
        {hasPlaying ? (
          <div className="mt-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {t("deleteCourt.playing")}
          </div>
        ) : hasProposed ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("deleteCourt.proposed")}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("deleteCourt.plain")}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={deleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={confirm}
            disabled={deleting}
          >
            {deleting ? t("deleteCourt.deleting") : t("deleteCourt.confirm")}
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
  const t = useT();
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
        <SheetTitle className="text-lg font-bold">{t("courts.renameTitle")}</SheetTitle>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("courts.renamePlaceholder")}
            data-vaul-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={save}
              disabled={!label.trim() || saving}
            >
              {saving ? t("courts.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
