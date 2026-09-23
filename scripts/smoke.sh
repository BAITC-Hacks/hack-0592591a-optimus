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

# --- authentication (signup, login, session cookie, bad input) ---------------
# A fixed synthetic account: the first run registers it, later runs get 409.
AUTH_EMAIL="smoke@example.com"; AUTH_PASS="smoke-pass-123"
JSON=(-H 'content-type: application/json')
check_re() { # like check, but the expectation is an extended regex
  local name="$1" expect="$2"; shift 2
  local out
  if out="$("${CURL[@]}" "$@" 2>&1)" && grep -q -E -- "$expect" <<<"$out"; then
    echo "  ok    $name"; pass=$((pass + 1))
  else
    echo "  FAIL  $name"; echo "        got: ${out:0:300}"; fail=$((fail + 1))
  fi
}
check_re "signup (or already registered)" "\"email\":\"$AUTH_EMAIL\"|\"email_taken\"" \
  -X POST "$BASE_URL/api/auth/signup" "${JSON[@]}" -d "{\"name\":\"Smoke\",\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\"}"
check "login"                  "\"email\":\"$AUTH_EMAIL\"" \
  -X POST "$BASE_URL/api/auth/login" "${JSON[@]}" -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\"}"
check "reject wrong password"  '"invalid_credentials"' \
  -X POST "$BASE_URL/api/auth/login" "${JSON[@]}" -d "{\"email\":\"$AUTH_EMAIL\",\"password\":\"wrong-password\"}"
check "reject invalid signup"  '"validation_error"' \
  -X POST "$BASE_URL/api/auth/signup" "${JSON[@]}" -d '{"name":"","email":"not-an-email","password":"short"}'
check "me requires session"    '"unauthorized"' "$BASE_URL/api/auth/me"
# Log in and reuse the httpOnly cookie for /me, both inside one curl container.
login_then_me="curl -sS --max-time 15 -c /tmp/jar -o /dev/null -X POST -H 'content-type: application/json' \
  -d '{\"email\":\"$AUTH_EMAIL\",\"password\":\"$AUTH_PASS\"}' '$BASE_URL/api/auth/login' \
  && curl -sS --max-time 15 -b /tmp/jar '$BASE_URL/api/auth/me'"
if out="$(docker run --rm --add-host=host.docker.internal:host-gateway --entrypoint sh curlimages/curl:8.10.1 -c "$login_then_me" 2>&1)" \
   && grep -q -- "\"email\":\"$AUTH_EMAIL\"" <<<"$out"; then
  echo "  ok    me with session cookie"; pass=$((pass + 1))
else
  echo "  FAIL  me with session cookie"; echo "        got: ${out:0:300}"; fail=$((fail + 1))
fi
check "demo account login"     '"email":"demo@example.com"' \
  -X POST "$BASE_URL/api/auth/login" "${JSON[@]}" -d '{"email":"demo@example.com","password":"demo12345"}'

# --- main scenario: demo analysis (docs/TASK.md §2, §7, §9) --------------------
# Runs the bundled ред. 8 / ред. 9 pair through the whole pipeline, polls until
# done (2–4 minutes with a real model) and checks the control set: created units,
# the lost function 5.6.2 and the duplicate 5.4.3 / 5.5.8, each with its source.
# Without a configured model (.env.example as is) the API must answer 503
# llm_unavailable; the control-set checks are then reported as skipped.
report() { # name, ok(0/1), output
  if [ "$2" -eq 0 ]; then echo "  ok    $1"; pass=$((pass + 1)); else echo "  FAIL  $1"; echo "        got: ${3:0:300}"; fail=$((fail + 1)); fi
}
health="$("${CURL[@]}" "$BASE_URL/api/health" 2>&1)"
if grep -q '"llm":"configured"' <<<"$health"; then
  out="$("${CURL[@]}" -w ' %{http_code}' -X POST "$BASE_URL/api/analyses/demo" 2>&1)"
  ANALYSIS_ID="$(grep -oE 'a_[0-9a-f]{12}' <<<"$out" | head -1)"
  [ -n "$ANALYSIS_ID" ] && grep -q ' 202$' <<<"$out"; report "demo analysis queued (202)" $? "$out"
  status=""
  for _ in $(seq 1 "${ANALYSIS_TIMEOUT:-360}"); do
    out="$("${CURL[@]}" "$BASE_URL/api/analyses/$ANALYSIS_ID" 2>&1)"
    status="$(grep -oE '"status":"[a-z]+"' <<<"${out:0:400}" | head -1)"
    case "$status" in *done*|*failed*) break ;; esac
    sleep 2
  done
  [ "$status" = '"status":"done"' ]; report "demo analysis done" $? "$(grep -o '"error":{[^}]*}' <<<"$out")"
  grep -q '"clause_id":"5.6.2","parent_id":"5.6"' <<<"$out" && grep -q '"ref":"п. 5.6.2, стр. 10, строки 11–12"' <<<"$out"
  report "demo clause 5.6.2 with its source" $? "${out:0:300}"
  py='import json,sys
