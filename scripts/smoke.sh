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
check "backend health"    '"status":"ok"'          "$BASE_URL/api/health"
check "mongo reachable"   '"db":"ok"'              "$BASE_URL/api/health"
check "frontend is up"    "Анализ оргструктуры"     "$BASE_URL/"
check "unknown api route" '"not_found"'             "$BASE_URL/api/does-not-exist"

# --- document extraction (Word/PDF/Excel -> fragments with sources) ----------
# A one-page PDF with a text layer, generated here so no binary fixture is needed.
# The xref table is omitted on purpose: the parser recovers by scanning objects.
tiny_pdf() {
  local content='BT /F1 12 Tf 72 720 Td 14 TL (1. Procurement planning.) Tj T* (2. Tenders.) Tj ET'
  printf '%%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'
  printf '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n'
  printf '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n'
  printf '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n'
  printf '5 0 obj << /Length %d >> stream\n%s\nendstream endobj\n' "${#content}" "$content"
  printf 'trailer << /Root 1 0 R >>\n%%%%EOF\n'
}
CURL_STDIN=(docker run --rm -i --add-host=host.docker.internal:host-gateway curlimages/curl:8.10.1 -sS --max-time 30)
check_upload() { # name, expected-substring, filename, content-producing command
  local name="$1" expect="$2" filename="$3"; shift 3
  local out
  if out="$("$@" | "${CURL_STDIN[@]}" -w ' %{http_code}' -F "file=@-;filename=$filename" "$BASE_URL/api/documents/extract" 2>&1)" \
     && grep -q -- "$expect" <<<"$out"; then
    echo "  ok    $name"; pass=$((pass + 1))
  else
    echo "  FAIL  $name"; echo "        got: ${out:0:300}"; fail=$((fail + 1))
  fi
}
check_upload "extract pdf clauses"      '"ref":"п. 2, стр. 1, строка 2"' order.pdf tiny_pdf
check_upload "reject unsupported type"  '"unsupported_format"'            notes.txt echo "plain text"
check "reject missing file" '400' -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/documents/extract"

# --- main scenario (fill in once the API exists) -----------------------------
# check "main scenario"      '"result"'  -X POST "$BASE_URL/api/..." -H 'content-type: application/json' -d '{...}'
# check "rejects bad input"  '422'       -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/..." -H 'content-type: application/json' -d '{"amount":"abc"}'

echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
