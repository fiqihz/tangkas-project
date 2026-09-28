"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, MessageSquareText, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { LeaderboardRow } from "@/lib/domain/leaderboard";
import { haptic } from "@/lib/haptics";
import {
  buildShareImagePayload,
  formatShareDate,
  type ShareImageFormat,
} from "@/lib/share-image";
import {
  canShareImageFile,
  downloadImageFile,
  shareImageFile,
  shareResultText,
} from "@/lib/share-result";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSettingsStore, useT } from "@/lib/store/settings-store";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Hasil render per format. Belum ada entri = sedang dibuat / belum dimulai. */
type ImageState =
  | { status: "error" }
  | { status: "ready"; file: File; url: string };

/** Nama file aman untuk diunduh, mis. "tangkasboard-mabar-senin-story.png". */
function fileNameFor(sessionName: string, format: ShareImageFormat): string {
  const slug =
    sessionName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "hasil";
  return `tangkasboard-${slug}-${format}.png`;
}

/**
 * Sheet "Bagikan hasil": pilih ukuran (story/kotak) → preview gambar → bagikan.
 *
 * Dua langkah disengaja: gambar dibuat duluan (butuh request ke server), baru
 * tombol Bagikan memanggil Web Share. Safari iOS menolak share bila jeda
 * antara tap dan panggilan share terlalu lama, jadi share tidak boleh
 * menunggu proses render.
 */
export function ShareImageSheet({
  open,
  onOpenChange,
  sessionName,
  dateIso,
  matchCount,
  rows,
  resultText,
  onToast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionName: string;
  dateIso: string | null;
  matchCount: number;
  rows: LeaderboardRow[];
  resultText: string;
  onToast: (message: string) => void;
}) {
  const t = useT();
  const lang = useSettingsStore((s) => s.lang);
  const communityName = useAuthStore(
    (s) =>
      s.memberships.find((m) => m.communityId === s.activeCommunityId)
        ?.communityName ?? "",
  );
  const [format, setFormat] = useState<ShareImageFormat>("story");
  const [images, setImages] = useState<Partial<Record<ShareImageFormat, ImageState>>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Kunci isi gambar: bila data berubah (bahasa, ranking), cache dibuang.
  const payloadKey = useMemo(
    () => JSON.stringify({ lang, communityName, sessionName, dateIso, matchCount, rows }),
    [lang, communityName, sessionName, dateIso, matchCount, rows],
  );

  // Cabut object URL lama saat data berubah / komponen dilepas.
  useEffect(() => {
    return () => {
      // Request lama (data usang) jangan sampai menimpa cache data baru.
      abortRef.current?.abort();
      setImages((prev) => {
        for (const s of Object.values(prev)) {
          if (s?.status === "ready") URL.revokeObjectURL(s.url);
        }
        return {};
      });
    };
  }, [payloadKey]);

  const generate = useCallback(
    async (fmt: ShareImageFormat) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const { data: auth } = await getSupabase().auth.getSession();
        const token = auth.session?.access_token;
        if (!token) throw new Error("no session");

        const payload = buildShareImagePayload({
          format: fmt,
          lang,
          sessionName,
          communityName,
          dateLabel: formatShareDate(dateIso, lang),
          matchCount,
          rows,
        });

        const res = await fetch("/api/share-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const file = new File([blob], fileNameFor(sessionName, fmt), {
          type: "image/png",
        });
        const url = URL.createObjectURL(file);
        setImages((prev) => ({ ...prev, [fmt]: { status: "ready", file, url } }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setImages((prev) => ({ ...prev, [fmt]: { status: "error" } }));
      }
    },
    [lang, sessionName, communityName, dateIso, matchCount, rows],
  );

  // Buat gambar saat sheet dibuka / format diganti (sekali per format & data).
  // State hanya di-set setelah request selesai (async), jadi efek ini tidak
  // memicu render berantai. `inFlight` mencegah request dobel untuk kunci sama.
  const current = images[format];
  const inFlight = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open || current) return;
    const key = `${payloadKey}:${format}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    void generate(format).finally(() => inFlight.current.delete(key));
  }, [open, format, current, generate, payloadKey]);

  const retry = () => {
    haptic(6);
    setImages((prev) => {
      const next = { ...prev };
      delete next[format];
      return next;
    });
  };

  // Batalkan request yang masih jalan saat sheet ditutup.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const ready = current?.status === "ready" ? current : null;
  const canShareFile = ready ? canShareImageFile(ready.file) : false;

  const onShareImage = async () => {
    if (!ready) return;
    haptic(12);
    if (canShareFile) {
      const outcome = await shareImageFile(ready.file);
      if (outcome === "failed") onToast(t("result.shareFailed"));
      return;
    }
    downloadImageFile(ready.file);
    onToast(t("shareSheet.saved"));
  };

  const onShareText = async () => {
    haptic(8);
    const outcome = await shareResultText(resultText);
    if (outcome === "copied") onToast(t("result.copied"));
    else if (outcome === "failed") onToast(t("result.shareFailed"));
  };

  const aspect = format === "story" ? "aspect-[9/16]" : "aspect-square";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("shareSheet.title")}</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          {t("shareSheet.desc")}
        </SheetDescription>

        {/* Pilih ukuran */}
        <div className="mt-4 flex gap-1 rounded-xl bg-secondary p-1" role="group">
          {(["story", "square"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => {
                haptic(6);
                setFormat(f);
              }}
              className={cn(
                "min-h-[40px] flex-1 select-none rounded-lg text-sm font-medium transition-all active:scale-[0.98]",
                format === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t(f === "story" ? "shareSheet.story" : "shareSheet.square")}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 flex justify-center">
          <div
            className={cn(
              "relative flex max-h-[48vh] items-center justify-center overflow-hidden rounded-xl border border-border bg-[#0B1220]",
              aspect,
              format === "story" ? "h-[48vh]" : "w-full max-w-[48vh]",
            )}
          >
            {ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ready.url}
                alt={t("shareSheet.previewAlt", { name: sessionName })}
                className="h-full w-full object-contain"
              />
            ) : current?.status === "error" ? (
              <div className="flex flex-col items-center gap-3 px-6 text-center text-sm text-slate-300">
                <ImageIcon size={28} aria-hidden />
                <p>{t("shareSheet.error")}</p>
                <Button size="sm" variant="outline" onClick={retry}>
                  <RotateCcw size={16} /> {t("shareSheet.retry")}
                </Button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 text-sm text-slate-300"
                role="status"
              >
                <Loader2 size={24} className="animate-spin" aria-hidden />
                {t("shareSheet.generating")}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onShareImage} disabled={!ready}>
            {canShareFile || !ready ? <Share2 size={18} /> : <Download size={18} />}
            {canShareFile || !ready ? t("shareSheet.shareImage") : t("shareSheet.saveImage")}
          </Button>
          <Button size="lg" variant="outline" onClick={onShareText}>
            <MessageSquareText size={18} /> {t("shareSheet.shareText")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
