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
  const { finishMatch } = useSessionStore();
  const t = useT();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
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
    await finishMatch(match.id, a, b, winner);
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
