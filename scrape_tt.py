import requests
import json
import os

# === Load current challenge info ===
with open("data/current_challenge.json", "r") as f:
    challenge_info = json.load(f)

url = challenge_info.get("data_link")

# === Friendly name mapping ===
name_map = {
    "ACEREES": "Chris Rees",
    "reesyboy4": "Ieuan Rees",
    "Joe": "Joe Bywater",
    # Add SteamID -> Friendly Name if needed
    "76561198012345678": "Neil Bywater"
}

# === Friends to include (by name or SteamID) ===
filter_users = {
    "ACEREES",
    "Neil Bywater",
    "reesyboy4",
    "Joe",
    "Steve Jackson",
    "76561198012345678"  # Neil’s SteamID (example)
}

# === Keys from AMS2 API ===
keys = ['Position', 'Name', 'SteamID', 'LapTime', 'Sector1', 'Sector2', 'Sector3', 'Gap', 'Car', 'Date', 'Flags']

# === Output files ===
output_dir = "data"
output_filtered = os.path.join(output_dir, "leaderboard_filtered.json")
output_raw = os.path.join(output_dir, "leaderboard_raw.json")


# --- Helpers ---
def format_time(ms):
    """Convert ms to MM:SS.sss or SS.sss."""
    if not ms:
        return ""
    ms = int(ms)
    minutes = ms // 60000
    seconds = (ms % 60000) / 1000
    return f"{minutes}:{seconds:06.3f}" if minutes else f"{seconds:.3f}"


def format_gap(ms):
    if not ms:
        return ""
    return f"+{int(ms)/1000:.3f}"


def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        # Save raw dump for debugging
        with open(output_raw, "w") as f:
            json.dump(data, f, indent=2)
        print(f"📄 Raw leaderboard saved to: {output_raw}")

        filtered = []
        for row in data:
            mapped = dict(zip(keys, row))

            # Match if Name or SteamID in filter list
            if mapped["Name"] not in filter_users and mapped["SteamID"] not in filter_users:
                continue

            # Apply friendly name mapping (prefers SteamID if mapped)
            if mapped["SteamID"] in name_map:
                mapped["Name"] = name_map[mapped["SteamID"]]
            else:
                mapped["Name"] = name_map.get(mapped["Name"], mapped["Name"])

            # Format times
            mapped["LapTime"] = format_time(mapped.get("LapTime"))
            mapped["Sector1"] = format_time(mapped.get("Sector1"))
            mapped["Sector2"] = format_time(mapped.get("Sector2"))
            mapped["Sector3"] = format_time(mapped.get("Sector3"))
            mapped["Gap"] = format_gap(mapped.get("Gap"))

            filtered.append(mapped)

        # Save filtered data
        with open(output_filtered, "w") as f:
            json.dump(filtered, f, indent=2)

        print(f"✅ Filtered leaderboard saved to: {output_filtered}")

    except Exception as e:
        print(f"❌ Error fetching leaderboard: {e}")


if __name__ == "__main__":
    fetch_leaderboard()
