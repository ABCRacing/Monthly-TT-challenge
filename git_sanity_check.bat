@echo off
setlocal ENABLEDELAYEDEXPANSION

echo ===============================
echo   Git Sanity Check
echo ===============================
echo.

REM -------------------------------
REM 1. Detect rebase or merge in progress
REM -------------------------------
if exist ".git\rebase-apply" goto REBASE
if exist ".git\rebase-merge" goto REBASE
if exist ".git\MERGE_HEAD" goto REBASE

REM -------------------------------
REM 2. Detect detached HEAD
REM -------------------------------
for /f "tokens=*" %%b in ('git symbolic-ref --short HEAD 2^>nul') do set BRANCH=%%b

if "%BRANCH%"=="" goto DETACHED

REM -------------------------------
REM 3. Detect dirty working tree
REM -------------------------------
git status --porcelain > "%TEMP%\git_dirty.tmp"
set /p DIRTY=<"%TEMP%\git_dirty.tmp"
del "%TEMP%\git_dirty.tmp"

if not "%DIRTY%"=="" goto DIRTY

REM -------------------------------
REM 4. Clean & safe
REM -------------------------------
echo ✅ Repo clean
echo ✅ On branch: %BRANCH%
echo.
echo You are safe to run update scripts.
goto END

REM ===============================
REM ERROR STATES
REM ===============================

:REBASE
echo 🔴 GIT REBASE / MERGE IN PROGRESS
echo.
echo Git is mid-operation. Scripts MUST NOT run.
echo.
echo 📋 Fix:
echo Copy and paste EXACTLY this:
echo git rebase --abort
goto END

:DETACHED
echo 🔴 DETACHED HEAD STATE
echo.
echo Git is not on a branch. Push/pull will fail.
echo.
echo 📋 Fix:
echo Copy and paste EXACTLY this:
echo git checkout main
goto END

:DIRTY
echo 🔴 REPO DIRTY
echo.
echo You have uncommitted or untracked files.
echo Pull/rebase WILL break things.
echo.
echo 📋 Fix:
echo Copy and paste EXACTLY this:
echo git add . ^&^& git commit -m "WIP" ^&^& git push
goto END

:END
echo.
pause
endlocal
