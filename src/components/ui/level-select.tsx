import { LEVEL_LABEL, type Level } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const LEVELS: Level[] = ["newbie", "beginner", "intermediate", "advanced"];

/** Pemilih level ringkas (tombol pill). */
export function LevelSelect({
  value,
  onChange,
  size = "default",
}: {
  value: Level | null;
  onChange: (level: Level) => void;
  size?: "default" | "sm";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEVELS.map((lv) => (
        <button
          key={lv}
          type="button"
          onClick={() => onChange(lv)}
          className={cn(
            "select-none rounded-lg border font-medium transition-all active:scale-95",
            size === "sm" ? "min-h-[38px] px-3 text-xs" : "min-h-[44px] px-3.5 text-sm",
            value === lv
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-secondary-foreground active:bg-secondary/60",
          )}
        >
          {LEVEL_LABEL[lv]}
        </button>
      ))}
    </div>
  );
}
