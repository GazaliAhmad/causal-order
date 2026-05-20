const CACHE_VERSION = "causal-order-pwa-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline/";
const APP_SHELL_URLS = [
  "/",
  "/guides/",
  "/wiki/",
  "/api/",
  "/privacy/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/apple-touch-icon-180.png",
  "/favicon.svg",
  "/pwa-icon-512.png",
  "/pwa-maskable-512.png",
  "/pwa-icon.svg",
  "/pwa-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) {
    return;
  }

  event.waitUntil(cacheUrls(data.urls, RUNTIME_CACHE));
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response);
    return response;
  } catch (error) {
    const cachedPage = await caches.match(request);
    if (cachedPage) {
      return cachedPage;
    }

    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }

    throw error;
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      await putInCache(RUNTIME_CACHE, request, response);
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function putInCache(cacheName, request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function cacheUrls(urls, cacheName) {
  const cache = await caches.open(cacheName);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response || response.status !== 200 || response.type !== "basic") {
          return;
        }

        await cache.put(url, response.clone());
      } catch {
        // Ignore per-asset failures so one missing fetch does not block the rest.
      }
    }),
  );
}
