#!/bin/sh
# Start Planner on this machine. Open the address it prints in your browser.
cd "$(dirname "$0")" || exit 1
exec python3 server.py "$@"
