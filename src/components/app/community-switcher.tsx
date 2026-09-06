"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/store/settings-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Community switcher — dipasang di header AppShell.
 *
 * Muncul HANYA bila user tergabung di lebih dari satu community
 * (`memberships.length > 1`); selain itu me-render `null` sehingga tidak
 * mengganggu layout untuk user single-community.
 *
 * Menampilkan community aktif (dicari dari `activeCommunityId` di daftar
 * memberships) dan memungkinkan memilih community lain. Memilih memanggil
 * `setActiveCommunity(id)` yang mengubah `activeCommunityId`; perubahan ini
 * otomatis memicu reload data karena hook & store data membaca
 * `activeCommunityId` (di-wire pada Task 9). *Req 8.2, 8.3, 8.5.*
 *
 * Aksesibilitas: dibuat sebagai menu sederhana (tanpa dependensi dropdown
 * eksternal) — tombol pemicu ber-`aria-haspopup`/`aria-expanded`, daftar
 * pilihan memakai `role="menu"` + `role="menuitemradio"` dengan `aria-checked`
 * pada community aktif. Menutup saat klik di luar atau tekan Escape.
 */
/**
 * @param className - kelas tambahan untuk tombol pemicu. Berguna saat switcher
 *   ditempatkan di baris tersendiri (mis. header daftar mabar) agar bisa
 *   full-width. Bila kosong, gaya default (max-w-[9rem]) tetap dipakai.
 */
export function CommunitySwitcher({ className }: { className?: string }) {
  const t = useT();
  const memberships = useAuthStore((s) => s.memberships);
  const activeCommunityId = useAuthStore((s) => s.activeCommunityId);
  const setActiveCommunity = useAuthStore((s) => s.setActiveCommunity);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Hanya relevan bila user punya >1 community.
  if (memberships.length <= 1) return null;

  const active =
    memberships.find((m) => m.communityId === activeCommunityId) ??
    memberships[0];

  const select = (id: string) => {
    haptic(8);
    if (id !== activeCommunityId) setActiveCommunity(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", !className && "shrink-0")}>
      <button
        type="button"
        onClick={() => {
          haptic(8);
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("community.switch")}
        title={t("community.switch")}
        className={cn(
          "flex max-w-[9rem] items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm font-medium active:scale-95 active:bg-secondary",
          className,
        )}
      >
        <Building2 size={15} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{active.communityName}</span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("community.switch")}
          className="absolute right-0 z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t("community.active")}
          </div>
          {memberships.map((m) => {
            const selected = m.communityId === active.communityId;
            return (
              <button
                key={m.communityId}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => select(m.communityId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm active:scale-[0.98] active:bg-secondary",
                  selected && "bg-secondary",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {m.communityName}
                </span>
                {selected && (
                  <Check size={15} className="shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
