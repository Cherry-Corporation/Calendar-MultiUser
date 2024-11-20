from flask import Flask, request, jsonify, render_template, redirect, url_for, session
import json
import os
import bcrypt

app = Flask(__name__)

# Secret key for session management (used for user login)
app.secret_key = '21db00c0f6773c0f067172887f07b454eca03ff430a8278a996307a72bd51174'

# Path to the 'data' folder where user-specific event .json files will be saved
DATA_FOLDER = 'data'
USERS_FOLDER = 'users'
USERS_FILE = os.path.join(USERS_FOLDER, 'users.json')

# Compact debug message function for high-level actions only
def debug_message(level, message):
    levels = {
        "INFO": "\033[1;37;40m[INFO]\033[0m ",
        "ERROR": "\033[1;31;40m[ERROR]\033[0m "
    }
    print(f"{levels.get(level, '[LOG]')} {message}")

# Ensure the 'data' and 'users' folders exist
if not os.path.exists(DATA_FOLDER):
    os.makedirs(DATA_FOLDER)
if not os.path.exists(USERS_FOLDER):
    os.makedirs(USERS_FOLDER)

# Load users from the 'users.json' file
def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

# Save users to the 'users.json' file
def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=4)

# Load events from a specific user's JSON file
def load_events(username):
    user_file = os.path.join(DATA_FOLDER, f"{username}.json")
    if os.path.exists(user_file):
        with open(user_file, "r") as f:
            return json.load(f)
    return []

# Save events to a specific user's JSON file
def save_events(username, events):
    user_file = os.path.join(DATA_FOLDER, f"{username}.json")
    with open(user_file, "w") as f:
        json.dump(events, f, indent=4)

# Route for user registration
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            return render_template('signup.html', error="Passwords do not match.")

        users = load_users()
        if username in users:
            return render_template('signup.html', error="Username already exists.")

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        users[username] = {"username": username, "password": hashed_password.decode('utf-8')}
        save_users(users)

        debug_message("INFO", f"User '{username}' signed up.")
        return redirect(url_for('login'))

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        users = load_users()
        if username in users:
            stored_password = users[username]["password"]
            if bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
                session['username'] = username
                debug_message("INFO", f"User '{username}' logged in.")
                return redirect(url_for('calendar'))

        return render_template('login.html', error="Invalid credentials, please try again.")

    return render_template('login.html')

# Route to display the calendar after user login
@app.route('/calendar')
def calendar():
    if 'username' not in session:
        return redirect(url_for('login'))

    debug_message("INFO", f"Displaying calendar for user '{session['username']}'")
    return render_template('calendar.html')

# Route to fetch events for the logged-in user
@app.route('/get_events', methods=['GET'])
def get_events():
    if 'username' not in session:
        return redirect(url_for('login'))

    username = session['username']
    events = load_events(username)
    return jsonify(events), 200

@app.route('/save_event', methods=['POST'])
def save_event():
    if 'username' not in session:
        return redirect(url_for('login'))

    username = session['username']
    data = request.get_json()

    if data:
        events = load_events(username)
        event_id = data.get("id")
        event_updated = False

        # Update if event ID exists, otherwise append a new event
        if event_id:
            for i, event in enumerate(events):
                if event.get("id") == event_id:
                    # Only log and save if the new data differs from existing event data
                    if events[i] != data:
                        events[i] = data
                        event_updated = True
                        debug_message("INFO", f"User '{username}' moved event ID {event_id}")
                    break
        else:
            data["id"] = len(events) + 1
            events.append(data)
            debug_message("INFO", f"User '{username}' added new event with ID {data['id']}")
            event_updated = True

        # Save events only if there's an actual update
        if event_updated:
            save_events(username, events)
        return jsonify({"success": True, "id": data["id"]}), 200
    else:
        debug_message("ERROR", "No data received to save the event.")
        return jsonify({"success": False}), 400

@app.route('/delete_event', methods=['POST'])
def delete_event():
    if 'username' not in session:
        return jsonify({"error": "User not logged in"}), 401

    username = session['username']
    data = request.get_json()

    # Check if data is received and contains 'id'
    if not data or "id" not in data:
        debug_message("ERROR", "Delete request received without an 'id'.")
        return jsonify({"error": "Event ID not provided"}), 400

    event_id = int(data["id"])  # Ensure the event_id is an integer
    events = load_events(username)

    # Log the loaded events for debugging purposes
    debug_message("INFO", f"Loaded events for user '{username}': {events}")

    # Confirm if the event exists by comparing event IDs
    event_exists = any(event.get("id") == event_id for event in events)

    # Log if the event was not found
    if not event_exists:
        debug_message("ERROR", f"Attempted to delete non-existent event {event_id} for user '{username}'")
        return jsonify({"error": "Event not found"}), 404

    # Filter out the event to delete
    events = [event for event in events if event.get("id") != event_id]
    save_events(username, events)

    debug_message("INFO", f"Deleted event {event_id} for user '{username}'")
    return jsonify({"success": True}), 200

# Route to handle home page redirection
@app.route('/')
def home():
    return redirect(url_for('login'))

from waitress import serve

if __name__ == '__main__':
    debug_message("INFO", "Starting Flask app with Waitress server.")
    serve(app, host='0.0.0.0', port=80)
