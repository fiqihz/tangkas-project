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

/** Ringkasan M:x K:x untuk seorang pemain. */
function statLabel(p: SessionPlayer) {
  return `M:${p.wins} K:${p.losses}`;
}

/**
 * Aksi pemain di kartu lapangan. Mendukung 2 konteks:
 *  - match 'playing'  → Istirahatkan/Ganti pemain yang sedang main.
 *  - match 'proposed' → aksi pada pemain di preview terkunci.
 * Dibuka dengan men-tap pemain. Butuh konfirmasi eksplisit.
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
    restProposedPlayer,
    editProposedPlayer,
    players,
    matches,
    setPlayerLevel,
  } = useSessionStore();

  const isPreview = match.state === "proposed";

  const [view, setView] = useState<View>("menu");
  const [intent, setIntent] = useState<Intent>("rest");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const leavingStatus: PlayerStatus = intent === "rest" ? "resting" : "active";

  // Kandidat untuk mode PLAYING (pakai substituteCandidates existing).
  const { preferred, others, playing, sameMatch } = useMemo(
    () => substituteCandidates(match.id, player.id),
    [substituteCandidates, match.id, player.id],
  );

  // Kandidat untuk mode PREVIEW: pemain menunggu + pemain preview yang sama
  // (tukar posisi) + pemain di preview lain (swap antar lapangan).
  const previewCandidates = useMemo(() => {
    if (!isPreview)
      return { waiting: [], samePreview: [], otherPreview: [] };
    const playingIds = new Set<string>();
    const otherPreviewIds = new Set<string>();
    for (const m of matches) {
      if (m.state === "playing") {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          playingIds.add(id),
        );
      } else if (m.state === "proposed" && m.id !== match.id) {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          otherPreviewIds.add(id),
        );
      }
    }
    const inThisIds = [...match.teamA.playerIds, ...match.teamB.playerIds];
    const inThis = new Set(inThisIds);
    const waiting = players.filter(
      (p) =>
        p.status === "active" &&
        p.level !== null &&
        !playingIds.has(p.id) &&
        !otherPreviewIds.has(p.id) &&
        !inThis.has(p.id),
    );
    // 3 pemain lain di preview yang SAMA (untuk tukar posisi/tim).
    const samePreview = inThisIds
      .filter((id) => id !== player.id)
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is SessionPlayer => Boolean(p));
    const otherPreview = players.filter((p) => otherPreviewIds.has(p.id));
    return { waiting, samePreview, otherPreview };
  }, [isPreview, matches, players, match.id, match.teamA, match.teamB, player.id]);

  const applyQuery = (list: SessionPlayer[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  };

  // ---- Aksi ----
  const restAuto = async () => {
    haptic(15);
    setWorking(true);
    const res = isPreview
      ? await restProposedPlayer(match.id, player.id)
      : await substituteInProposed(match.id, player.id, "resting");
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

  const doPick = async (replacementId: string) => {
    haptic(15);
    setWorking(true);
    const res = isPreview
      ? await editProposedPlayer(match.id, player.id, replacementId)
      : await manualSubstitute(
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
        <SheetTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold">
          <span className="flex items-center gap-2">
            {player.name} <LevelBadge level={player.level} />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {statLabel(player)} · {player.gamesPlayed}x main
          </span>
        </SheetTitle>

        {view === "menu" && (
          <>
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
          </>
        )}

        {view === "pick" && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {intent === "rest"
                ? `Pilih pengganti — ${player.name} akan istirahat.`
                : `Pilih pengganti untuk ${player.name}.`}
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

            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
              {isPreview ? (
                <>
                  <Section title="Menunggu">
                    {applyQuery(previewCandidates.waiting).map((c) => (
                      <CandidateRow
                        key={c.id}
                        player={c}
                        onPick={() => doPick(c.id)}
                        disabled={working}
                      />
                    ))}
                    {applyQuery(previewCandidates.waiting).length === 0 && (
                      <EmptyRow />
                    )}
                  </Section>
                  {previewCandidates.samePreview.length > 0 && (
                    <Section title="Tukar posisi di preview ini">
                      {previewCandidates.samePreview.map((c) => (
                        <CandidateRow
                          key={c.id}
                          player={c}
                          onPick={() => doPick(c.id)}
                          disabled={working}
                          tag="preview ini"
                        />
                      ))}
                    </Section>
                  )}
                  {applyQuery(previewCandidates.otherPreview).length > 0 && (
                    <Section title="Tukar dengan preview lapangan lain">
                      {applyQuery(previewCandidates.otherPreview).map((c) => (
                        <CandidateRow
                          key={c.id}
                          player={c}
                          onPick={() => doPick(c.id)}
                          disabled={working}
                          tag="preview lain"
                        />
                      ))}
                    </Section>
                  )}
                </>
              ) : (
                <>
                  {preferred.length > 0 && (
                    <Section title="⭐ Disarankan">
                      {preferred.map((c) => (
                        <CandidateRow
                          key={c.id}
                          player={c}
                          onPick={() => doPick(c.id)}
                          disabled={working}
                          highlight
                        />
                      ))}
                    </Section>
                  )}
                  <Section title="Semua pemain tersedia">
                    {applyQuery(others).map((c) => (
                      <CandidateRow
                        key={c.id}
                        player={c}
                        onPick={() => doPick(c.id)}
                        disabled={working}
                      />
                    ))}
                    {applyQuery(others).length === 0 && <EmptyRow />}
                  </Section>
                  {intent === "correct" && sameMatch.length > 0 && (
                    <Section title="Tukar posisi di lapangan ini">
                      {sameMatch.map((c) => (
                        <CandidateRow
                          key={c.id}
                          player={c}
                          onPick={() => doPick(c.id)}
                          disabled={working}
                          tag="lapangan ini"
                        />
                      ))}
                    </Section>
                  )}
                  {intent === "correct" && applyQuery(playing).length > 0 && (
                    <Section title="Tukar dengan yang sedang main (lapangan lain)">
                      {applyQuery(playing).map((c) => (
                        <CandidateRow
                          key={c.id}
                          player={c}
                          onPick={() => doPick(c.id)}
                          disabled={working}
                          tag="main"
                        />
                      ))}
                    </Section>
                  )}
                </>
              )}
            </div>

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function EmptyRow() {
  return (
    <p className="py-2 text-center text-xs text-muted-foreground">
      Tidak ada pemain.
    </p>
  );
}

function CandidateRow({
  player,
  onPick,
  disabled,
  highlight,
  tag,
}: {
  player: SessionPlayer;
  onPick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  tag?: string;
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
        {tag && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-600">
            {tag}
          </span>
        )}
        M:{player.wins} K:{player.losses} · {player.gamesPlayed}x
      </span>
    </button>
  );
}
