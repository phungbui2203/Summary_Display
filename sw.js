/* Summary_Display service worker — cache shell + assets, skip large docs */
const CACHE = "display-v4-nocache-plan";
/* Data JS must NOT be precached — rebuilds would stay invisible under SWR. */
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
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
const NETWORK_FIRST_JS = /\/(plan-vs-actual-data|allocation-data)\.js$/i;

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
      Promise.all(keys.map((k) => caches.delete(k)))
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

  /* Always prefer fresh plan/allocation data after rebuild. */
  if (NETWORK_FIRST_JS.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isAsset) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (isNav || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

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
