import json
from pathlib import Path

# === 1) Load metadata from current_challenge.json ===
challenge_path = Path("data/current_challenge.json")
if not challenge_path.exists():
    print(f"ERROR: '{challenge_path}' not found. Please create it with the challenge metadata.")
    exit(1)

with challenge_path.open("r", encoding="utf-8") as f:
    challenge = json.load(f)

month_input = challenge.get("month", "").strip()
year_input = challenge.get("year", "").strip()
track_input = challenge.get("track", "").strip()
variant_input = challenge.get("variant", "").strip()
car_input = challenge.get("car", "").strip()

# Normalize month/year for file naming
month_upper = month_input.upper()
output_filename = f"{month_upper}{year_input}_RESULTS.json"

# === 2) Load filtered leaderboard ===
input_path = Path("data/leaderboard_filtered.json")
if not input_path.exists():
    print(f"ERROR: '{input_path}' not found. Did you run scrape_tt.py already?")
    exit(1)

with input_path.open("r", encoding="utf-8") as f:
    filtered = json.load(f)

# === 3) Transform into archive format ===
archive_results = []
for entry in filtered:
    try:
        pos = int(entry.get("Position", ""))
    except:
        pos = None

    archive_results.append({
        "position": pos,
        "name": entry.get("Name", ""),
        "laptime": entry.get("LapTime", ""),
        "sector1": entry.get("Sector1", ""),
        "sector2": entry.get("Sector2", ""),
        "sector3": entry.get("Sector3", ""),
        "timestamp": entry.get("Date", "")
    })

archive_object = {
    "track": track_input,
    "variant": variant_input,
    "car": car_input,
    "month": month_input,
    "year": int(year_input),
    "results": archive_results
}

# === 4) Write archive file ===
archive_dir = Path("data/archive")
archive_dir.mkdir(parents=True, exist_ok=True)

output_path = archive_dir / output_filename
with output_path.open("w", encoding="utf-8") as f:
    json.dump(archive_object, f, indent=2)

print(f"\n✅ Archived results saved to: {output_path}")

# === 5) Update index.json ===
index_path = archive_dir / "index.json"

# Load existing index if available
if index_path.exists():
    with index_path.open("r", encoding="utf-8") as f:
        try:
            index_list = json.load(f)
        except json.JSONDecodeError:
            print("⚠️ Warning: index.json was corrupt. Rebuilding from scratch.")
            index_list = []
else:
    index_list = []

# Remove duplicate if it exists already, then insert at top
index_list = [entry for entry in index_list if entry != output_filename]
index_list.insert(0, output_filename)

# Save updated index.json
with index_path.open("w", encoding="utf-8") as f:
    json.dump(index_list, f, indent=2)

print(f"✅ Updated archive index: {index_path}")

# Save last output path for batch file to read
last_output_path = Path("last_output.txt")
with last_output_path.open("w", encoding="utf-8") as f:
    f.write(str(output_path))

