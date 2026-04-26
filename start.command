#!/bin/bash
#
# PUSHING FRAMES_ — double-click launcher (macOS)
#
# Serves the production build over localhost so the File System Access
# API works (it doesn't from a file:// URL), then opens your default
# browser to the app. Close this Terminal window to stop the server.
#
# Requires: macOS, Python 3 (preinstalled on macOS 12+), and a
# Chromium browser (Chrome / Edge / Opera / Brave / Arc).

set -e
cd "$(dirname "$0")"

PORT=8765

# Auto-detect where the app lives.
# Source root layout: <here>/dist/index.html
# Bundled layout:    <here>/index.html
if [ -f "./index.html" ]; then
  ROOT="."
elif [ -f "./dist/index.html" ]; then
  ROOT="./dist"
else
  echo
  echo "Error: couldn't find index.html next to start.command."
  echo
  echo "If you cloned this from GitHub, run these once first:"
  echo "  npm install"
  echo "  npm run build"
  echo
  echo "Then double-click start.command again."
  echo
  echo "Press any key to close..."
  read -n 1 -s
  exit 1
fi

if ! command -v python3 &> /dev/null; then
  echo
  echo "Error: python3 is not installed."
  echo "Install it with: xcode-select --install"
  echo
  echo "Press any key to close..."
  read -n 1 -s
  exit 1
fi

URL="http://localhost:$PORT/"

# Free the port if a previous launcher left a server running.
EXISTING_PID="$(lsof -ti tcp:$PORT 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  echo "Port $PORT was in use — stopping previous instance ($EXISTING_PID)."
  kill -9 "$EXISTING_PID" 2>/dev/null || true
  sleep 0.5
fi

echo
echo "PUSHING FRAMES_ is starting at $URL"
echo
echo "Use Chrome / Edge / Opera / Brave / Arc — Safari and Firefox don't"
echo "support the File System Access API the app relies on."
echo
echo "Close this Terminal window to stop the app."
echo
sleep 1
open "$URL"
cd "$ROOT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
