import requests
import json
import os

# Load current challenge info
with open("data/current_challenge.json", "r") as f:
    challenge_info = json.load(f)

# Use the data_link from current_challenge.json
url = challenge_info.get("data_link")

# Friendly name mapping
name_map = {
    "ACEREES": "Chris Rees",
    "reesyboy4": "Ieuan Rees",
    "Joe": "Joe Bywater"
}

# List of users to keep (case-insensitive match after name_map applied)
filter_users = [
    "Chris Rees",
    "Neil Bywater",
    "Ieuan Rees",
    "Joe Bywater",
    "Steve Jackson"
]

# This maps the list of values to meaningful keys
keys = ['Position', 'Name', 'SteamID', 'LapTime', 'Sector1', 'Sector2', 'Sector3', 'Gap', 'Car', 'Date', 'Flags']

# Output path
output_dir = "data"
output_path = os.path.join(output_dir, "leaderboard_filtered.json")

# === Time formatting ===

def format_lap_time(ms):
    if not isinstance(ms, int):
        return ms
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    milliseconds = ms % 1000
    return f"{minutes}:{seconds:02}.{milliseconds:03}"

def format_sector_time(ms):
    if not isinstance(ms, int):
        return ms
    seconds = ms // 1000
    milliseconds = ms % 1000
    return f"{seconds}.{milliseconds:03}"

# === Fetch and filter ===

def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        filtered = []

        for entry in data:
            row = dict(zip(keys, entry))

            # Replace name with friendly version if available
            raw_name = row['Name']
            friendly_name = name_map.get(raw_name, raw_name)
            row['Name'] = friendly_name

            # Filter based on friendly name
            if friendly_name in filter_users:
                # Format times
                row['LapTime']  = format_lap_time(row['LapTime'])
                row['Sector1']  = format_sector_time(row['Sector1'])
                row['Sector2']  = format_sector_time(row['Sector2'])
                row['Sector3']  = format_sector_time(row['Sector3'])

                filtered.append(row)

        with open(output_path, 'w') as f:
            json.dump(filtered, f, indent=2)
        print(f"Filtered leaderboard saved to {output_path}")

    except requests.RequestException as e:
        print("Error fetching leaderboard data:", e)

# Run it
fetch_leaderboard()
