#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export HOME="$PWD/.chrome-home"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.pw-browsers"
export npm_config_cache="$PWD/.npm-cache"
mkdir -p "$HOME" "$PLAYWRIGHT_BROWSERS_PATH" "$npm_config_cache"
if ! compgen -G "$PLAYWRIGHT_BROWSERS_PATH/chromium-*/chrome-linux/chrome" >/dev/null; then
  npm install --no-audit --no-fund playwright@1.48.2
  npx playwright install chromium
fi
node scripts/browser-check.mjs
