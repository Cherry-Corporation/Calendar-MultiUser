document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    let selectedColor = '#ffffff'; // Default title color

    // Load resources only when online
    function loadResources() {
        if (navigator.onLine) {
            // Load CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/static/calendar.css';
            document.head.appendChild(link);

            // Load manifest
            fetch('/static/manifest.json')
                .then(response => {
                    if (!response.ok) throw new Error('Manifest not found');
                    return response.json();
                })
                .catch(error => console.error('Manifest loading error:', error));
        } else {
            console.log("Offline mode activated.");
        }
    }
    loadResources();

    // Initialize FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridTwoWeek',
        headerToolbar: { 
            left: 'prev,next', 
            center: 'title', 
            right: 'dayGridTwoWeek,dayGridOneWeek' 
        },
        views: {
            dayGridTwoWeek: {
                type: 'dayGrid',
                duration: { days: 14 },
                buttonText: '2-Week View'
            },
            dayGridOneWeek: {
                type: 'dayGrid',
                duration: { days: 7 },
                buttonText: '1-Week View'
            }
        },
        editable: true,
        events: function(fetchInfo, successCallback, failureCallback) {
            fetch('/get_events')
                .then(response => response.json())
                .then(events => {
                    if (Array.isArray(events)) {
                        events.forEach(event => {
                            event.start = new Date(event.start).toISOString();
                            if (event.end) {
                                event.end = new Date(event.end).toISOString();
                            }
                        });
                        successCallback(events);
                    } else {
                        console.error('Invalid events data:', events);
                        failureCallback(new Error('Invalid events data'));
                    }
                })
                .catch(error => {
                    console.error('Error fetching events:', error);
                    failureCallback(error);
                });
        },
        eventDrop: function(info) {
            saveEvent(info.event);
        },
        eventChange: function(info) {
            saveEvent(info.event);
        },
        eventContent: function(arg) {
            let title = document.createElement("div");
            title.classList.add("event-content");
            title.innerText = arg.event.title;
            title.style.color = arg.event.extendedProps.titleColor || selectedColor;
            title.style.fontWeight = "bold";

            let editIcon = document.createElement("span");
            editIcon.classList.add("edit-icon");
            editIcon.innerHTML = "✏️";
            editIcon.onclick = function() { openEditModal(arg.event); };

            let deleteIcon = document.createElement("span");
            deleteIcon.classList.add("delete-icon");
            deleteIcon.innerHTML = "🗑️";
            deleteIcon.onclick = function() {
                if (confirm("Are you sure you want to delete this event?")) {
                    arg.event.remove();
                    deleteEvent(arg.event.id);
                }
            };

            let buttonContainer = document.createElement("div");
            buttonContainer.classList.add("button-container");
            buttonContainer.appendChild(editIcon);
            buttonContainer.appendChild(deleteIcon);

            let contentEl = document.createElement("div");
            contentEl.appendChild(title);
            contentEl.appendChild(buttonContainer);

            return { domNodes: [contentEl] };
        }
    });
    calendar.render();

    // IndexedDB Helper Functions
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
        tx.objectStore("events").put(event);
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

    // Save event with offline support
    async function saveEvent(event) {
        const eventDetails = {
            id: event.id ? parseInt(event.id) : null,
            title: event.title,
            description: event.extendedProps.description || "",
            titleColor: event.extendedProps.titleColor || selectedColor,
            start: event.start.toISOString(),
            end: event.end ? event.end.toISOString() : event.start.toISOString()
        };

        if (navigator.onLine) {
            try {
                const response = await fetch('/save_event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eventDetails)
                });
                const data = await response.json();
                if (data.success) {
                    if (!event.id && data.id) {
                        event.setProp('id', data.id);
                    }
                }
            } catch (error) {
                console.error('Error saving event:', error);
                await storeEventLocally(eventDetails);
            }
        } else {
            await storeEventLocally(eventDetails);
            console.log("Event saved locally for offline sync.");
        }
    }

    // Delete event with offline support
    async function deleteEvent(eventId) {
        const eventIdInt = parseInt(eventId, 10);

        if (navigator.onLine) {
            try {
                const response = await fetch('/delete_event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: eventIdInt })
                });
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error);
                }
            } catch (error) {
                console.error('Error deleting event:', error);
                await storeEventLocally({ id: eventIdInt, delete: true });
            }
        } else {
            await storeEventLocally({ id: eventIdInt, delete: true });
            console.log("Delete action queued for offline sync.");
        }
    }

    // Sync events on reconnection
    async function syncEvents() {
        const events = await getStoredEvents();
        if (!Array.isArray(events)) {
            console.error('Stored events data is not an iterable array:', events);
            return;
        }
        for (const event of events) {
            try {
                if (event.delete) {
                    await deleteEvent(event.id);
                } else {
                    await saveEvent(event);
                }
                await removeStoredEvent(event.id);
            } catch (error) {
                console.error('Error syncing event:', error);
            }
        }
    }

    // Detect network status changes
    window.addEventListener("online", async () => {
        console.log("Online - Syncing events...");
        try {
            await syncEvents();
            console.log("Events synchronized successfully.");
        } catch (error) {
            console.error("Error during online sync:", error);
        }
    });

    window.addEventListener("offline", () => {
        console.log("Offline mode activated.");
    });

    // Modal and event handling code
    const modal = document.getElementById("eventModal");
    const btn = document.getElementById("add-event-button");
    const span = document.getElementsByClassName("close")[0];

    btn.onclick = function() { modal.style.display = "flex"; }
    span.onclick = function() { modal.style.display = "none"; }
    window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

    document.getElementById("save-event").onclick = function() {
        let title = document.getElementById("event-title").value;
        let description = document.getElementById("event-description").value;

        if (title) {
            let newEvent = {
                title: title,
                description: description,
                start: calendar.getDate().toISOString(),
                end: calendar.getDate().toISOString(),
                titleColor: selectedColor
            };

            let calendarEvent = calendar.addEvent({
                title: newEvent.title,
                start: newEvent.start,
                end: newEvent.end,
                extendedProps: { description: newEvent.description, titleColor: newEvent.titleColor }
            });

            saveEvent(calendarEvent);
            modal.style.display = "none";
            document.getElementById("event-title").value = "";
            document.getElementById("event-description").value = "";
        }
    };

    function openEditModal(event) {
        modal.style.display = "flex";
        document.getElementById("event-title").value = event.title;
        document.getElementById("event-description").value = event.extendedProps.description;
        selectedColor = event.extendedProps.titleColor || "#ffffff";

        document.getElementById("save-event").onclick = function() {
            event.setProp("title", document.getElementById("event-title").value);
            event.setExtendedProp("description", document.getElementById("event-description").value);
            event.setExtendedProp("titleColor", selectedColor);
            saveEvent(event);
            modal.style.display = "none";
        };
    }
});
