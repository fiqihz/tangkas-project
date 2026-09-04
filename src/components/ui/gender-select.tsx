"use client";

import type { Gender } from "@/lib/domain/types";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Gender; symbol: string }[] = [
  { value: "male", symbol: "♂" },
  { value: "female", symbol: "♀" },
];

/** Pemilih gender ringkas (pill). Null = belum di-set. */
export function GenderSelect({
  value,
  onChange,
  size = "default",
}: {
  value: Gender | null;
  onChange: (g: Gender) => void;
  size?: "default" | "sm";
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "select-none rounded-lg border font-medium transition-all active:scale-95",
            size === "sm"
              ? "min-h-[38px] px-3 text-xs"
              : "min-h-[44px] px-3.5 text-sm",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-secondary-foreground active:bg-secondary/60",
          )}
        >
          {o.symbol} {t(o.value === "male" ? "gender.male" : "gender.female")}
        </button>
      ))}
    </div>
  );
}

/** Badge gender kecil untuk tampilan pemain. */
export function GenderBadge({ gender }: { gender: Gender | null }) {
  const t = useT();
  if (!gender) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1 text-xs font-medium",
        gender === "female"
          ? "bg-pink-500/15 text-pink-600 dark:text-pink-400"
          : "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      )}
      title={gender === "female" ? t("gender.female") : t("gender.male")}
    >
      {gender === "female" ? "♀" : "♂"}
    </span>
  );
}
