@echo off
title Updating AMS2 Leaderboard
setlocal

:: 1. Navigate to the root folder of your project
cd /d "F:\Documents\python"

:: 2. Run the Sanity Check first
echo [1/3] Running Sanity Check...
call sanity.bat
if errorlevel 1 (
    echo 🛑 Sanity check failed or found manual fixes. Stopping.
    pause
    exit /b 1
)

:: 3. Run the Python Scraper
echo [2/3] Sanity Passed. Running Scraper...
python scrape_tt.py
if errorlevel 1 (
    echo ❌ Python script crashed. No data to push.
    pause
    exit /b 1
)

:: 4. THE FIX: Stage and Push the JSON from the data folder
echo [3/3] Python finished. Syncing new JSON to GitHub...

:: This ensures Git adds everything, including the 'data' subfolder
git add .

:: Only commit and push if there is actually a change in the JSON
git diff --cached --quiet
if errorlevel 1 (
    echo 📦 New data detected. Updating GitHub...
    git commit -m "Auto-update leaderboard data (%date% %time%)"
    git pull --rebase
    git push
    echo ✅ GitHub updated successfully.
) else (
    echo ℹ️ No changes found in the JSON data. Nothing to push.
)

pause