import requests
import json
import os

# Load current challenge info
with open("data/current_challenge.json", "r") as f:
    challenge_info = json.load(f)

# Use the data_link from current_challenge.json
url = challenge_info.get("data_link")

# Mapping Steam usernames to friendly names
name_map = {
    "ACEREES": "Chris Rees",
    "reesyboy4": "Ieuan Rees",
    "Joe": "Joe Bywater"
}

# List of users to include
filter_users = [
    "ACEREES",
    "Neil Bywater",
    "reesyboy4",
    "Joe",
    "Steve Jackson"
]

# Keys for each value from the raw data
keys = ['Position', 'Name', 'SteamID', 'LapTime', 'Sector1', 'Sector2', 'Sector3', 'Gap', 'Car', 'Date', 'Flags']

# Output file location
output_dir = "data"
output_path = os.path.join(output_dir, "leaderboard_filtered.json")

def format_time(ms):
    """Convert milliseconds to MM:SS.sss or SS.sss format."""
    if ms is None:
        return ""
    ms = int(ms)
    minutes = ms // 60000
    seconds = (ms % 60000) / 1000
    if minutes > 0:
        return f"{minutes}:{seconds:06.3f}"
    else:
        return f"{seconds:.3f}"

def format_gap(ms):
    """Format gap time in +X.XXX seconds."""
    if ms is None:
        return ""
    ms = int(ms)
    seconds = ms / 1000
    return f"+{seconds:.3f}"

def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        filtered = []
        for row in data:
            mapped = dict(zip(keys, row))

            # Only keep if in filter list
            if mapped['Name'] not in filter_users:
                continue

            # Rename friendly names
            mapped['Name'] = name_map.get(mapped['Name'], mapped['Name'])

            # Format lap and sector times
            mapped['LapTime'] = format_time(mapped.get('LapTime'))
            mapped['Sector1'] = format_time(mapped.get('Sector1'))
            mapped['Sector2'] = format_time(mapped.get('Sector2'))
            mapped['Sector3'] = format_time(mapped.get('Sector3'))

            # Format gap
            mapped['Gap'] = format_gap(mapped.get('Gap'))

            filtered.append(mapped)

        # Save filtered data
        with open(output_path, "w") as f:
            json.dump(filtered, f, indent=2)

        print(f"Filtered leaderboard saved to: {output_path}")

    except Exception as e:
        print(f"Error fetching leaderboard: {e}")

if __name__ == "__main__":
    fetch_leaderboard()
def format_time(ms):
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    milliseconds = ms % 1000
    return f"{minutes}:{seconds:02d}.{milliseconds:03d}"

def format_gap(ms):
    seconds = ms / 1000
    return f"+{seconds:.3f}"

def extract_lap_time(entry):
    return entry["LapTime"]

def convert_times(entry):
    # Convert numeric times into formatted strings
    entry["LapTime"] = format_time(entry["LapTime"])
    entry["Sector1"] = format_time(entry["Sector1"])
    entry["Sector2"] = format_time(entry["Sector2"])
    entry["Sector3"] = format_time(entry["Sector3"])
    return entry

def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        raw_data = response.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    filtered = []
    for row in raw_data:
        if row[1] in filter_users:
            mapped_name = name_map.get(row[1], row[1])  # Friendly name if available
            entry = dict(zip(keys, row))
            entry["Name"] = mapped_name
            entry["LapTime"] = int(entry["LapTime"])
            entry["Sector1"] = int(entry["Sector1"])
            entry["Sector2"] = int(entry["Sector2"])
            entry["Sector3"] = int(entry["Sector3"])
            filtered.append(entry)

    # Sort by LapTime to find gaps relative to fastest friend
    filtered.sort(key=extract_lap_time)
    fastest_time = filtered[0]["LapTime"]

    for i, entry in enumerate(filtered):
        gap_ms = entry["LapTime"] - fastest_time
        entry["Gap"] = format_gap(gap_ms)
        filtered[i] = convert_times(entry)

    # Write to JSON
    with open(output_path, "w") as f:
        json.dump(filtered, f, indent=2)

# Run the function
fetch_leaderboard()
