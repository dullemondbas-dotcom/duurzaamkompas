/* DuurzaamKompas Energie Challenge PWA shell.
   Only the app shell is cached; public website and future private API data are not cached. */
const CACHE_NAME = "dk-energie-challenge-shell-v7";
const APP_FILES = [
  "./energie-challenge.html",
  "./energie-challenge.css",
  "./energie-challenge.js",
  "./supabase-config.js",
  "./supabase-auth.js",
  "./energie-challenge.webmanifest",
  "./assets/energie-challenge-icon.svg",
  "./assets/energie-challenge-icon-180.png",
  "./favicon.svg"
];
const APP_PATHS = new Set(APP_FILES.map(path => new URL(path, self.registration.scope).pathname));
const APP_ENTRY = new URL("./energie-challenge.html", self.registration.scope).pathname;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("dk-energie-challenge-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname === APP_ENTRY) {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put("./energie-challenge.html", copy));
      return response;
    }).catch(() => caches.match("./energie-challenge.html")));
    return;
  }
  if (!APP_PATHS.has(url.pathname)) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
