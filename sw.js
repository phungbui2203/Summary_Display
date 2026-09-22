/* Summary_Display service worker — cache shell + assets, skip large docs */
const CACHE = "display-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./allocation-data.js",
  "./assets/thaicorp-logo.png",
  "./assets/standards/snack-frame.jpg",
  "./assets/standards/snack-standee.jpg",
  "./assets/standards/snack-hanger.jpg",
  "./assets/standards/snack-guide-standee-hanger.jpg",
  "./assets/standards/snack-guide-frame-biteez.jpg",
  "./assets/standards/mien-frame.jpg",
  "./assets/standards/mien-standee.jpg",
  "./assets/thong-bao-trung-bay-p1.jpg"
];

const SKIP_EXT = /\.(pptx|ppt|pdf|xlsx|xls|doc|docx)(\?|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP_EXT.test(url.pathname)) return;

  const isAsset = url.pathname.includes("/assets/");
  const isNav = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");

  if (isAsset) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (isNav || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
