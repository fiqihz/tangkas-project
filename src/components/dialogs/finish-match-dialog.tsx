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
  const { finishMatch, session } = useSessionStore();
  const t = useT();
  const trackShuttlecocks = session?.track_shuttlecocks ?? false;
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  // Default 1 kok (asumsi minimal 1 kepakai); host bisa ubah/kosongkan.
  const [shuttlecocks, setShuttlecocks] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const name = (id: string) => byId.get(id)?.name ?? "?";
  const teamAName = match.teamA.playerIds.map(name).join(" & ");
  const teamBName = match.teamB.playerIds.map(name).join(" & ");

  const a = parseInt(scoreA, 10);
  const b = parseInt(scoreB, 10);
  const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0;

  const submit = async () => {
    if (!valid) return;
    haptic(20);
    setSubmitting(true);
    const winner = a > b ? "a" : b > a ? "b" : "draw";
    // Kok opsional: kosong / non-angka dianggap 0.
    const cocks = trackShuttlecocks
      ? Math.max(0, parseInt(shuttlecocks, 10) || 0)
      : 0;
    await finishMatch(match.id, a, b, winner, cocks);
    setSubmitting(false);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">
          {t("finishMatch.title", { n: match.round })}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("finishMatch.subtitle")}
        </p>

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

        {valid && a === b && (
          <p className="mt-2 text-xs text-amber-600">
            {t("finishMatch.draw")}
          </p>
        )}
        {valid && a !== b && (
          <p className="mt-2 text-sm font-medium text-primary">
            {t("finishMatch.winner", { name: a > b ? teamAName : teamBName })}
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
            {submitting ? t("finishMatch.saving") : t("finishMatch.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
