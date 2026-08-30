"use client";

import { useEffect } from "react";

/** Daftarkan service worker untuk fitur PWA (install ke home screen). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // abaikan error registrasi di dev
      });
    }
  }, []);

  return null;
}
