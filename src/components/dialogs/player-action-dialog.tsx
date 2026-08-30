"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { UserCog, X, Search, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Match, PlayerStatus, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";

// Niat penggantian: 'rest' -> pemain jadi resting; 'correct' -> tetap active
type Intent = "rest" | "correct";
type View = "menu" | "pick";

/**
 * Aksi pemain di dalam match yang sedang keluar di lapangan (belum di-Finish).
 * Dibuka dengan men-tap baris pemain. Butuh konfirmasi eksplisit.
 */
export function PlayerActionDialog({
  match,
  player,
  onClose,
}: {
  match: Match;
  player: SessionPlayer;
  onClose: () => void;
}) {
  const {
    substituteInProposed,
    manualSubstitute,
    substituteCandidates,
    setPlayerLevel,
  } = useSessionStore();

  const [view, setView] = useState<View>("menu");
  const [intent, setIntent] = useState<Intent>("rest");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const leavingStatus: PlayerStatus = intent === "rest" ? "resting" : "active";

  const { preferred, others, playing } = useMemo(
    () => substituteCandidates(match.id, player.id),
    [substituteCandidates, match.id, player.id],
  );

  const filteredOthers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;
    return others.filter((p) => p.name.toLowerCase().includes(q));
  }, [others, query]);

  const filteredPlaying = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return playing;
    return playing.filter((p) => p.name.toLowerCase().includes(q));
  }, [playing, query]);

  const restAuto = async () => {
    haptic(15);
    setWorking(true);
    const res = await substituteInProposed(match.id, player.id, "resting");
    setWorking(false);
    if (!res.ok) return setMsg(res.reason ?? "Gagal.");
    onClose();
  };

  const openPick = (which: Intent) => {
    haptic(8);
    setIntent(which);
    setMsg(null);
    setView("pick");
  };

  const doManual = async (replacementId: string) => {
    haptic(15);
    setWorking(true);
    const res = await manualSubstitute(
      match.id,
      player.id,
      replacementId,
      leavingStatus,
    );
    setWorking(false);
    if (!res.ok) return setMsg(res.reason ?? "Gagal.");
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="flex items-center gap-2 text-lg font-bold">
          {player.name} <LevelBadge level={player.level} />
        </SheetTitle>

        {view === "menu" && (
          <>
            {/* Set level — selalu tersedia (berguna untuk observasi) */}
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted-foreground">
                Set level {player.level === null && "(belum di-set)"}
              </div>
              <LevelSelect
                value={player.level}
                onChange={(lv) => {
                  haptic(8);
                  setPlayerLevel(player.id, lv);
                }}
                size="sm"
              />
            </div>

            {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}

            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <Button size="lg" onClick={restAuto} disabled={working}>
                <Image
                  src="/icons/sleeping.png"
                  alt=""
                  width={18}
                  height={18}
                  className="opacity-90"
                />
                Istirahatkan (pengganti otomatis)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => openPick("rest")}
              >
                <UserCog size={18} /> Istirahatkan — pilih pengganti
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => openPick("correct")}
              >
                <ArrowLeftRight size={18} /> Ganti / tukar pemain
              </Button>

              <Button size="lg" variant="ghost" onClick={onClose}>
                <X size={18} /> Batal
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              &quot;Ganti / tukar pemain&quot;: pemain ini kembali ke antrian
              (tetap aktif). Bisa diganti pemain menunggu, atau ditukar dengan
              pemain yang sedang main di lapangan lain.
            </p>
          </>
        )}

        {view === "pick" && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {intent === "rest"
                ? `Pilih pengganti — ${player.name} akan istirahat.`
                : `Pilih pengganti — ${player.name} kembali ke antrian (aktif).`}
            </p>
            {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}

            {preferred.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-semibold text-primary">
                  ⭐ Disarankan
                </div>
                <div className="flex flex-col gap-1.5">
                  {preferred.map((c) => (
                    <CandidateRow
                      key={c.id}
                      player={c}
                      onPick={() => doManual(c.id)}
                      disabled={working}
                      highlight
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Semua pemain tersedia
              </div>
              <div className="relative mb-2">
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
              <div className="flex max-h-[35vh] flex-col gap-1.5 overflow-y-auto">
                {filteredOthers.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Tidak ada pemain tersedia lain.
                  </p>
                )}
                {filteredOthers.map((c) => (
                  <CandidateRow
                    key={c.id}
                    player={c}
                    onPick={() => doManual(c.id)}
                    disabled={working}
                  />
                ))}
              </div>
            </div>

            {/* Tukar dengan pemain yang sedang main (hanya untuk niat "ganti/tukar") */}
            {intent === "correct" && filteredPlaying.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Tukar dengan yang sedang main
                </div>
                <div className="flex max-h-[30vh] flex-col gap-1.5 overflow-y-auto">
                  {filteredPlaying.map((c) => (
                    <CandidateRow
                      key={c.id}
                      player={c}
                      onPick={() => doManual(c.id)}
                      disabled={working}
                      swap
                    />
                  ))}
                </div>
              </div>
            )}

            <Button
              className="mt-4 w-full"
              variant="ghost"
              onClick={() => {
                haptic(8);
                setView("menu");
                setMsg(null);
              }}
            >
              Kembali
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CandidateRow({
  player,
  onPick,
  disabled,
  highlight,
  swap,
}: {
  player: SessionPlayer;
  onPick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  swap?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={cn(
        "flex min-h-[48px] select-none items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all active:scale-[0.98]",
        highlight
          ? "border-primary/50 bg-primary/5 active:bg-primary/10"
          : "border-border bg-card active:bg-secondary",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{player.name}</span>
        <LevelBadge level={player.level} className="shrink-0" />
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {swap && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600">
            main
          </span>
        )}
        {player.gamesPlayed}x
      </span>
    </button>
  );
}
