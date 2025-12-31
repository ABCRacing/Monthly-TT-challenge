@echo off
echo ===============================
echo   Git Sanity Check
echo ===============================
echo.

REM Ensure we're in a git repo
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: This folder is NOT a Git repository.
    echo.
    pause
    exit /b
)

REM Check current branch
for /f "tokens=*" %%i in ('git branch --show-current') do set BRANCH=%%i

if "%BRANCH%"=="" (
    echo ⚠️  WARNING: You are in a DETACHED HEAD state.
) else (
    echo ✅ On branch: %BRANCH%
)

REM Check for rebase
if exist ".git\rebase-merge" (
    echo ❌ REBASE IN PROGRESS (rebase-merge)
    echo    Run: git rebase --abort
    goto :STATUS
)

if exist ".git\rebase-apply" (
    echo ❌ REBASE IN PROGRESS (rebase-apply)
    echo    Run: git rebase --abort
    goto :STATUS
)

echo ✅ No rebase in progress

:STATUS
echo.
echo --- Git status ---
git status
echo.

echo --- Remote status ---
git remote -v
echo.

echo --- Suggested next action ---
echo If everything looks clean:
echo    git pull --rebase
echo    git push
echo.

pause
