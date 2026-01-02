@echo off
title Updating AMS2 Leaderboard
setlocal

:: 1. Navigate to the root folder
cd /d "F:\Documents\python"

:: 2. Pre-flight Sanity Check
echo [1/3] Running Sanity Check...
call sanity.bat

if errorlevel 1 (
    :: --- ATTENTION STROBE ---
    :: Rapidly swaps colors to grab your eye
    color 4F & color 0F & color 4F & color 0F & color 4F & color 0F
    
    :: --- HIGH CONTRAST ERROR MESSAGE ---
    color 4F
    echo =======================================================
    echo   🛑 ATTENTION: SANITY CHECK FOUND ISSUES
    echo =======================================================
    color 0C
    echo.
    echo  The script has stopped because Git is not in a safe state.
    echo  Please scroll up to see the specific Git error.
    echo.
    echo =======================================================
    pause
    color 0F
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