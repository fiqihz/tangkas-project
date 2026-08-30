"use client";

import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Floating Action Button — tombol aksi utama, mudah dijangkau jempol. */
export function Fab({
  onClick,
  icon,
  label,
  className,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => {
        haptic(15);
        onClick();
      }}
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-30 flex min-h-[56px] items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/30",
        className,
      )}
    >
      {icon}
      {label && <span className="font-semibold">{label}</span>}
    </motion.button>
  );
}
