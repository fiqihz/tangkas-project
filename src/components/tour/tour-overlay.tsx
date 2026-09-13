"use client";

// ============================================================================
// TourOverlay — spotlight / coach-marks (Opsi A).
//
// Menyorot satu elemen UI asli (dicari lewat [data-tour="..."]) dengan overlay
// gelap ber-"lubang", plus tooltip berisi judul + arahan singkat dan tombol
// Kembali / Lanjut / Lewati.
//
// Ketahanan (opsi A memang lebih rapuh — ditangani eksplisit):
//   - Anchor bisa belum ke-render (tab lain / data belum load): kita polling
//     rect sampai muncul; bila tak muncul dalam TIMEOUT, langkah di-skip
//     otomatis agar tur tetap mengalir.
//   - Reposisi saat scroll / resize / orientasi berubah.
//   - Scroll anchor ke tengah viewport sebelum mengukur.
//   - Hormati prefers-reduced-motion (matikan animasi spotlight).
//   - Mobile-first: tooltip selalu di-clamp agar tidak keluar viewport.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTourStore } from "@/lib/store/tour-store";
import { TOUR_STEPS } from "@/lib/tour/steps";
import { useT } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";

/** Padding di sekeliling elemen yang disorot (px). */
const SPOTLIGHT_PAD = 8;
/** Jarak tooltip dari elemen (px). */
const TOOLTIP_GAP = 12;
/** Lebar maksimum tooltip (px) — cukup untuk layar sempit. */
const TOOLTIP_MAX_W = 320;
/** Berapa lama menunggu anchor muncul sebelum langkah di-skip (ms). */
const ANCHOR_TIMEOUT = 1600;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourOverlay() {
  const active = useTourStore((s) => s.active);
  const index = useTourStore((s) => s.index);
  const next = useTourStore((s) => s.next);
  const prev = useTourStore((s) => s.prev);
  const skip = useTourStore((s) => s.skip);
  const t = useT();
  const reduceMotion = useReducedMotion();

  const step = TOUR_STEPS[index];
  const [rect, setRect] = useState<Rect | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Cari + ukur anchor langkah aktif. Polling ringan lewat rAF sampai elemen
  // muncul; kalau lewat ANCHOR_TIMEOUT belum ada, lompat ke langkah berikutnya.
  const locate = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    if (el) {
      // Pastikan terlihat sebelum diukur (elemen bisa di luar viewport).
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
      setRect(measure(el));
      return true;
    }
    return false;
  }, [step, reduceMotion]);

  useEffect(() => {
    if (!active || !step) return;

    let cancelled = false;
    const startedAt = Date.now();
    // Reset rect langkah sebelumnya secara asinkron (bukan di body efek) agar
    // tidak memicu cascading render — spotlight lama hilang saat frame pertama.
    let firstTick = true;

    const tick = () => {
      if (cancelled) return;
      if (firstTick) {
        firstTick = false;
        setRect(null);
      }
      const found = locate();
      if (found) {
        // Re-ukur sekali lagi setelah smooth-scroll settle.
        rafRef.current = window.requestAnimationFrame(() => {
          const el = document.querySelector(`[data-tour="${step.anchor}"]`);
          if (el && !cancelled) setRect(measure(el));
        });
        return;
      }
      if (Date.now() - startedAt > ANCHOR_TIMEOUT) {
        // Anchor tak muncul (mis. tab Courts tanpa lapangan) → skip langkah.
        next();
        return;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    // Beri jeda kecil agar transisi tab (ScreenTransition) sempat mulai.
    timeoutRef.current = setTimeout(tick, 120);

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, step, index, locate, next]);

  // Reposisi saat scroll / resize (tanpa re-scroll ke tengah lagi).
  useEffect(() => {
    if (!active || !step) return;
    const reposition = () => {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (el) setRect(measure(el));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [active, step]);

  if (!active || !step || typeof document === "undefined") return null;

  const total = TOUR_STEPS.length;
  const isLast = index === total - 1;
  const isFirst = index === 0;

  const handleNext = () => {
    haptic(8);
    next();
  };
  const handlePrev = () => {
    haptic(6);
    prev();
  };
  const handleSkip = () => {
    haptic(6);
    skip();
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 640;

  // Kotak spotlight (elemen + padding), di-clamp ke viewport.
  const spot = rect
    ? {
        top: Math.max(0, rect.top - SPOTLIGHT_PAD),
        left: Math.max(0, rect.left - SPOTLIGHT_PAD),
        width: Math.min(vw, rect.width + SPOTLIGHT_PAD * 2),
        height: Math.min(vh, rect.height + SPOTLIGHT_PAD * 2),
      }
    : null;

  // Tentukan sisi tooltip: hormati preferensi, jatuh ke sisi dengan ruang lebih.
  let placeBelow = true;
  if (spot) {
    const spaceBelow = vh - (spot.top + spot.height);
    const spaceAbove = spot.top;
    if (step.placement === "top") placeBelow = false;
    else if (step.placement === "bottom") placeBelow = true;
    else placeBelow = spaceBelow >= spaceAbove;
  }

  // Posisi tooltip (di-clamp agar tidak keluar tepi).
  const tooltipWidth = Math.min(TOOLTIP_MAX_W, vw - 24);
  let tooltipLeft = spot ? spot.left + spot.width / 2 - tooltipWidth / 2 : 12;
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, vw - tooltipWidth - 12));
  const tooltipTop = spot
    ? placeBelow
      ? spot.top + spot.height + TOOLTIP_GAP
      : undefined
    : vh / 2;
  const tooltipBottom =
    spot && !placeBelow ? vh - (spot.top - TOOLTIP_GAP) : undefined;

  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.section")}
    >
      {/* Lapisan gelap dengan "lubang" spotlight lewat SVG mask. Klik area
          gelap = lewati (kebiasaan umum coach-marks). */}
      <svg
        className="absolute inset-0 h-full w-full"
        onClick={handleSkip}
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spot && (
              <motion.rect
                initial={false}
                animate={{
                  x: spot.left,
                  y: spot.top,
                  width: spot.width,
                  height: spot.height,
                }}
                transition={transition}
                rx={14}
                ry={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Cincin highlight tipis mengelilingi elemen (petunjuk visual). */}
      {spot && (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary ring-offset-0"
          initial={false}
          animate={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
          transition={transition}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={reduceMotion ? false : { opacity: 0, y: placeBelow ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          className="absolute rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/20"
          style={{
            width: tooltipWidth,
            left: tooltipLeft,
            top: tooltipTop,
            bottom: tooltipBottom,
          }}
        >
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {t("tour.stepOf", { current: index + 1, total })}
          </div>
          <h3 className="font-display text-base font-bold tracking-tight">
            {t(step.titleKey)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(step.bodyKey)}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={handleSkip}
              className="min-h-[40px] rounded-lg px-2 text-sm font-medium text-muted-foreground active:opacity-70"
            >
              {t("tour.skip")}
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="min-h-[40px] rounded-lg border border-border px-3 text-sm font-medium active:scale-95 active:bg-secondary"
                >
                  {t("tour.back")}
                </button>
              )}
              <button
                onClick={handleNext}
                className="min-h-[40px] rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95"
              >
                {isLast ? t("tour.done") : t("tour.next")}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
