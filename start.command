#!/bin/bash
# macOS launcher: double-click in Finder to start App Vault (same as start.bat on Windows).
cd "$(dirname "$0")" || exit 1

# Finder doesn't load your shell profile, so find Node if it was installed with nvm or Homebrew
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 18 or newer from https://nodejs.org and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing packages, first time only..."
  npm install || { read -r -p "npm install failed. Press Enter to close..."; exit 1; }
fi

# Open the browser once the server answers
PORT="${PORT:-5050}"
(for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:$PORT/api/apps" && { open "http://localhost:$PORT"; break; }
  sleep 1
done) &

npm start
read -r -p "App Vault stopped. Press Enter to close..."
