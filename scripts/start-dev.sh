#!/usr/bin/env bash
# Starts the API detached from the calling shell's process group, so it
# survives the parent exiting or a terminal hangup.
#
#   scripts/start-dev.sh            # background, log to /tmp/mepro-server.log
#   scripts/start-dev.sh --wait     # block until /health responds
set -euo pipefail

cd "$(dirname "$0")/.."

LOG="${MEPRO_LOG:-/tmp/mepro-server.log}"
PIDFILE="/tmp/mepro-server.pid"
PORT="${PORT:-5000}"

port_busy() { curl -sf --max-time 2 "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; }

# Stop any previous instance. `setsid` double-forks, so the recorded pid is not
# the node process itself: match on the command line instead, then wait for the
# port to actually free up before starting a replacement.
pkill -f "tsx src/server.ts" 2> /dev/null || true
for _ in $(seq 1 20); do
  port_busy || break
  sleep 1
done
if port_busy; then
  echo "Port ${PORT} is still serving after 20s; refusing to start a second instance." >&2
  exit 1
fi
rm -f "$PIDFILE"

: > "$LOG"
setsid nohup npx tsx src/server.ts >> "$LOG" 2>&1 < /dev/null &
disown || true
pgrep -f "tsx src/server.ts" > "$PIDFILE" 2> /dev/null || true

if [ "${1:-}" = "--wait" ]; then
  for _ in $(seq 1 60); do
    if port_busy; then
      echo "API is healthy (pid $(cat "$PIDFILE" 2> /dev/null), log $LOG)"
      exit 0
    fi
    sleep 1
  done
  echo "API did not become healthy in 60s; see $LOG" >&2
  tail -20 "$LOG" >&2
  exit 1
fi

echo "API starting (log $LOG)"
