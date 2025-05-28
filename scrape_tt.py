import requests

url = "https://ams2leaderboards.neocities.org/data/boards/F3%20Brasil,%20Jacarepagu%C3%A1%20Historic%202012%20SCB.json"

try:
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    print(f"Length of JSON list: {len(data)}")

    for item in data:
        # item is a list like ['1', 'ACEREES', '76561197971749679', '1:12.340', ...]
        position = item[0]
        driver_name = item[1]
        lap_time = item[3]
        print(f"Position {position}: {driver_name} - Lap Time: {lap_time}")

except requests.exceptions.RequestException as e:
    print(f"Failed to fetch the page: {e}")
except ValueError:
    print("Failed to parse JSON.")
