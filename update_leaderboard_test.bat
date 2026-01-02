@echo off
title Updating AMS2 Leaderboard
setlocal

:: 1. Navigate to the root folder
cd /d "F:\Documents\python"

@echo off
title Updating AMS2 Leaderboard
setlocal

:: 1. Navigate to the project folder
cd /d "F:\Documents\python"

:: 2. Pre-flight Sanity Check
echo [1/3] Running Sanity Check...
call sanity.bat
if errorlevel 1 (
    echo.
    :: Loop 5 times to create a flashing effect
    for /L %%i in (1,1,5) do (
        color 4F & timeout /t 1 /nobreak >nul
        color 0F & timeout /t 1 /nobreak >nul
    )
    :: Set back to Red for the final message
    color 0C
    echo 🛑 Sanity check found issues. Review above and re-run.
    echo.
    pause
    :: Reset color to normal before exiting
    color 0F
    exit /b 1
)

:: 3. Run the Scraper (Only runs if Sanity passed)
echo.
echo [2/3] Sanity Passed. Running Scraper...
python scrape_tt.py

if errorlevel 1 (
    echo.
    echo ❌ ERROR: Python script crashed.
    pause
    exit /b 1
)

:: 4. Final Sync
echo.
echo [3/3] Python finished. Syncing changes...
git add -A

:: Check if the JSON actually changed
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

echo.
echo === All tasks complete ===
pause

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