d=json.load(sys.stdin); f=d.get("findings",[]); u={x["unit_id"]:x for x in d.get("units",[])}
created={ (u[c["after"]].get("abbr") or u[c["after"]]["name"]) for c in d.get("unit_changes",[]) if c["status"]=="created"}
reorg=[c for c in d.get("unit_changes",[]) if c["status"]=="reorganized"]
loss=[x for x in f if x["type"]=="POTENTIAL_LOSS" and any(c["clause_id"]=="5.6.2" and c["side"]=="before" for c in x["citations"])]
dup=[x for x in f if x["type"]=="POTENTIAL_DUPLICATION" and {c["clause_id"] for c in x["citations"]}=={"5.4.3","5.5.8"}]
conf=[x for x in f if x["type"]=="POTENTIAL_CONFLICT" and any(c["clause_id"]=="5.5.2" for c in x["citations"])]
quoted=all(c.get("quote") for x in f for c in x["citations"])
print("created", "ok" if {"ДИТААД","ДОА"}<=created else "FAIL "+str(sorted(created)))
print("reorganized", "ok" if reorg else "FAIL none")
print("loss", "ok" if loss and loss[0]["citations"][0]["quote"].startswith("формировать группы контроля качества") else "FAIL")
print("dup", "ok" if dup else "FAIL")
print("conflict", "ok" if conf else "FAIL")
print("quotes", "ok" if quoted and d["stats"].get("dropped_unverified")==0 else "FAIL")
print("conclusion", "ok" if "рекомендательный характер" in d.get("conclusion_md","") else "FAIL")
s=d.get("stats",{}); r=d.get("regulatory",[])
sourced=all(x["citations"][0].get("quote") and x["norm"].get("quote") and (x["norm"]["origin"]!="corpus" or x["norm"]["source_url"].startswith("https://adilet.zan.kz/")) for x in r)
print("regulatory", "ok" if s.get("regulatory_status")=="ok" and s.get("regulatory_norms")==477 and sourced else "FAIL "+str(s.get("regulatory_status"))+" "+str(s.get("regulatory_norms")))'
  verdict="$(printf '%s' "$out" | docker run --rm -i python:3.12-slim python -c "$py" 2>&1)"
  for key in created reorganized loss dup conflict quotes conclusion regulatory; do
    line="$(grep -E "^$key " <<<"$verdict")"
    case "$key" in
      created)      name="control set: units ДИТААД and ДОА created" ;;
      reorganized)  name="control set: a unit reorganized into successors" ;;
      loss)         name="control set: POTENTIAL_LOSS at до п. 5.6.2 with its quote" ;;
      dup)          name="control set: POTENTIAL_DUPLICATION после п. 5.4.3 / 5.5.8" ;;
      conflict)     name="control set: POTENTIAL_CONFLICT cites после п. 5.5.2" ;;
      quotes)       name="every finding has a verified quote" ;;
      conclusion)   name="conclusion carries the advisory disclaimer" ;;
      regulatory)   name="O1: legislation check ran on 477 norms; every finding has both quotes and an adilet link" ;;
    esac
    grep -q " ok$" <<<"$line"; report "$name" $? "$line"
  done
else
  echo "  skip  demo analysis and control set: LLM not configured (set OPENAI_API_KEY and LLM_MODEL in .env)"
  check "demo analysis without a model answers 503 llm_unavailable" '"llm_unavailable"' -X POST "$BASE_URL/api/analyses/demo"
fi
out="$(echo "plain text" | "${CURL_STDIN[@]}" -o /dev/null -w '%{http_code}' -F "before=@-;filename=notes.txt" -F "after=@-;filename=notes.txt" "$BASE_URL/api/analyses" 2>&1)"
[ "$out" = "415" ]; report "analysis rejects unsupported type (415)" $? "$out"
out="$(tiny_pdf | "${CURL_STDIN[@]}" -w ' %{http_code}' -F "before=@-;filename=order.pdf" "$BASE_URL/api/analyses" 2>&1)"
grep -q '"missing_side".* 422$' <<<"$out"; report "analysis rejects a missing side (422)" $? "$out"
check "unknown analysis id (404)" '"not_found"' "$BASE_URL/api/analyses/a_000000000000"

echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
