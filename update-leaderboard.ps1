# Define the source URL and destination path
$sourceUrl = "https://ams2leaderboards.neocities.org/data/boards/F3%20Brasil,%20Jacarepagu%C3%A1%20Historic%202012%20SCB.json"
$destinationPath = ".\data\leaderboard_filtered.json"

# Download the JSON data
try {
    $response = Invoke-WebRequest -Uri $sourceUrl -UseBasicParsing
    $jsonData = $response.Content | ConvertFrom-Json
# Step 1: Change to the project directory
Set-Location "F:\Documents\python"

# Step 2: Pull latest changes from GitHub
git pull origin main

# Step 3: Run your Python scraping script
python scrape_tt.py

# Step 4: Stage all changes
git add .

# Step 5: Commit with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Auto-update leaderboard: $timestamp"

# Step 6: Push to GitHub
git push origin main
