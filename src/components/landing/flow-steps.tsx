"use client";

import type { LucideIcon } from "lucide-react";
import { useT } from "@/lib/store/settings-store";
import type { DictKey } from "@/lib/i18n/dict";

export interface FlowStep {
  icon: LucideIcon;
  titleKey: DictKey;
  bodyKey: DictKey;
}

/**
 * Cara Kerja sebagai TIMELINE ber-connector — karena kontennya memang sebuah
 * urutan (1→5), numbering & garis alur sah dipakai (bukan kartu generik).
 * Mobile: vertikal dengan garis kiri. Desktop: horizontal dengan garis atas.
 */
export function FlowSteps({ steps }: { steps: FlowStep[] }) {
  const t = useT();
  return (
    <ol className="relative mx-auto max-w-5xl">
      {/* ── Mobile: garis vertikal ── */}
      <div
        aria-hidden
        className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/60 via-accent/40 to-transparent md:hidden"
      />

      <div className="grid gap-8 md:grid-cols-5 md:gap-4">
        {/* ── Desktop: garis horizontal di belakang node ── */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-primary/50 via-accent/40 to-primary/20 md:block"
        />

        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.titleKey}
              className="relative flex gap-4 md:flex-col md:gap-3"
            >
              {/* Node: nomor + ikon */}
              <div className="relative z-10 flex shrink-0 flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                  <Icon size={22} className="text-primary" />
                </div>
                <span className="mt-2 hidden font-display text-xs font-semibold tracking-wide text-muted-foreground md:block">
                  Langkah {i + 1}
                </span>
              </div>

              <div className="pt-1 md:pt-2 md:text-center">
                <div className="flex items-center gap-2 md:justify-center">
                  <span className="font-display text-sm font-bold text-primary md:hidden">
                    {i + 1}.
                  </span>
                  <h3 className="font-display font-semibold leading-tight text-foreground">
                    {t(step.titleKey)}
                  </h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(step.bodyKey)}
                </p>
              </div>
            </li>
          );
        })}
      </div>
    </ol>
  );
}
