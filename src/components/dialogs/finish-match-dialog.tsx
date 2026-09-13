"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";

export function FinishMatchDialog({
  match,
  byId,
  onClose,
}: {
  match: Match;
  byId: Map<string, SessionPlayer>;
  onClose: () => void;
}) {
  const { finishSet, setProgress, session } = useSessionStore();
  const t = useT();
  const trackShuttlecocks = session?.track_shuttlecocks ?? false;
  const progress = setProgress(match.id);
  const isMultiSet = progress.target > 1;
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  // Kok bersifat KUMULATIF per match (carry-over antar set). Default:
  //  - Set pertama (belum ada set tercatat): "1" (asumsi minimal 1 kepakai).
  //  - Set berikutnya: total kok berjalan yang sudah tersimpan di match, jadi
  //    host tinggal menambah kok yang kepakai di set ini.
  const playedSetCount = match.sets?.length ?? 0;
  const [shuttlecocks, setShuttlecocks] = useState(() =>
    playedSetCount > 0 ? String(match.shuttlecocks ?? 0) : "1",
  );
  const [submitting, setSubmitting] = useState(false);

  const name = (id: string) => byId.get(id)?.name ?? "?";
  const teamAName = match.teamA.playerIds.map(name).join(" & ");
  const teamBName = match.teamB.playerIds.map(name).join(" & ");

  const a = parseInt(scoreA, 10);
  const b = parseInt(scoreB, 10);
  const bothFilled = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0;
  // Satu set tidak boleh imbang (Opsi A) — harus ada pemenang.
  const tied = bothFilled && a === b;
  const valid = bothFilled && !tied;

  const submit = async () => {
    if (!valid) return;
    haptic(20);
    setSubmitting(true);
    // Kok opsional: kosong / non-angka dianggap 0.
    const cocks = trackShuttlecocks
      ? Math.max(0, parseInt(shuttlecocks, 10) || 0)
      : 0;
    const res = await finishSet(match.id, a, b, cocks);
    setSubmitting(false);
    if (res.ok) onClose();
  };

  // Judul & subtitle menyesuaikan mode: single-set pakai teks lama; multi-set
  // menyebut nomor set yang sedang diisi.
  const title = isMultiSet
    ? t("finishMatch.setTitle", { s: progress.current, n: match.round })
    : t("finishMatch.title", { n: match.round });
  const subtitle = isMultiSet
    ? t("finishMatch.setSubtitle")
    : t("finishMatch.subtitle");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{title}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

        {isMultiSet && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
              {t("finishMatch.bestOf", { n: progress.target })}
            </span>
            <span className="text-muted-foreground">
              {t("finishMatch.setProgress", {
                a: progress.setsWonA,
                b: progress.setsWonB,
              })}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 text-sm font-medium">{teamAName}</div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
              autoFocus
            />
          </div>
          <span className="pt-6 text-xl font-bold text-muted-foreground">–</span>
          <div className="flex-1">
            <div className="mb-1 text-sm font-medium">{teamBName}</div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
            />
          </div>
        </div>

        {tied && (
          <p className="mt-2 text-xs text-destructive">
            {t("finishMatch.setTie")}
          </p>
        )}
        {valid && (
          <p className="mt-2 text-sm font-medium text-primary">
            {isMultiSet
              ? t("finishMatch.setWinner", {
                  name: a > b ? teamAName : teamBName,
                })
              : t("finishMatch.winner", { name: a > b ? teamAName : teamBName })}
          </p>
        )}

        {trackShuttlecocks && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">
              {t("finishMatch.shuttlecocks")}
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  haptic(8);
                  setShuttlecocks((s) =>
                    String(Math.max(0, (parseInt(s, 10) || 0) - 1)),
                  );
                }}
              >
                −
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={shuttlecocks}
                onChange={(e) => setShuttlecocks(e.target.value)}
                className="h-11 w-16 text-center text-lg font-bold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  haptic(8);
                  setShuttlecocks((s) => String((parseInt(s, 10) || 0) + 1));
                }}
              >
                +
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("finishMatch.shuttlecocksHint")}
              </span>
            </div>
            {isMultiSet && playedSetCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("finishMatch.shuttlecocksCarry")}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1"
            onClick={submit}
            disabled={!valid || submitting}
          >
            {submitting
              ? t("finishMatch.saving")
              : isMultiSet
                ? t("finishMatch.saveSet")
                : t("finishMatch.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
