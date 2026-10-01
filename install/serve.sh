#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig en0 2>/dev/null | grep "inet " | awk '{print $2}' || echo "localhost")

echo "======================================================="
echo "   PAPPA'S POS APKS - INSTALLATION SERVER"
echo "======================================================="
echo ""
echo "👉 On your Sunmi POS terminal / Lightning Browser, go to:"
echo "   http://${IP}:8080"
echo ""
echo "Serving files from: ${DIR}"
echo "======================================================="

cd "${DIR}"
if command -v npx >/dev/null 2>&1; then
    exec npx -y live-server --port=8080 --host=0.0.0.0 --no-browser
else
    exec python3 -m http.server 8080
fi
