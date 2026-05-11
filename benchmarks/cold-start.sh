#!/usr/bin/env bash
# Measures cold-start time: process spawn → first HTTP 200 on /api/health
# Outputs tab-separated: variant  attempt  ms
# Usage: ./cold-start.sh [node|bun|deno] [attempts]

set -euo pipefail

VARIANT="${1:-node}"
ATTEMPTS="${2:-5}"
FIELDFIX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$VARIANT" in
  node)
    PORT=3000
    CMD="node --import tsx/esm src/index.ts"
    DIR="$FIELDFIX_ROOT/server-node"
    ;;
  bun)
    PORT=3001
    CMD="bun src/index.ts"
    DIR="$FIELDFIX_ROOT/server-bun"
    ;;
  deno)
    PORT=3002
    CMD="deno run --allow-net --allow-read --allow-write --allow-env --allow-ffi src/index.ts"
    DIR="$FIELDFIX_ROOT/server-deno"
    ;;
  *)
    echo "Unknown variant: $VARIANT" >&2
    exit 1
    ;;
esac

HEALTH_URL="http://localhost:${PORT}/api/health"

kill_port() {
  lsof -ti tcp:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 0.3
}

measure_once() {
  local attempt="$1"
  kill_port

  local t0
  t0=$(python3 -c "import time; print(int(time.time() * 1000))")

  (cd "$DIR" && eval "$CMD" >/dev/null 2>&1) &
  local pid=$!

  local elapsed=0
  local status=0
  while [ "$elapsed" -lt 10000 ]; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
      local t1
      t1=$(python3 -c "import time; print(int(time.time() * 1000))")
      echo -e "${VARIANT}\t${attempt}\t$((t1 - t0))"
      kill $pid 2>/dev/null || true
      kill_port
      return 0
    fi
    sleep 0.05
    elapsed=$((elapsed + 50))
  done

  echo -e "${VARIANT}\t${attempt}\tTIMEOUT" >&2
  kill $pid 2>/dev/null || true
  kill_port
  return 1
}

echo -e "variant\tattempt\tms"
for i in $(seq 1 "$ATTEMPTS"); do
  measure_once "$i"
  sleep 0.5
done
