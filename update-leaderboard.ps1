import json
from pathlib import Path

# === Get user input ===
month = input("What month? (e.g., May 2025): ").strip()
track = input("Track? (e.g., Brands Hatch): ").strip()
variant = input("Variant? (e.g., Indy): ").strip()
challenge_car = input("Car? (e.g., Dallara F309): ").strip()

# === Load filtered leaderboard ===
input_path = Path("data/leaderboard_filtered.json")
output_filename = f"{month.upper().replace(' ', '')}_RESULTS.json"
output_path = Path("data/archive") / output_filename

with input_path.open(encoding='utf-8') as f:
    rows = json.load(f)

# === Transform the data ===
results = []
for row in rows:
    results.append({
        "position": int(row[0]),
        "name": row[1],
        "steam_id": row[2],
        "time": row[3],
        "sector1": row[4],
        "sector2": row[5],
        "sector3": row[6],
        "car": row[8],
        "date": row[9],
        "medal": row[10],
        "track": track,
        "variant": variant,
        "challenge_car": challenge_car,
        "month": month
    })

# === Save archive ===
output_path.parent.mkdir(parents=True, exist_ok=True)
with output_path.open("w", encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print(f"\n✅ Archived leaderboard to {output_path}")
