"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/ui/level-badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { isValidMatchup } from "@/lib/domain/rules";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

/**
 * Isi manual: pilih 4 pemain, lalu bagi jadi 2 tim.
 * Dipakai untuk match pertama (first come first play) atau override.
 */
export function ManualFillDialog({
  courtId,
  onClose,
}: {
  courtId: string;
  onClose: () => void;
}) {
  const { players, setManualMatch, busyPlayerIds } = useSessionStore();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const busy = busyPlayerIds();
  // Urutkan berdasarkan waktu check-in (first come first play) — biar host tahu
  // siapa yang datang duluan saat menyusun match pertama.
  const candidates = useMemo(
    () =>
      players
        .filter((p) => p.status === "active" && !busy.has(p.id))
        .sort((a, b) => {
          const at = a.checkedInAt ?? "";
          const bt = b.checkedInAt ?? "";
          if (at !== bt) return at.localeCompare(bt);
          return a.name.localeCompare(b.name);
        }),
    [players, busy],
  );

  const byId = new Map(players.map((p) => [p.id, p]));

  const toggle = (id: string) => {
    haptic(8);
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s,
    );
  };

  const teamA = selected.slice(0, 2) as [string, string];
  const teamB = selected.slice(2, 4) as [string, string];

  const ruleOk =
    selected.length === 4
      ? isValidMatchup(
          byId.get(teamA[0])!,
          byId.get(teamA[1])!,
          byId.get(teamB[0])!,
          byId.get(teamB[1])!,
        )
      : true;

  const submit = async () => {
    if (selected.length !== 4 || !ruleOk) return;
    haptic(20);
    setSubmitting(true);
    await setManualMatch(courtId, teamA, teamB);
    setSubmitting(false);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("manual.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("manual.subtitle")}
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          {candidates.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("manual.noIdle")}
            </p>
          )}
          {candidates.map((p) => {
            const idx = selected.indexOf(p.id);
            const picked = idx >= 0;
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex min-h-[48px] select-none items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-all active:scale-[0.98]",
                  picked
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card active:bg-secondary",
                )}
              >
                <span className="flex items-center gap-2">
                  {picked && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {idx < 2 ? "A" : "B"}
                    </span>
                  )}
                  {p.name} <LevelBadge level={p.level} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.gamesPlayed}x
                </span>
              </button>
            );
          })}
        </div>

        {!ruleOk && (
          <p className="mt-2 text-sm text-destructive">
            {t("manual.ruleViolation")}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1"
            onClick={submit}
            disabled={selected.length !== 4 || !ruleOk || submitting}
          >
            {submitting ? t("manual.saving") : t("manual.start", { n: selected.length })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
