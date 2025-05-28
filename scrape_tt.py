import json
import requests

# URL of the AMS2 leaderboard
url = "https://ams2leaderboards.neocities.org/data/boards/F3%20Brasil,%20Jacarepagu%C3%A1%20Historic%202012%20SCB.json"

# List of Steam names or IDs you care about (adjust to match exactly)
target_users = ["ACEREES", "Bobinator", "ieuanTT", "FuryF1", "SpeedCat"]  # Example names

# Fetch the data
response = requests.get(url)
data = response.json()

# Check the structure and filter only the needed entries
filtered_results = []

for entry in data:
    if isinstance(entry, list) and len(entry) > 1:
        driver_name = entry[1]
        if driver_name in target_users:
            filtered_results.append({
                "position": entry[0],
                "driver": entry[1],
                "steam_id": entry[2],
                "lap_time": entry[3],
                "sector1": entry[4],
                "sector2": entry[5],
                "sector3": entry[6],
                "car": entry[8],
                "date": entry[9]
            })

# Save filtered data to a JSON file for the website to load
with open("leaderboard.json", "w") as f:
    json.dump(filtered_results, f, indent=4)

print(f"Saved {len(filtered_results)} results to leaderboard.json")
