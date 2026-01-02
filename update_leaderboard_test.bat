@echo off
title Updating AMS2 Leaderboard

:: ========================================================
:: STEP 0: Go to the correct folder
:: ========================================================
cd /d "F:\Documents\python"

:: ========================================================
:: STEP 1: Run Sanity Check FIRST
:: ========================================================
echo [1/3] Calling Sanity Check...
call sanity.bat

:: CHECK: Did sanity.bat fail or fix something?
:: "if errorlevel 1" means "if the error code is 1 OR HIGHER"
if errorlevel 1 (
    color 0C
    echo.
    echo 🛑 STOPPING SCRIPT.
    echo ⚠️ Sanity check found issues or made a "WIP" commit.
    echo ⚠️ Review the output above, then run this script again.
    echo.
    pause
    exit /b
)

:: ========================================================
:: STEP 2: Run Python Script (Only runs if Step 1 was clean)
:: ========================================================
echo.
echo [2/3] Sanity Passed. Running Python scraper...
python scrape_tt.py

if errorlevel 1 (
    echo ❌ Python script failed.
    pause
    exit /b
)

:: ========================================================
:: STEP 3: Push New Data
:: ========================================================
echo.
echo [3/3] Python success. Pushing results to GitHub...
git add .
git commit -m "Updated leaderboard with latest data"
git pull --rebase
git push

echo ✅ SUCCESS: Leaderboard updated.
pause