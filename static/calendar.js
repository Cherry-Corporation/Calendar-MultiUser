document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    let selectedColor = '#ffffff'; // Default event title color

    // Initialize the calendar
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
        editable: true,
        events: fetchCalendarEvents,
        eventContent: customizeEventContent,
        eventDrop: handleEventDrop,
    });

    calendar.render();

    // Event modal setup
    const modal = document.getElementById('eventModal');
    const addEventBtn = document.getElementById('add-event-button');
    const closeModalBtn = document.querySelector('.close');
    const saveEventBtn = document.getElementById('save-event');
    const colorPalette = document.getElementById('color-palette');
    const eventTitleInput = document.getElementById('event-title');
    const eventDescriptionInput = document.getElementById('event-description');

    // Event modal handlers
    addEventBtn.onclick = showAddEventModal;
    closeModalBtn.onclick = hideModal;
    window.onclick = closeModalOnClickOutside;

    // Color picker functionality
    colorPalette.addEventListener('click', selectColor);

    // Save event from modal
    saveEventBtn.onclick = saveNewEvent;

    // Reset modal state
    function resetModal() {
        eventTitleInput.value = '';
        eventDescriptionInput.value = '';
        selectedColor = '#ffffff';
        document.querySelectorAll('.color-option').forEach(option => option.classList.remove('selected'));
    }

    // Show modal for adding events
    function showAddEventModal() {
        resetModal();
        modal.style.display = 'flex';
    }

    // Hide modal
    function hideModal() {
        modal.style.display = 'none';
    }

    // Close modal if clicking outside
    function closeModalOnClickOutside(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }

    // Handle color selection
    function selectColor(event) {
        if (event.target.classList.contains('color-option')) {
            selectedColor = event.target.getAttribute('data-color');
            document.querySelectorAll('.color-option').forEach(option => option.classList.remove('selected'));
            event.target.classList.add('selected');
        }
    }

    // Save new event from modal
    function saveNewEvent() {
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

        saveEventToServer(calendarEvent);
        modal.style.display = 'none';
        resetModal();
    }

    // Open modal for editing events
    function openEditModal(event) {
        modal.style.display = 'flex';
        eventTitleInput.value = event.title;
        eventDescriptionInput.value = event.extendedProps.description;
        selectedColor = event.extendedProps.titleColor || '#ffffff';

        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('selected', option.getAttribute('data-color') === selectedColor);
        });

        saveEventBtn.onclick = function () {
            event.setProp('title', eventTitleInput.value.trim());
            event.setExtendedProp('description', eventDescriptionInput.value.trim());
            event.setExtendedProp('titleColor', selectedColor);

            saveEventToServer(event);
            modal.style.display = 'none';
        };
    }

    // Fetch events from the server
    async function fetchCalendarEvents(fetchInfo, successCallback, failureCallback) {
        try {
            const response = await fetch('/get_events');
            const events = await response.json();

            events.forEach(event => {
                if (!event.end) {
                    event.end = event.start;
                }
            });

            successCallback(events);
        } catch (error) {
            console.error('Error fetching events:', error);
            failureCallback(error);
        }
    }

    // Customize event content
    function customizeEventContent(arg) {
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
                deleteEventFromServer(arg.event.id);
            }
        };

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');
        buttonContainer.append(editIcon, deleteIcon);

        const contentEl = document.createElement('div');
        contentEl.append(title, buttonContainer);

        return { domNodes: [contentEl] };
    }

    // Handle event drop
    function handleEventDrop(info) {
        const event = info.event;

        saveEventToServer({
            id: event.id,
            title: event.title,
            description: event.extendedProps.description || '',
            titleColor: event.extendedProps.titleColor || selectedColor,
            start: event.start.toISOString(),
            end: event.end ? event.end.toISOString() : event.start.toISOString(),
        });
    }

    // Save event to the server
    async function saveEventToServer(eventDetails) {
        try {
            const response = await fetch('/save_event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventDetails),
            });

            const data = await response.json();

            if (data.success && !eventDetails.id && data.id) {
                eventDetails.id = data.id;
            }
        } catch (error) {
            console.error('Error saving event:', error);
        }
    }

    // Delete event from the server
    async function deleteEventFromServer(eventId) {
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
