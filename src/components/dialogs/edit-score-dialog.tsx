"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Match, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";

/**
 * Edit skor match yang sudah selesai — per set. Untuk match multi-set, tiap set
 * bisa dikoreksi terpisah; agregat & statistik pemain dihitung ulang di DB
 * (store.editMatchSets -> RPC edit_match_sets_atomic).
 *
 * Match lama (pre multi-set) tidak punya baris per-set; pada kasus itu kita
 * turunkan satu set dari skor agregat (match.score) sebagai nilai awal.
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
  const { editMatchSets } = useSessionStore();
  const t = useT();

  // Nilai awal: baris per-set bila ada; jika tidak, satu set dari agregat.
  const initial = useMemo<{ a: string; b: string }[]>(() => {
    const sets = match.sets ?? [];
    if (sets.length > 0) {
      return sets.map((s) => ({ a: String(s.a), b: String(s.b) }));
    }
    return [{ a: String(match.score?.a ?? ""), b: String(match.score?.b ?? "") }];
  }, [match]);

  const [rows, setRows] = useState<{ a: string; b: string }[]>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const name = (id: string) => byId.get(id)?.name ?? "?";
  const teamAName = match.teamA.playerIds.map(name).join(" & ");
  const teamBName = match.teamB.playerIds.map(name).join(" & ");

  const parsed = rows.map((r) => ({
    a: parseInt(r.a, 10),
    b: parseInt(r.b, 10),
  }));
  const allFilled = parsed.every(
    (p) => !isNaN(p.a) && !isNaN(p.b) && p.a >= 0 && p.b >= 0,
  );
  // Set imbang (indeks pertama yang bermasalah) untuk pesan yang jelas.
  const tieIndex = parsed.findIndex(
    (p) => !isNaN(p.a) && !isNaN(p.b) && p.a === p.b,
  );
  const valid = allFilled && tieIndex === -1;

  const setRow = (i: number, side: "a" | "b", value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [side]: value } : r)));
  };

  const submit = async () => {
    if (!valid) return;
    haptic(20);
    setSubmitting(true);
    const res = await editMatchSets(
      match.id,
      parsed.map((p) => ({ a: p.a, b: p.b })),
    );
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.reason ?? t("editScore.failed"));
      return;
    }
    onClose();
  };

  const multi = rows.length > 1;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("editScore.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("editScore.subtitle")}
        </p>

        <div className="mt-3 flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
          <span className="flex-1 truncate">{teamAName}</span>
          <span className="flex-1 truncate text-right">{teamBName}</span>
        </div>

        <div className="mt-1 flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              {multi && (
                <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">
                  {t("editScore.setLabel", { s: i + 1 })}
                </span>
              )}
              <Input
                type="number"
                inputMode="numeric"
                value={r.a}
                onChange={(e) => setRow(i, "a", e.target.value)}
                className="h-12 flex-1 text-center text-xl font-bold"
                data-vaul-no-drag
                onPointerDown={(e) => e.stopPropagation()}
              />
              <span className="text-lg font-bold text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                value={r.b}
                onChange={(e) => setRow(i, "b", e.target.value)}
                className="h-12 flex-1 text-center text-xl font-bold"
                data-vaul-no-drag
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>

        {tieIndex !== -1 && (
          <p className="mt-2 text-sm text-destructive">
            {t("editScore.setTie", { s: tieIndex + 1 })}
          </p>
        )}
        {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}

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
