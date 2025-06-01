import json
from pathlib import Path

# === 1) Ask for month/year/track/variant/car ===
#    You can enter e.g. "May" and "2025", etc.
month_input   = input("What month?   (e.g. May): ").strip()
year_input    = input("What year?    (e.g. 2025): ").strip()
track_input   = input("Track?        (e.g. Donington Park): ").strip()
variant_input = input("Variant?      (e.g. National): ").strip()
car_input     = input("Car?          (e.g. Dallara F309): ").strip()

# Normalize month/year for file‐naming:
#   e.g. "May" + "2025" → "MAY2025_RESULTS.json"
month_upper = month_input.upper()
year_str    = year_input
output_filename = f"{month_upper}{year_str}_RESULTS.json"

# === 2) Load filtered leaderboard ===
input_path = Path("data/leaderboard_filtered.json")
if not input_path.exists():
    print(f"ERROR: '{input_path}' not found.  Did you run scrape_tt.py already?")
    exit(1)

with input_path.open("r", encoding="utf-8") as f:
    filtered = json.load(f)

# === 3) Transform into archive format ===
#    We expect each entry in filtered to look like:
#      { "Position": "...", "Name": "...", "LapTime": "...",
#        "Sector1": "...", "Sector2": "...", "Sector3": "...",
#        "Gap": "...", "Car": "...", "Date": "YY-MM-DD HH:MM" }
#
#    We want to convert into:
#    {
#      "track": "...",
#      "variant": "...",
#      "car": "...",
#      "month": "...",
#      "year": 2025,
#      "results": [
#        {
#          "position": 1,
#          "driver": "Neil Bywater",
#          "laptime": "1:12.287",
#          "sector1": "23.581",
#          "sector2": "20.018",
#          "sector3": "28.688",
#          "timestamp": "25-05-29 20:07"
#        },
#        ...
#      ]
#    }

archive_results = []
for entry in filtered:
    # Convert "Position" string → integer
    try:
        pos = int(entry.get("Position", "") )
    except:
        pos = None

    archive_results.append({
        "position": pos,
        "driver":   entry.get("Name", ""),
        "laptime":  entry.get("LapTime", ""),
        "sector1":  entry.get("Sector1", ""),
        "sector2":  entry.get("Sector2", ""),
        "sector3":  entry.get("Sector3", ""),
        "timestamp": entry.get("Date", "")
    })

# Build the top‐level archive object
archive_object = {
    "track":   track_input,
    "variant": variant_input,
    "car":     car_input,
    "month":   month_input,
    "year":    int(year_input),
    "results": archive_results
}

# === 4) Write out to data/archive/MAY2025_RESULTS.json (or similar) ===
archive_dir  = Path("data/archive")
archive_dir.mkdir(parents=True, exist_ok=True)

output_path = archive_dir / output_filename
with output_path.open("w", encoding="utf-8") as f:
    json.dump(archive_object, f, indent=2)

print(f"\n✅ Archived results saved to: {output_path}")
