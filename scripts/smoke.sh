#!/usr/bin/env bash
# End-to-end smoke test over HTTP. curl runs in a container, so the host needs
# nothing but Docker. Extend with the main scenario and 2-3 bad-input cases;
# this file is also the README's "how to verify" section.
#
#   ./scripts/smoke.sh                                  # local stack
#   BASE_URL=https://<vm-host> ./scripts/smoke.sh       # live preview
set -Eeuo pipefail

PORT="${WEB_PORT:-3000}"
BASE_URL="${BASE_URL:-http://host.docker.internal:$PORT}"
CURL=(docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl:8.10.1 -sS --max-time 15)

pass=0; fail=0
check() { # name, expected-substring, curl args...
  local name="$1" expect="$2"; shift 2
  local out
  if out="$("${CURL[@]}" "$@" 2>&1)" && grep -q -- "$expect" <<<"$out"; then
    echo "  ok    $name"; pass=$((pass + 1))
  else
    echo "  FAIL  $name"; echo "        got: ${out:0:300}"; fail=$((fail + 1))
  fi
}

echo "Smoke test against $BASE_URL"
check "backend health"    '"ok"'                    "$BASE_URL/api/health"
check "frontend is up"    "Анализ оргструктуры"     "$BASE_URL/"
check "unknown api route" '"not_found"'             "$BASE_URL/api/does-not-exist"

# --- main scenario (fill in once the API exists) -----------------------------
# check "main scenario"      '"result"'  -X POST "$BASE_URL/api/..." -H 'content-type: application/json' -d '{...}'
# check "rejects bad input"  '422'       -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/..." -H 'content-type: application/json' -d '{"amount":"abc"}'

echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
