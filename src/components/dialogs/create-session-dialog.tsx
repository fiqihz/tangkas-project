"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { haptic } from "@/lib/haptics";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettingsStore, useT } from "@/lib/store/settings-store";

/**
 * Sheet untuk membuat mabar baru.
 *  - mode "start": langsung ongoing & buka board
 *  - mode "schedule": simpan sebagai scheduled (untuk hari-H nanti)
 * Bisa isi nama lapangan kustom (mis. Lapangan 14, 17, 21).
 */
export function CreateSessionDialog({ onClose }: { onClose: () => void }) {
  const { createSession, error } = useSessionStore();
  const t = useT();
  const lang = useSettingsStore((s) => s.lang);
  const [name, setName] = useState(
    t("createSession.defaultName") +
      " " +
      new Date().toLocaleDateString(lang === "en" ? "en-US" : "id-ID"),
  );
  const [courts, setCourts] = useState(3);
  const [labels, setLabels] = useState<string[]>(["", "", ""]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [trackShuttlecocks, setTrackShuttlecocks] = useState(false);
  const [setsTarget, setSetsTarget] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const setCourtCount = (n: number) => {
    const clamped = Math.max(1, Math.min(10, n));
    setCourts(clamped);
    setLabels((prev) => {
      const next = [...prev];
      next.length = clamped;
      return Array.from({ length: clamped }, (_, i) => next[i] ?? "");
    });
  };

  const submit = async (status: "ongoing" | "scheduled") => {
    haptic(15);
    setSubmitting(true);
    const res = await createSession({
      name: name.trim() || t("createSession.defaultName"),
      courts,
      status,
      scheduledAt:
        status === "scheduled" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      courtLabels: labels,
      trackShuttlecocks,
      setsTarget,
      open: status === "ongoing",
    });
    setSubmitting(false);
    if (res) onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("createSession.title")}</SheetTitle>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("createSession.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("createSession.schedule")}
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              data-vaul-no-drag
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("createSession.courts")}
            </label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  haptic(8);
                  setCourtCount(courts - 1);
                }}
              >
                −
              </Button>
              <span className="w-10 text-center text-lg font-semibold">
                {courts}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  haptic(8);
                  setCourtCount(courts + 1);
                }}
              >
                +
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">
              {t("createSession.courtNames")}
            </div>
            <div className="flex flex-col gap-2">
              {labels.map((lbl, i) => (
                <Input
                  key={i}
                  placeholder={t("createSession.courtPlaceholder", { n: i + 1 })}
                  value={lbl}
                  onChange={(e) =>
                    setLabels((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {t("createSession.trackShuttlecocks")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("createSession.trackShuttlecocksDesc")}
              </div>
            </div>
            <ToggleSwitch
              checked={trackShuttlecocks}
              onChange={(v) => {
                haptic(8);
                setTrackShuttlecocks(v);
              }}
              label={t("createSession.trackShuttlecocks")}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("createSession.setsFormat")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={setsTarget === n ? "default" : "outline"}
                  onClick={() => {
                    haptic(8);
                    setSetsTarget(n);
                  }}
                  aria-pressed={setsTarget === n}
                >
                  {n === 1
                    ? t("createSession.oneSet")
                    : t("createSession.bestOf", { n })}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("createSession.setsFormatDesc")}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => submit("ongoing")}
              disabled={submitting}
            >
              {submitting ? t("createSession.creating") : t("createSession.startNow")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => submit("scheduled")}
              disabled={submitting}
            >
              {t("createSession.scheduleBtn")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
