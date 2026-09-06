"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useT } from "@/lib/store/settings-store";
import type { DictKey } from "@/lib/i18n/dict";

export interface FaqItem {
  q: DictKey;
  a: DictKey;
}

/**
 * FAQ accordion. Motion hanya saat user membuka/menutup (answers user action —
 * sesuai FE-SKILL). Ikon plus berputar jadi "x" saat terbuka. Aksesibel:
 * tombol dengan aria-expanded.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/5 active:bg-accent/10"
            >
              <span className="font-display font-semibold leading-snug text-foreground">
                {t(item.q)}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <Plus size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {t(item.a)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
