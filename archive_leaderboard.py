import json
from pathlib import Path

# === CONFIGURATION ===
ARCHIVE_DIR = Path("data/archive")
INDEX_FILE = ARCHIVE_DIR / "index.json"

MONTH_ORDER = {
    "JANUARY": 1, "FEBRUARY": 2, "MARCH": 3, "APRIL": 4,
    "MAY": 5, "JUNE": 6, "JULY": 7, "AUGUST": 8,
    "SEPTEMBER": 9, "OCTOBER": 10, "NOVEMBER": 11, "DECEMBER": 12
}

def parse_filename(filename: str):
    """
    Extract year and month from filename like 'SEPTEMBER2025_RESULTS.json'
    Returns: (year, month_number)
    """
    parts = filename.split("_")[0]  # e.g. SEPTEMBER2025
    for m in MONTH_ORDER:
        if parts.startswith(m):
            year = int(parts[len(m):])
            return year, MONTH_ORDER[m]
    return 0, 13  # fallback to lowest priority


def update_index(new_filename: str):
    """
    Add a new archived results JSON file to index.json, keeping newest year first,
    and months in calendar order (Jan–Dec within the same year).
    """
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing index
    if INDEX_FILE.exists():
        try:
            with INDEX_FILE.open("r", encoding="utf-8") as f:
                index = json.load(f)
        except json.JSONDecodeError:
            print("⚠ Warning: index.json was invalid. Rebuilding from scratch.")
            index = []
    else:
        index = []

    # Add new entry if missing
    if new_filename not in index:
        index.append(new_filename)

    # Sort by year (desc) then month (asc)
    index.sort(key=lambda f: parse_filename(f), reverse=True)

    # Save back
    with INDEX_FILE.open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)

    print(f"✅ index.json updated with {new_filename}")


def main():
    # === 1) Load challenge metadata ===
    challenge_path = Path("data/current_challenge.json")
    if not challenge_path.exists():
        print(f"ERROR: '{challenge_path}' not found. Please create it with the challenge metadata.")
        return

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
        return

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
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = ARCHIVE_DIR / output_filename
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(archive_object, f, indent=2)

    print(f"\n✅ Archived results saved to: {output_path}")

    # === 5) Update index.json ===
    update_index(output_filename)

    # === 6) Save last output path for batch file to read ===
    last_output_path = Path("last_output.txt")
    with last_output_path.open("w", encoding="utf-8") as f:
        f.write(str(output_path))


if __name__ == "__main__":
    main()

