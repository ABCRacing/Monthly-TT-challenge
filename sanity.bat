@echo off
setlocal ENABLEDELAYEDEXPANSION

echo ===============================
echo   Git Sanity Check (v5)
echo ===============================
echo.

:: 0) Ensure we are inside a git repo
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 echo ❌ ERROR: Not a Git repository & exit /b 1

:: 1) DETECT DETACHED HEAD
set "CURRENT_REF="
for /f "delims=" %%A in ('git rev-parse --abbrev-ref HEAD') do set "CURRENT_REF=%%A"

if NOT "%CURRENT_REF%"=="HEAD" goto CHECK_REBASE

echo 🔴 ERROR: DETACHED HEAD detected.
set "TARGET_BRANCH=main"
git show-ref --verify --quiet refs/heads/main
if errorlevel 1 set "TARGET_BRANCH=master"

choice /C YN /M "Auto-fix: Switch to %TARGET_BRANCH%?"
if errorlevel 2 exit /b 1

git switch %TARGET_BRANCH%
echo ✔ Fixed. Please re-run script.
exit /b 1


:CHECK_REBASE
:: 2) DETECT REBASE / MERGE
git status | findstr /C:"rebase" >nul
if errorlevel 1 goto CHECK_MERGE

echo 🔴 ERROR: Rebase in progress.
choice /C YN /M "Abort rebase now?"
if errorlevel 2 exit /b 1
git rebase --abort
exit /b 1


:CHECK_MERGE
git status | findstr /C:"unmerged" /C:"merge" >nul
if errorlevel 1 goto CHECK_DIRTY

echo 🔴 ERROR: Merge conflict or merge in progress.
choice /C YN /M "Abort merge now?"
if errorlevel 2 exit /b 1
git merge --abort
exit /b 1


:CHECK_DIRTY
:: 3) DETECT DIRTY WORKING TREE
set "IS_DIRTY="
git diff-index --quiet HEAD -- >nul 2>&1
if errorlevel 1 set "IS_DIRTY=1"

:: Check for untracked files
for /f "delims=" %%i in ('git ls-files --others --exclude-standard') do set "IS_DIRTY=1"

if "%IS_DIRTY%"=="1" goto DIRTY_FLOW

echo ✅ Git repo is clean and safe.
exit /b 0


:DIRTY_FLOW
echo 🔴 ERROR: Repository is dirty (unsaved changes).
choice /C YN /M "Step 1: Stage all changes (git add -A)?"
if errorlevel 2 exit /b 1
git add -A

choice /C YN /M "Step 2: Commit (git commit -m 'WIP')?"
if errorlevel 2 exit /b 1
git commit -m "WIP"

choice /C YN /M "Step 3: Sync (Pull and Push)?"
if errorlevel 2 exit /b 1
git pull --rebase
git push
exit /b 1