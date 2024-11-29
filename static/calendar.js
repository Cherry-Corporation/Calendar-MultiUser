document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    let selectedColor = '#ffffff'; // Default title color

    // Initialize FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridTwoWeek',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'dayGridTwoWeek,dayGridOneWeek',
        },
        views: {
            dayGridTwoWeek: {
                type: 'dayGrid',
                duration: { days: 14 },
                buttonText: '2-Week View',
            },
            dayGridOneWeek: {
                type: 'dayGrid',
                duration: { days: 7 },
                buttonText: '1-Week View',
            },
        },
        editable: true, // Allow events to be draggable
        events: async function (fetchInfo, successCallback, failureCallback) {
            try {
                const response = await fetch('/get_events');
                const events = await response.json();

                // Ensure every event has a valid 'end' time
                events.forEach(event => {
                    if (!event.end) {
                        // If no 'end' date is set, set it to the same date as the start date
                        event.end = event.start;
                    }
                });

                successCallback(events);
            } catch (error) {
                console.error('Error fetching events:', error);
                failureCallback(error);
            }
        },
        eventContent: function (arg) {
            const title = document.createElement('div');
            title.classList.add('event-content');
            title.innerText = arg.event.title;
            title.style.color = arg.event.extendedProps.titleColor || '#ffffff';
            title.style.fontWeight = 'bold';

            const editIcon = document.createElement('span');
            editIcon.classList.add('edit-icon');
            editIcon.innerHTML = '✏️';
            editIcon.onclick = function () {
                openEditModal(arg.event);
            };

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon');
            deleteIcon.innerHTML = '🗑️';
            deleteIcon.onclick = function () {
                if (confirm('Are you sure you want to delete this event?')) {
                    arg.event.remove();
                    deleteEvent(arg.event.id);
                }
            };

            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('button-container');
            buttonContainer.appendChild(editIcon);
            buttonContainer.appendChild(deleteIcon);

            const contentEl = document.createElement('div');
            contentEl.appendChild(title);
            contentEl.appendChild(buttonContainer);

            return { domNodes: [contentEl] };
        },
        eventDrop: function(info) {
            const event = info.event;
        
            // Log the event to confirm the values
            console.log("Sending updated event:", {
                id: event.id,
                title: event.title,
                start: event.start, // No need to call toISOString(), keep it as a string
                end: event.end,     // No need to call toISOString(), keep it as a string
                titleColor: event.extendedProps.titleColor,
                description: event.extendedProps.description
            });
        
            // Send updated event data to the server
            saveEvent(event.id, event.title, event.extendedProps.description, event.start, event.end, event.extendedProps.titleColor);
        },        
    });
    calendar.render();

    // Event Modal Handling
    const modal = document.getElementById('eventModal');
    const btn = document.getElementById('add-event-button');
    const closeModalBtn = document.querySelector('.close');
    const saveEventBtn = document.getElementById('save-event');
    const colorPalette = document.getElementById('color-palette');
    const eventTitleInput = document.getElementById('event-title');
    const eventDescriptionInput = document.getElementById('event-description');

    btn.onclick = function () {
        resetModal();
        modal.style.display = 'flex';
    };
    closeModalBtn.onclick = function () {
        modal.style.display = 'none';
    };
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    // Color Picker Logic
    colorPalette.addEventListener('click', function (event) {
        if (event.target.classList.contains('color-option')) {
            selectedColor = event.target.getAttribute('data-color');
            document.querySelectorAll('.color-option').forEach(option => {
                option.classList.remove('selected');
            });
            event.target.classList.add('selected');
        }
    });

    saveEventBtn.onclick = function () {
        const title = eventTitleInput.value.trim();
        const description = eventDescriptionInput.value.trim();

        if (!title) {
            alert('Event title is required!');
            return;
        }

        const newEvent = {
            title,
            description,
            start: calendar.getDate().toISOString(),
            end: null,
            titleColor: selectedColor,
        };

        const calendarEvent = calendar.addEvent({
            title: newEvent.title,
            start: newEvent.start,
            end: newEvent.end,
            extendedProps: {
                description: newEvent.description,
                titleColor: newEvent.titleColor,
            },
        });

        saveEvent(calendarEvent);
        modal.style.display = 'none';
        resetModal();
    };

    function resetModal() {
        eventTitleInput.value = '';
        eventDescriptionInput.value = '';
        selectedColor = '#ffffff';
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('selected');
        });
    }

    function openEditModal(event) {
        modal.style.display = 'flex';
        eventTitleInput.value = event.title;
        eventDescriptionInput.value = event.extendedProps.description;
        selectedColor = event.extendedProps.titleColor || '#ffffff';

        document.querySelectorAll('.color-option').forEach(option => {
            if (option.getAttribute('data-color') === selectedColor) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });

        saveEventBtn.onclick = function () {
            event.setProp('title', eventTitleInput.value.trim());
            event.setExtendedProp('description', eventDescriptionInput.value.trim());
            event.setExtendedProp('titleColor', selectedColor);

            saveEvent(event);
            modal.style.display = 'none';
        };
    }

    // Save Event to Server
    async function saveEvent(id, title, description, start, end, titleColor) {
        const eventDetails = {
            id: id || null,
            title: title,
            description: description || '',
            titleColor: titleColor || selectedColor,
            start: start.toISOString(),
            end: end ? end.toISOString() : start.toISOString(),
        };

        try {
            const response = await fetch('/save_event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventDetails),
            });
            const data = await response.json();
            if (data.success && !id && data.id) {
                event.setProp('id', data.id);
            }
        } catch (error) {
            console.error('Error saving event:', error);
        }
    }

    async function deleteEvent(eventId) {
        try {
            const response = await fetch('/delete_event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: eventId }),
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    }
});
