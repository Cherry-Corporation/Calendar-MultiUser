const CACHE_NAME = "calendar-cache-v1";
const urlsToCache = [
    "/",
    "/calendar",
    "/login",
    "/signup",
    "/static/manifest.json",
    "/static/indexeddb.js",
    "/static/calendar.js",
    "/static/calendar.css",
    "/static/calendar.html", 
    "/static/service-worker.js",
    "/static/icons/icon-192x192.png",
    "/static/icons/icon-512x512.png",
    "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.0/main.min.css",
    "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.0/main.min.js",
    "https://code.jquery.com/jquery-3.6.0.min.js"
];

// Cache resources for offline use
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
    );
});

// Fetch handler - serves cached assets if offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});

// Sync stored events when online
self.addEventListener("sync", (event) => {
    if (event.tag === "sync-events") {
        event.waitUntil(syncStoredEvents());
    }
});

async function syncStoredEvents() {
    const events = await getStoredEvents(); // Fetches locally stored events

    for (const event of events) {
        try {
            await fetch("/save_event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(event),
            });
            await removeStoredEvent(event.id); // Remove from local after successful sync
        } catch (err) {
            console.error("Sync failed for event:", event, err);
        }
    }
}


self.addEventListener("activate", (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});