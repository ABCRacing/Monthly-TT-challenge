@echo off
title Updating AMS2 Leaderboard
setlocal

:: 1. Navigate to the root folder
cd /d "F:\Documents\python"

:: 2. Pre-flight Sanity Check
echo [1/3] Running Sanity Check...
call sanity.bat
if errorlevel 1 (
    echo 🛑 Sanity check found issues. Review above and re-run.
    pause
    exit /b 1
)

:: 3. Run the Scraper
echo [2/3] Sanity Passed. Running Scraper...
python scrape_tt.py
if errorlevel 1 (
    echo ❌ Python script crashed. Aborting sync.
    pause
    exit /b 1
)

:: 4. Sync Data to GitHub
echo [3/3] Python finished. Syncing changes...

:: Stage everything (the -A flag is most robust)
git add -A

:: Only commit/push if something actually changed
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