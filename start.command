#!/bin/bash
#
# PUSHING FRAMES_ — double-click launcher (macOS)
#
# First run: installs dependencies (one-time, ~30 seconds), then starts
# the dev server and opens your default browser. Subsequent runs skip
# the install and start straight away.
#
# Requires: macOS, Node.js (download from nodejs.org if missing), and a
# Chromium browser (Chrome / Edge / Opera / Brave / Arc).
#
# Close this Terminal window to stop the app.

set -e
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
  echo
  echo "Error: Node.js is not installed."
  echo
  echo "Install it from https://nodejs.org (download the LTS version, run"
  echo "the installer, then double-click start.command again)."
  echo
  echo "Press any key to close..."
  read -n 1 -s
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo
  echo "First run — installing dependencies (one-time, ~30 seconds)..."
  echo
  npm install
fi

# Free port 5173 if a previous instance is hanging on it
EXISTING_PID="$(lsof -ti tcp:5173 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  kill -9 "$EXISTING_PID" 2>/dev/null || true
  sleep 0.5
fi

echo
echo "Starting PUSHING FRAMES_ at http://localhost:5173/"
echo
echo "Use Chrome / Edge / Opera / Brave / Arc — Safari and Firefox don't"
echo "support the File System Access API the app relies on."
echo
echo "Close this Terminal window to stop the app."
echo

# Open the browser after a short delay so the dev server is up
( sleep 3 && open "http://localhost:5173/" ) &

# Run dev server in foreground; closing Terminal kills it
exec npm run dev
