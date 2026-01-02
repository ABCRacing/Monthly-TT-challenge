@echo off
setlocal
title Updating AMS2 Leaderboard

:: 1. Navigate to the project folder FIRST so sanity.bat looks at the right repo
cd /d "F:\Documents\python"

:: 2. Run the sanity check
echo === Running Git Sanity Check ===
call sanity.bat

:: 3. Check if sanity.bat found issues
:: If it returned 1 (it fixed something or found an error), stop here.
if %errorlevel% neq 0 (
    echo.
    echo ⚠️ Sanity check required attention.
    echo Please review the output above and re-run this script.
    pause
    exit /b 1
)

:: 4. If we are here, Git is clean. Run the Scraper.
echo.
echo 🚀 Sanity Passed. Running Python script...
python scrape_tt.py

if errorlevel 1 (
    echo ❌ Python script failed. Aborting.
    pause
    exit /b 1
)

:: 5. Git Operations for the NEW data
echo.
echo Staging changes...
git add .

echo Committing changes...
git commit -m "Updated leaderboard with latest data"

echo Pulling latest changes from GitHub...
git pull --rebase

echo Pushing to GitHub...
git push

echo ✅ All Done!
pause