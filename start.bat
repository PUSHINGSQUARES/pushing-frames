@echo off
REM PUSHING FRAMES_ — double-click launcher (Windows)
REM
REM First run: installs dependencies (one-time, ~30 seconds), then starts
REM the dev server and opens your default browser. Subsequent runs skip
REM the install and start straight away.
REM
REM Requires: Windows, Node.js (download from nodejs.org if missing), and
REM a Chromium browser (Chrome / Edge / Brave / Opera / Arc).
REM
REM Close this command window to stop the app.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Error: Node.js is not installed.
  echo.
  echo Install it from https://nodejs.org (download the LTS version, run
  echo the installer, then double-click start.bat again).
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo First run — installing dependencies (one-time, ~30 seconds)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting PUSHING FRAMES_ at http://localhost:5173/
echo.
echo Use Chrome / Edge / Brave / Opera / Arc — Safari and Firefox don't
echo support the File System Access API the app relies on.
echo.
echo Close this window to stop the app.
echo.

REM Open the browser after a short delay so the dev server is up
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173/"

REM Run dev server in foreground; closing this window kills it
call npm run dev
