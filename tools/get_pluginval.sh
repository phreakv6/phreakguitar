#!/bin/bash
# Fetch pluginval (Tracktion's plugin validator) into tools/.
# Kept out of git; re-run this script on a fresh checkout.
set -euo pipefail

cd "$(dirname "$0")"

if [ -d "pluginval.app" ]; then
    echo "pluginval already present"
    exit 0
fi

URL="https://github.com/Tracktion/pluginval/releases/latest/download/pluginval_macOS.zip"
echo "fetching $URL"
curl -fL -o pluginval.zip "$URL"
unzip -oq pluginval.zip
rm -f pluginval.zip

echo "pluginval installed at tools/pluginval.app"
