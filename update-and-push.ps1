# Change to your project directory
Set-Location "F:\Documents\python"

# Run the Python scraper
python scrape_tt.py

# Git operations
git add .  # Stage all modified and new files
git commit -m "Update leaderboard and scripts"

# Safely pull with rebase to avoid rejected push
git pull --rebase origin main

# Push to GitHub
git push origin main

Write-Host "✅ Leaderboard updated and pushed to GitHub successfully."
