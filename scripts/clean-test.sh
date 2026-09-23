#!/usr/bin/env bash
# Simulates a judge: fresh clone of the COMMITTED state into a temp dir,
# .env.example only, build from scratch, smoke test, tear down.
# Uncommitted work is deliberately not included.
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
PORT="${CLEAN_TEST_PORT:-3900}"
P=hackalem-cleantest
trap 'cd "$TMP/repo" 2>/dev/null && docker compose -p $P down -v --remove-orphans >/dev/null 2>&1; rm -rf "$TMP"' EXIT

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "WARNING: uncommitted changes are NOT part of this test (judges only see commits)."
fi

git clone --quiet "$ROOT" "$TMP/repo"
cd "$TMP/repo"
cp .env.example .env
# Separate ports so the test can run next to your normal stack.
sed -i.bak -e "s/^WEB_PORT=.*/WEB_PORT=$PORT/" -e "s/^HTTPS_PORT=.*/HTTPS_PORT=$((PORT + 1))/" .env && rm -f .env.bak

echo ">> Building from scratch (no cache)"
docker compose -p $P build --no-cache
docker compose -p $P up -d --wait
WEB_PORT="$PORT" ./scripts/smoke.sh
echo ">> Clean-clone test passed"
