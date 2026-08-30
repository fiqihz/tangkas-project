"use client";

/** Getar ringan untuk feedback tap (diabaikan bila device tidak mendukung). */
export function haptic(pattern: number | number[] = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // abaikan
    }
  }
}
