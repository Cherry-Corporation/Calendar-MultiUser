from flask import Flask, request, jsonify, render_template, redirect, url_for, session
import json
import os
import bcrypt

app = Flask(__name__)

# Secret key for session management (used for user login)
app.secret_key = '21db00c0f6773c0f067172887f07b454eca03ff430a8278a996307a72bd51174'

# Get the current directory of the main.py script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define paths to the 'data' and 'users' folders relative to the current script directory
DATA_FOLDER = os.path.join(BASE_DIR, 'data')
USERS_FOLDER = os.path.join(BASE_DIR, 'users')
USERS_FILE = os.path.join(USERS_FOLDER, 'users.json')

# Debug message function
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

# Route for user login
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
        return jsonify({"error": "User not logged in"}), 401

    username = session['username']
    events = load_events(username)

    return jsonify(events), 200

# Load events for a user
def load_events(username):
    user_file = os.path.join(DATA_FOLDER, f"{username}.json")
    if os.path.exists(user_file):
        try:
            with open(user_file, 'r') as file:
                events = json.load(file)
                valid_events = []
                for event in events:
                    if "id" in event and "title" in event and "start" in event:
                        if "end" not in event:
                            event["end"] = event["start"]
                        valid_events.append(event)
                return valid_events
        except json.JSONDecodeError:
            debug_message("ERROR", f"Malformed JSON in {user_file}.")
    return []

# Save events for a user
def save_events(username, events):
    user_file = os.path.join(DATA_FOLDER, f"{username}.json")
    try:
        with open(user_file, 'w') as file:
            json.dump(events, file, indent=4)
    except IOError as e:
        debug_message("ERROR", f"Failed to save events for user '{username}': {e}")

# Route to save or update an event
@app.route('/save_event', methods=['POST'])
def save_event():
    if 'username' not in session:
        return jsonify({"error": "User not logged in"}), 401

    username = session['username']
    event_data = request.get_json()

    if not event_data:
        return jsonify({"success": False, "error": "No data provided"}), 400

    events = load_events(username)
    event_id = event_data.get("id")

    if event_id:
        event_id = str(event_id)
        for i, event in enumerate(events):
            if str(event["id"]) == event_id:
                events[i] = event_data
                break
        else:
            return jsonify({"success": False, "error": "Event not found"}), 404
    else:
        event_data["id"] = str(max((int(event["id"]) for event in events), default=0) + 1)
        events.append(event_data)

    save_events(username, events)
    return jsonify({"success": True, "id": event_data["id"]}), 200

# Route to delete an event
@app.route('/delete_event', methods=['POST'])
def delete_event():
    if 'username' not in session:
        return jsonify({"error": "User not logged in"}), 401

    username = session['username']
    data = request.get_json()

    if not data or "id" not in data:
        debug_message("ERROR", "Delete request received without an 'id'.")
        return jsonify({"error": "Event ID not provided"}), 400

    event_id = int(data["id"])
    events = load_events(username)

    debug_message("INFO", f"Loaded events for user '{username}': {events}")

    if not any(event.get("id") == event_id for event in events):
        debug_message("ERROR", f"Attempted to delete non-existent event {event_id} for user '{username}'")
        return jsonify({"error": "Event not found"}), 404

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
    # serve(app, host='0.0.0.0', port=80)
    app.run(port=80, debug=True)
