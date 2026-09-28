// Service worker minimal untuk TangkasBoard (installable PWA + cache app shell).
// Naikkan versi CACHE bila APP_SHELL / strategi berubah: cache lama dihapus
// otomatis di event activate.
const CACHE = "tangkasboard-v2";
const APP_SHELL = ["/", "/app", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Jangan cache API/Supabase/route API app — biarkan network yang handle.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Hanya simpan respons sukses agar halaman error tidak ikut ter-cache.
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Offline & belum ter-cache: navigasi di dalam app jatuh ke shell
        // /app (bukan landing), selain itu ke landing.
        if (request.mode === "navigate") {
          const fallback = url.pathname.startsWith("/app") ? "/app" : "/";
          return (await caches.match(fallback)) ?? Response.error();
        }
        return Response.error();
      }),
  );
});
