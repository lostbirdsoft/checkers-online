// Сервис-воркер для быстрого запуска (в APK и обычном браузере; в Telegram он не включается).
// Файлы игры открываются сразу из кэша, а свежая версия подтягивается в фоне: обновление кода приходит со следующего запуска.
// Сбросить кэш у всех: увеличь VERSION. Выключить совсем: PWA_OFFLINE_CACHE = false в app.js (воркер снимется и кэш очистится).
const VERSION = 9;
const CACHE = "checkers-v" + VERSION;
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.json", "icons/icon-192.png", "icons/icon-512.png",
  "sounds/select.mp3", "sounds/move.mp3", "sounds/capture.mp3", "sounds/win.mp3", "sounds/lose.mp3"];

// Ключ кэша без «?t=…» и «?v=…»: у игры адреса меняются каждую минуту, а файл один и тот же.
const keyOf = (u) => { const x = new URL(u, self.registration.scope); x.search = ""; x.hash = ""; return x.href; };

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) =>
    Promise.all(FILES.map((f) => fetch(new URL(f, self.registration.scope).href, { cache: "reload" })
      .then((res) => { if (res.ok) return cache.put(keyOf(f), res); }).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("checkers-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // сервер игры, Telegram, реклама и т.д. не трогаем
  const key = keyOf(req.url);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    const fresh = fetch(req.url, { cache: "no-cache" })
      .then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; } // сразу из кэша, обновление в фоне
    return (await fresh) || Response.error();
  })());
});
