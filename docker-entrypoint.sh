#!/bin/sh
set -e

# Volumes created by older (root) versions of the image are owned by root:
# fix ownership as root, then drop privileges to the unprivileged node user.
if [ "$(id -u)" = "0" ]; then
    for dir in /app/server/data /app/public/uploads; do
        mkdir -p "$dir"
        if [ -n "$(find "$dir" \! -user node -print -quit)" ]; then
            chown -R node:node "$dir"
        fi
    done
    exec su-exec node "$@"
fi

exec "$@"
