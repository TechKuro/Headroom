@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Headroom Capacity Planner - First Time Setup
echo ============================================================
echo.
echo This will install everything needed to run the app on a
echo fresh PC: Node.js, the project dependencies, then launch.
echo.

REM ----------------------------------------------------------------
REM 1. Make sure Node.js (and npm) are available
REM ----------------------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 goto :install_node

echo [1/3] Node.js detected:
node --version
goto :have_node

:install_node
echo [1/3] Node.js not found. Installing the latest LTS version...
echo.

where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed and winget is unavailable.
    echo.
    echo Please install Node.js LTS manually from:
    echo     https://nodejs.org/en/download
    echo Then re-run this file.
    echo.
    pause
    exit /b 1
)

winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Automatic Node.js install failed.
    echo Please install Node.js LTS manually from https://nodejs.org
    echo then re-run this file.
    echo.
    pause
    exit /b 1
)

echo.
echo Node.js installed. A new terminal session is required so that
echo the PATH picks up node/npm.
echo.
echo  ==> Please CLOSE this window and run first-time-start.bat again.
echo.
pause
exit /b 0

:have_node
echo.

REM ----------------------------------------------------------------
REM 2. Download / install project dependencies
REM ----------------------------------------------------------------
echo [2/3] Installing project dependencies (npm)...
echo.

if exist package-lock.json (
    call npm ci
) else (
    call npm install
)

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Dependency installation failed. See messages above.
    echo.
    pause
    exit /b 1
)

echo.

REM ----------------------------------------------------------------
REM 3. Launch the app
REM ----------------------------------------------------------------
echo [3/3] Starting Headroom...
echo.
echo From now on you can just use start.bat to launch the app.
echo.

call npx vite --port 5173 --open

endlocal
