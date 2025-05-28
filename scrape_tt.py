import requests
import json
import os

# URL to fetch the leaderboard JSON data
url = "https://ams2leaderboards.neocities.org/data/boards/F3%20Brasil,%20Jacarepagu%C3%A1%20Historic%202012%20SCB.json"

# List of users to filter by (put your actual usernames here)
filter_users = [
    "ACEREES",
    "Neil Bywater",
    "reesyboy4",
    "Joe",
    "Steve Jackson"
]

# This maps the list of values to meaningful keys
keys = ['Position', 'Name', 'SteamID', 'LapTime', 'Sector1', 'Sector2', 'Sector3', 'Gap', 'Car', 'Date', 'Flags']

# Output path
output_dir = "data"
output_path = os.path.join(output_dir, "leaderboard_filtered.json")

def fetch_leaderboard():
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        print(f"Type of data: {type(data)}")
        print(f"Number of rows: {len(data)}")
        print(f"First row (raw): {data[0]}")

        filtered_data = []
        for row in data:
            entry = dict(zip(keys, row))
            if entry['Name'] in filter_users:
                filtered_data.append(entry)

        # Make sure the 'data' folder exists
        os.makedirs(output_dir, exist_ok=True)

        # Write filtered data to JSON file
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(filtered_data, f, indent=2)
        
        print(f"\nFiltered {len(filtered_data)} rows and saved to {output_path}")

    except requests.exceptions.HTTPError as e:
        print(f"HTTP error occurred: {e}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching leaderboard: {e}")
    except Exception as e:
        print(f"Other error occurred: {e}")

if __name__ == "__main__":
    fetch_leaderboard()
