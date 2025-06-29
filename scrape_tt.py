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
