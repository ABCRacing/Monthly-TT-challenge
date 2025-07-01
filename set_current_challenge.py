import json
from pathlib import Path

# Prompt the user for details
month   = input("Month?          (e.g. May): ").strip()
year    = input("Year?           (e.g. 2025): ").strip()
track   = input("Track?          (e.g. Donington Park): ").strip()
variant = input("Track Variant?  (e.g. National): ").strip()
car     = input("Car?            (e.g. Dallara F309): ").strip()
link    = input("Data link?      (JSON link from scraping website): ").strip()

# Build the challenge dictionary
challenge = {
    "month": month,
    "year": year,
    "track": track,
    "variant": variant,
    "car": car,
}

# Add the link if provided
if link:
    challenge["data_link"] = link

# Save to file
output_path = Path("data/current_challenge.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(challenge, f, indent=2, ensure_ascii=False)

print(f"\n✅ Challenge info saved to {output_path}")
