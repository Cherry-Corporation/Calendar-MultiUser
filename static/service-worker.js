const CACHE_NAME = "calendar-cache-v1";
const CACHE_URLS = [
    "/",
    "/calendar",
    "/login",
    "/signup",
    "/static/manifest.json",
    "/static/calendar.js",
    "/static/calendar.css",
    "/static/calendar.html",
    "/static/service-worker.js",
    "/static/icons/icon-192x192.png",
    "/static/icons/icon-512x512.png",
    "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.0/main.min.css",
    "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.0/main.min.js",
    "https://code.jquery.com/jquery-3.6.0.min.js",
];

// Install event: Cache resources for offline use
self.addEventListener("install", handleInstall);

function handleInstall(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
    );
}

// Fetch event: Serve cached assets when offline
self.addEventListener("fetch", handleFetch);

function handleFetch(event) {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
}

// Activate event: Clean up old caches
self.addEventListener("activate", handleActivate);

function handleActivate(event) {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
}
