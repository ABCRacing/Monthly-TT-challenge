import requests
import json
import os

# Load current challenge info
with open("data/current_challenge.json", "r") as f:
    challenge_info = json.load(f)

# Use the data_link from current_challenge.json
url = challenge_info.get("data_link")

# Mapping Steam usernames/IDs to friendly names
name_map = {
    "ACEREES": "Chris Rees",
    "reesyboy4": "Ieuan Rees",
    "Joe": "Joe Bywater",
    "NeilBywaterSteamID": "Neil Bywater"  # replace with Neil’s actual SteamID later
}

# Filtered users by Name or SteamID
filter_users = [
    "ACEREES",
    "reesyboy4",
    "Joe",
    "Neil Bywater",
    "Steve Jackson",
    "NeilBywaterSteamID"   # fallback in case Neil’s display name changes
]

# Keys for each value from the raw data
keys = [
    "Position", "Name", "SteamID", "LapTime", "Sector1",
    "Sector2", "Sector3", "Gap", "Car", "Date", "Flags"
]

# Output files
output_dir = "data"
output_path = os.path.join(output_dir, "leaderboard_filtered.json")
raw_output_path = os.path.join(output_dir, "leaderboard_raw.json")


def format_time(ms):
    """Convert milliseconds to MM:SS.sss or SS.sss format."""
    if ms in (None, "", "0"):
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
    if ms in (None, "", "0"):
        return ""
    ms = int(ms)
    seconds = ms / 1000
    return f"+{seconds:.3f}"


def fetch_leaderboard():
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        raw_data = response.json()

        # Save raw (for debugging when someone is missing)
        with open(raw_output_path, "w") as f:
            json.dump(raw_data, f, indent=2)
        print(f"Raw leaderboard saved to: {raw_output_path}")

        filtered = []
        for row in raw_data:
            mapped = dict(zip(keys, row))

            # Check Name or SteamID against filter
            if (
                mapped["Name"] not in filter_users
                and mapped["SteamID"] not in filter_users
            ):
                continue

            # Rename friendly names
            if mapped["Name"] in name_map:
                mapped["Name"] = name_map[mapped["Name"]]
            elif mapped["SteamID"] in name_map:
                mapped["Name"] = name_map[mapped["SteamID"]]

            # Format lap and sector times
            mapped["LapTime"] = format_time(mapped.get("LapTime"))
            mapped["Sector1"] = format_time(mapped.get("Sector1"))
            mapped["Sector2"] = format_time(mapped.get("Sector2"))
            mapped["Sector3"] = format_time(mapped.get("Sector3"))

            # Format gap
            mapped["Gap"] = format_gap(mapped.get("Gap"))

            filtered.append(mapped)

        # Save filtered data
        with open(output_path, "w") as f:
            json.dump(filtered, f, indent=2)

        print(f"✅ Filtered leaderboard saved to: {output_path}")

    except Exception as e:
        print(f"❌ Error fetching leaderboard: {e}")


if __name__ == "__main__":
    fetch_leaderboard()
