"use client";

import { useEffect, useState } from "react";

/**
 * Pantau status koneksi jaringan browser (online/offline).
 *
 * Mulai dengan `true` (online) agar tidak flicker "offline" saat render awal /
 * SSR — status sebenarnya dibaca di useEffect (client-side), lalu diperbarui
 * lewat event 'online'/'offline'.
 */
export function useOnlineStatus(): boolean {
  // Lazy init: di browser baca navigator.onLine langsung; di SSR anggap online
  // (true) agar tidak flicker. Tidak perlu setState di effect untuk sinkron awal.
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Jaga-jaga bila status berubah antara render awal & pemasangan listener.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
