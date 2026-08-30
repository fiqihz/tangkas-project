"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";

/**
 * Edit skor match yang sudah selesai. Statistik pemain di-recalculate
 * (undo skor lama, apply skor baru) di store.editMatchScore.
 */
export function EditScoreDialog({
  match,
  byId,
  onClose,
}: {
  match: Match;
  byId: Map<string, SessionPlayer>;
  onClose: () => void;
}) {
  const { editMatchScore } = useSessionStore();
  const [scoreA, setScoreA] = useState(String(match.score?.a ?? ""));
  const [scoreB, setScoreB] = useState(String(match.score?.b ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    const res = await editMatchScore(match.id, a, b, winner);
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.reason ?? "Gagal menyimpan.");
      return;
    }
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Edit Skor</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistik & leaderboard otomatis dihitung ulang.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 text-sm font-medium">{teamAName}</div>
            <Input
              type="number"
              inputMode="numeric"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
              data-vaul-no-drag
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
          <span className="pt-6 text-xl font-bold text-muted-foreground">–</span>
          <div className="flex-1">
            <div className="mb-1 text-sm font-medium">{teamBName}</div>
            <Input
              type="number"
              inputMode="numeric"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="h-14 text-center text-2xl font-bold"
              data-vaul-no-drag
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {valid && a !== b && (
          <p className="mt-2 text-sm font-medium text-primary">
            🏆 Pemenang: {a > b ? teamAName : teamBName}
          </p>
        )}
        {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="flex-1"
            onClick={submit}
            disabled={!valid || submitting}
          >
            {submitting ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
