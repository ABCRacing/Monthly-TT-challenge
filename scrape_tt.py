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

# List of users to filter by (you can include original or friendly names here)
filter_users = list(name_map.keys()) + list(name_map.values())

# Keys for leaderboard fields
keys = ['Position', 'Name', 'SteamID', 'LapTime', 'Sector1', 'Sector2', 'Sector3', 'Gap', 'Car', 'Date', 'Flags']

# Output path
output_dir = "data"
output_path = os.path.join(output_dir, "leaderboard_filtered.json")

# Helper: convert milliseconds to m:ss.SSS (e.g. 90300 → "1:30.300")
def format_laptime(ms):
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    milliseconds = ms % 1000
    return f"{minutes}:{seconds:02d}.{milliseconds:03d}"

# Helper: convert milliseconds to ss.SSS (e.g. 22260 → "22.260")
def format_sectortime(ms):
    seconds = ms // 1000
    milliseconds = ms % 1000
    return f"{seconds}.{milliseconds:03d}"

# Helper: convert gap to "+s.SSS" (e.g. 1400 → "+1.400")
def format_gap(ms):
    seconds = ms // 1000
    milliseconds = ms % 1000
    return f"+{seconds}.{milliseconds:03d}"

def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        filtered_data = []
        for entry in data:
            entry_dict = dict(zip(keys, entry))

            name = entry_dict["Name"]
            if name in name_map:
                entry_dict["Name"] = name_map[name]
                name = name_map[name]  # update for filtering

            if name not in filter_users:
                continue

            # Format times
            entry_dict["LapTime"] = format_laptime(entry_dict["LapTime"])
            entry_dict["Sector1"] = format_sectortime(entry_dict["Sector1"])
            entry_dict["Sector2"] = format_sectortime(entry_dict["Sector2"])
            entry_dict["Sector3"] = format_sectortime(entry_dict["Sector3"])
            entry_dict["Gap"] = format_gap(entry_dict["Gap"])

            filtered_data.append(entry_dict)

        with open(output_path, "w") as f:
            json.dump(filtered_data, f, indent=2)

        print(f"Filtered leaderboard saved to {output_path}")

    except Exception as e:
        print("Error fetching leaderboard:", e)

# Run it
fetch_leaderboard()
