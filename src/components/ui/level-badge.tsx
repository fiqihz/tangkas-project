"use client";

import { LEVEL_LABEL, type Level } from "@/lib/domain/types";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<Level, string> = {
  newbie: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  beginner: "bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100",
  intermediate:
    "bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50",
  advanced: "bg-rose-200 text-rose-900 dark:bg-rose-700 dark:text-rose-50",
};

export function LevelBadge({
  level,
  className,
}: {
  level: Level | null;
  className?: string;
}) {
  const t = useT();
  if (!level) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        {t("level.notSet")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        LEVEL_STYLE[level],
        className,
      )}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}
