#!/usr/bin/env bash
# Fresh clone of committed state; isolated services/volumes; one compose file.
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel)"
MODE=full
ENV_FILE=
case "${1:-}" in
  '') ;;
  --infrastructure-only) MODE=infrastructure ;;
  --env-file)
    [ "$#" -eq 2 ] && [ -f "$2" ] || { echo 'Usage: clean-test.sh --env-file /absolute/path/reviewer.env'; exit 2; }
    ENV_FILE="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")" ;;
  *) echo 'Usage: clean-test.sh [--infrastructure-only | --env-file /path/reviewer.env]'; exit 2 ;;
esac
TMP="$(mktemp -d)"
PORT="${CLEAN_TEST_PORT:-3900}"
P="hackalem-cleantest-$$"
cleanup() { if [ -d "$TMP/repo" ]; then (cd "$TMP/repo" && "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1) || true; fi; rm -rf "$TMP"; }
trap cleanup EXIT
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then echo 'WARNING: uncommitted changes are NOT part of this test.'; fi
git clone --quiet "$ROOT" "$TMP/repo"
cd "$TMP/repo"
cp .env.example .env
ENV_FILE="${ENV_FILE:-$PWD/.env}"
# Compose reads the file as data; never source it or print its contents.
# Force isolated Mongo and local public ports even when testing a VM config file.
export BASE_URL="http://host.docker.internal:$PORT"
export WEB_PORT="$PORT" HTTPS_PORT="$((PORT + 1))" SITE_ADDRESS=:80 MONGO_URL=mongodb://mongo:27017/hackalem
export DEMO_USER_EMAIL=demo@example.com DEMO_USER_PASSWORD=demo12345 DEMO_USER_NAME=Демо AUTH_SECRET=clean-test-only
COMPOSE=(env -u OPENAI_API_KEY -u NVIDIA_API_KEY -u LLM_MODEL -u LLM_PROVIDER -u LLM_BASE_URL -u EMBEDDING_MODEL docker compose --env-file "$ENV_FILE" -p "$P")
echo '>> Building committed state from scratch (no cache)'
"${COMPOSE[@]}" build --no-cache
"${COMPOSE[@]}" up -d --wait
if [ "$MODE" = infrastructure ]; then
  ./scripts/smoke.sh
  echo '>> Infrastructure-only check passed; main AI scenario was NOT verified'
else
  ./scripts/smoke.sh --require-analysis
  echo '>> Clean-clone main-scenario test passed'
fi
