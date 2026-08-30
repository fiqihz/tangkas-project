"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { useSessionStore } from "@/lib/store/session-store";

/**
 * Sheet untuk membuat mabar baru.
 *  - mode "start": langsung ongoing & buka board
 *  - mode "schedule": simpan sebagai scheduled (untuk hari-H nanti)
 * Bisa isi nama lapangan kustom (mis. Lapangan 14, 17, 21).
 */
export function CreateSessionDialog({ onClose }: { onClose: () => void }) {
  const { createSession, error } = useSessionStore();
  const [name, setName] = useState(
    "Mabar " + new Date().toLocaleDateString("id-ID"),
  );
  const [courts, setCourts] = useState(3);
  const [labels, setLabels] = useState<string[]>(["", "", ""]);
  const [scheduledAt, setScheduledAt] = useState("");
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
      name: name.trim() || "Mabar",
      courts,
      status,
      scheduledAt:
        status === "scheduled" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      courtLabels: labels,
      open: status === "ongoing",
    });
    setSubmitting(false);
    if (res) onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Mabar Baru</SheetTitle>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nama mabar</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Jadwal (opsional — isi jika ingin dijadwalkan)
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
              Jumlah lapangan
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
              Nama lapangan (opsional)
            </div>
            <div className="flex flex-col gap-2">
              {labels.map((lbl, i) => (
                <Input
                  key={i}
                  placeholder={`Lapangan ${i + 1}`}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => submit("ongoing")}
              disabled={submitting}
            >
              {submitting ? "Membuat…" : "Mulai Sekarang 🏸"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => submit("scheduled")}
              disabled={submitting}
            >
              Simpan sebagai Jadwal
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
