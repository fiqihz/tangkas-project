"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Toast sederhana yang muncul mengambang di atas bottom-nav, auto-dismiss.
 * Dipakai untuk pesan singkat (mis. auto-fill gagal) agar terlihat walau
 * user sedang scroll di bagian bawah halaman.
 */
export function Toast({
  message,
  onClose,
  duration = 4500,
  variant = "warning",
}: {
  message: string | null;
  onClose: () => void;
  duration?: number;
  variant?: "warning" | "error";
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-40 mx-auto flex max-w-md justify-center px-4"
        >
          <div
            className={
              "flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg " +
              (variant === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-amber-500 text-white")
            }
          >
            <span className="flex-1">{message}</span>
            <button
              onClick={onClose}
              className="shrink-0 active:scale-90"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
