"use client";

import { Moon, Sun, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSettingsStore } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n/dict";

export function SettingsScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const lang = useSettingsStore((s) => s.lang);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLang = useSettingsStore((s) => s.setLang);
  const t = useSettingsStore((s) => s.t);

  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-5">
      {/* Tampilan / Theme */}
      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          {t("settings.appearance")}
        </div>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                {isDark ? <Moon size={18} /> : <Sun size={18} />}
              </span>
              <div className="min-w-0">
                <div className="font-medium">{t("settings.darkMode")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("settings.darkModeDesc")}
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={isDark}
              onChange={(v) => {
                haptic(10);
                setTheme(v ? "dark" : "light");
              }}
              label={t("settings.darkMode")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bahasa / Language */}
      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          {t("settings.language")}
        </div>
        <Card>
          <CardContent className="py-3.5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Languages size={18} />
              </span>
              <div className="min-w-0">
                <div className="font-medium">{t("settings.language")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("settings.languageDesc")}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LangOption
                active={lang === "id"}
                onClick={() => {
                  haptic(8);
                  setLang("id");
                }}
                flag="🇮🇩"
                label={t("settings.langId")}
                code="ID"
              />
              <LangOption
                active={lang === "en"}
                onClick={() => {
                  haptic(8);
                  setLang("en");
                }}
                flag="🇬🇧"
                label={t("settings.langEn")}
                code="EN"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function LangOption({
  active,
  onClick,
  flag,
  label,
  code,
}: {
  active: boolean;
  onClick: () => void;
  flag: string;
  label: string;
  code: Lang | string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex select-none items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-card active:bg-secondary",
      )}
    >
      <span className="text-lg leading-none">{flag}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{code}</span>
      </span>
      {active && <span className="ml-auto text-primary">✓</span>}
    </button>
  );
}
