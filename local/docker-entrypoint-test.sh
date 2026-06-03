#!/bin/sh
set -eu

MODULE_DIR="/data/node_modules/node-red-agent-ai"

if [ ! -d "$MODULE_DIR" ]; then
  echo "Installing local node-red-agent-ai into /data..."
  npm install --unsafe-perm --no-update-notifier --no-fund /usr/src/node-red/local-module
fi

exec /usr/src/node-red/entrypoint.sh npm start -- --userDir /data
