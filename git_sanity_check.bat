@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

REM ================================
REM  Git Sanity Check Script
REM ================================

REM --- Ensure we are inside a git repo ---
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not inside a Git repository.
    goto END
)

REM --- Dirty working tree check ---
for /f %%G in ('git status --porcelain') do (
    echo ERROR: REPOSITORY IS DIRTY
    echo Uncommitted or untracked files detected.
    echo.
    echo Fix - copy and paste EXACTLY:
    echo git add .
    goto END
)

REM --- Passed ---
echo OK: Working tree clean.
echo Git sanity check passed.

:END
endlocal
exit /b

