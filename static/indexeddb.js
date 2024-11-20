// static/indexeddb.js
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("CalendarDB", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
        };
    });
}

async function storeEventLocally(event) {
    const db = await openDB();
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").add(event);
    return tx.complete;
}

async function getStoredEvents() {
    const db = await openDB();
    const tx = db.transaction("events", "readonly");
    return tx.objectStore("events").getAll();
}

async function removeStoredEvent(id) {
    const db = await openDB();
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").delete(id);
    return tx.complete;
}
