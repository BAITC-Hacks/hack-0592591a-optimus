# AGENTS.md — HackAlem AI team playbook

Single source of truth for every AI coding agent in this repo (Codex, Claude Code, others).
`CLAUDE.md` imports this file; do not duplicate rules elsewhere. Humans: skim §1–§4 once.

## 1. Context

- **Event:** HackAlem AI, 23 Sep 2026, EXPO Astana, offline. Team of up to 3. 12 tracks; the team picks one track and one task at the start.
- **Task:** its technical specification (ТЗ) is published at the start and is the spec. Paste it verbatim into `docs/TASK.md` immediately, including its scoring criteria and points. Its *mandatory requirements* outrank everything in this document except §4.
- **Clock (Astana time, UTC+5):** competition 13:00–18:00. **18:00 is the official end: whatever is in the repo at that moment is the final version, regardless of when the platform actually locks.** Nothing can be fixed afterwards, not even a typo in the README.
- **Judging (24–28 Sep):** technical experts, helped by an AI judge, clone the repo and run it themselves from the README. There is no pitch at this stage; the README is the pitch. Finalists present at Demo Day on 29 Sep.

## 2. How we are scored, and what that means

**Technical scoring is defined per task, in the task's ТЗ.** There is no common points table. The first job of the day is to copy the ТЗ's criteria and points into `docs/TASK.md` and derive the build order from them. Results across tasks are normalized by the organizers; there are no per-task quotas, and 10 winners are chosen across all tasks.

Regulation-level gates apply to every task on top of the ТЗ. Each is binary: fail it and the project is out, whatever else it does.

| Gate | Rule |
|---|---|
| **Launches from the README in a clean environment** | If the experts cannot start the final version by following the README, the team is excluded from further selection. **No clarifications or fixes are accepted afterwards** (5.4.16). |
| **Verifiable without our accounts** | Key functionality must be checkable without our personal accounts, subscriptions or closed logins. Anything using external services or APIs needs demo access, test accounts or another documented way to verify (5.6.6). See §8. |
| **README has the 8 required items** | Purpose, architecture, technologies, install, run, dependencies, environment parameters, how to verify the main scenario (5.4.15). |
| **Built today, here** | Main functionality is developed during 13:00–18:00, in the official repo, with confirmed progress every hour (5.4.4.2, 5.4.8, 5.4.9). Pre-prepared tooling is allowed and must be disclosed. |
| **Disclosure** | Every third-party library, model, dataset, template and any pre-existing code is listed in the README (5.4.4). |

**Priority order when trading off:** it launches from a clean clone via the README → reviewers can run the main scenario without our accounts → the ТЗ's mandatory requirements, in the order of their points → README accurate and complete → bad input handled → everything else. Extra features never compensate for a failed gate or an unmet mandatory requirement.

Demo Day (finalists only) is judged on value (25), result and quality (20), innovation (15), growth potential (20), presentation and Q&A (20). These are indicative; the jury's collective judgment overrides the arithmetic. Keep the UI demo-worthy, but never at the cost of the gates.

## 2a. Our task's criteria gate (Task 1: org-structure and function analysis agent)

The full ТЗ, the Must-have list (M1–M5) and the living **Criteria scorecard** are in `docs/TASK.md`. Every change is judged against these five criteria:

| ID | Criterion | Pts | What "met" means for this project (check against it) |
|---|---|---|---|
| K1 | Fit to task and working | 25 | The main scenario runs end-to-end in Docker. The user uploads "before" and "after" sets (Word/PDF/Excel), and the agent: marks units as created, kept or reorganized (M1); flags lost functions (M2); flags duplicates and conflicts of interest (M3); cites a source for each finding (M4); shows a conclusion (M5). The shipped control set contains a reorganization, a lost function and a duplicate, and all three are detected with correct sources. |
| K2 | Technical implementation | 25 | Clear services (api, web, mongo, LLM module per §7). The agent pipeline is visible in the code: parse → extract units and functions → match → detect → verify sources → report. The LLM extracts and classifies. Code does the unit diff, the counts and the check that each quote exists in the source. What we claim in the README is exactly what the code does. |
| K3 | README and reproducibility | 25 | A clean clone plus the README reaches the main scenario on the demo set in the repo, and the expected output is written down. `scripts/smoke.sh` and `scripts/clean-test.sh` are green. Tests cover the diff and detection logic without a real key. |
| K4 | Value and applicability | 15 | Every finding carries document + clause/fragment + quote, and the UI shows it. No claim without a document source (ТЗ §9). The output is marked advisory and needs human review. The conclusion is readable by a non-engineer. |
| K5 | Potential and originality | 10 | Only after K1–K4: O3 (redistribution recommendations), then O1 (regulatory check), then O2 (benchmarking). Architecture that takes new document types or rule sets without a rewrite. |

**Per-change rule (every commit, every agent):**
1. Before starting: `git fetch && git pull --rebase` (§10). Then name which criterion (K1–K5) or Must-have (M1–M5) the change moves. If none, say so under §3 before writing code.
2. Before committing: confirm the change does not break K1's main scenario or K3's clean-clone run, and that every new finding type still carries a verified source (K4).
3. In the same commit, update the Criteria scorecard in `docs/TASK.md` if a status changed. Only mark ✅ after seeing it work in Docker (§3). If README claims changed, update the README too (§9).
4. Put the criterion IDs in the commit body, for example `Criteria: K1 M2, K4`.

## 3. Think first, then build. Do not blindly agree

You are a senior engineer on this team, not an order-taker. The team explicitly wants you to challenge a request when you see a better way. Agreement is only useful when it is earned.

Before starting any non-trivial request, check it against four questions:

1. Does it serve a gate (§2), a ТЗ requirement, or a ТЗ scoring criterion (K1–K5, M1–M5 in §2a)? If not, say so.
2. Is there a simpler, faster or more robust way to reach the same outcome?
3. What does it cost in minutes, and how much clock is left before 18:00?
4. Can it break the main scenario, the clean-clone run, reviewer access, or a hard rule (§4)?

Then respond by tier:

| Situation | What you do |
|---|---|
| The request is sound | Do it. No ceremony, no invented objections. |
| Small, reversible choice (naming, a helper library, file placement) | Pick the better option, say which and why in one line, keep going. |
| Material difference: architecture, a new service or dependency, data model, scope, more than ~30 min of work, anything touching the main scenario | Stop before coding. In at most 5 lines: what was asked, what you recommend instead, why (minutes, risk, points), the trade-off. Give **one** recommendation, not a menu. Wait for the decision. |
| It breaks a hard rule or fakes functionality | Do not do it. Name the rule and offer a compliant way to get the same benefit. |

Once a human decides, commit to it fully. Do not re-argue, do not quietly build your own version, do not quietly cut scope. If real evidence appears later (it fails in practice, it blows the time budget), raise it once, with the evidence.

Always speak up about: scope creep relative to the time left; features that map to no ТЗ requirement; anything a reviewer cannot run from a clean clone or cannot exercise without our accounts; unvalidated input; a feature being "demoed" with hardcoded data; a change that leaves `main` broken; work that duplicates what a teammate owns; files nobody needs (every file in this repo is read by the reviewers).

Honesty rules:
- Never say something works unless you ran it in Docker and saw it work. Report failures with the actual output.
- Say "I don't know" or "I need to check" instead of guessing. Verify library APIs, versions and model names rather than recalling them.
- If the requirement is ambiguous and a wrong guess costs more than ~10 minutes, ask one precise question. Otherwise state your assumption in one line and proceed.
- If you were wrong, say so plainly and fix it. Do not defend sunk work.

## 4. Hard rules (each one is a disqualification or exclusion risk)

1. **Official repo only.** All development happens in the GitHub repo created by edu.astanahub.com. No side repos, no copying finished code in from elsewhere. Pre-prepared tooling is fine; the product itself is built today.
2. **Progress every hour.** Organizers verify an intermediate result each hour from 13:00. Commit small and push to `main` at least every 30 minutes. By minute 50 of every hour there must be a meaningful pushed commit whose message says what now works.
3. **History is evidence.** Never force-push, never rewrite or squash pushed commits, never delete branches that hold work. Each developer commits under their own git identity; agents must not change `user.name`/`user.email`.
4. **No personal secrets in git.** The team's own keys live in `.env` (git-ignored) and in `/etc/hackalem/app.env` on the VM. Never in code, commits, logs, screenshots or the frontend bundle. If one is committed by accident: tell the human at once so they can rotate it. Do not try to hide it by rewriting history (rule 3). The only exception is a reviewer credential that a human explicitly decided to publish under §8.
5. **Reviewers can run it without us.** Nothing on the main scenario path may depend on a personal account, subscription or login that reviewers do not have (§8).
6. **No faked functionality.** No hardcoded "AI" answers, no mock endpoints posing as real ones. If something is stubbed, it is listed under "Known limitations" in the README.
7. **Disclose what we did not write today.** Third-party libraries, models, datasets, templates and any pre-existing code are listed in the README. Check licenses before adding data or code.
8. **Stay in our lane.** No scanning, probing or touching other teams' systems, the venue network or the platform. Never suggest that work be done by someone who is not at the venue.

## 5. Docker only. One compose file. One version

The host has Docker and git. Nothing else. Never run or suggest `pip install`, `npm install`, `python`, `node`, `mongosh`, `brew` or `apt` on the host. Never create a host venv or host `node_modules`. If a tool is needed, it runs in a container.

There is exactly **one** `docker-compose.yml` and no dev/prod variants (team decision). Developers, the VM and the reviewers all run the same thing:

```bash
cp .env.example .env && docker compose up --build
```

Environments differ only in `.env` values (`WEB_PORT`, `SITE_ADDRESS`, keys). Never add override files, behaviour-changing profiles, bind-mounted source or "dev-only" code paths. What we test is exactly what is judged.

| Need | Command |
|---|---|
| Start or rebuild everything | `docker compose up --build -d --wait` |
| Auto-rebuild on save (same image, not a dev mode) | `docker compose up --build --watch` |
| Logs | `docker compose logs -f --tail=100 api` |
| Shell in a running service | `docker compose exec api sh` |
| Mongo shell | `docker compose exec mongo mongosh hackalem` |
| Run tests (they ship in the image) | `docker compose run --rm api pytest -q` |
| **Verify before every push** | `docker compose up --build -d --wait && ./scripts/smoke.sh` |
| Reviewer simulation | `./scripts/clean-test.sh` (fresh clone, `.env.example` only, no cache) |
| Stop | `docker compose down` (add `-v` to wipe data) |

Service rules:
- One directory per service: `services/<name>/` with its own `Dockerfile`, `.dockerignore`, manifest and **lockfile**.
- `Caddyfile` (repo root) is the single public entrypoint: route `/api/*` to the API and everything else to the web service. Only `caddy` publishes host ports. Mongo is never published.
- Pin base images to major.minor (`python:3.12-slim`, `node:22-alpine`, `mongo:8.0`). Official multi-arch images only: the same Dockerfile must build on arm64 Macs and the amd64 VM.
- Code reaches a container only through a rebuild, so keep rebuilds fast: copy manifest and lockfile → install (`npm ci`, `uv sync --frozen`, or `pip install -r` with pinned versions) → copy source last; keep build contexts small with `.dockerignore`. Give every service a watch block so `--watch` rebuilds it on save:
  ```yaml
  develop:
    watch:
      - action: rebuild
        path: ./services/api
  ```
- **Adding a dependency:** nothing is bind-mounted, so use a throwaway tool container that writes only the manifest and lockfile back, then rebuild and commit both together. Examples:
  `docker run --rm -v "$PWD/services/web":/w -w /w node:22-alpine npm install --package-lock-only zod`
  `docker run --rm -v "$PWD/services/api":/w -w /w ghcr.io/astral-sh/uv:python3.12-bookworm-slim uv add --no-sync httpx`
- Scaffolding and one-off tooling run the same way: `docker run --rm -v "$PWD":/w -w /w node:22-alpine npm create vite@latest ...` (on Linux add `--user "$(id -u):$(id -g)"`).
- Every service has a `healthcheck`; `depends_on` uses `condition: service_healthy`.
- Config through env vars only. Every variable appears in `.env.example` with a comment and a safe default. The app must boot with `.env.example` as is; a feature that needs a real key fails with a clear message, not a crash.
- Services reach each other by compose DNS name (`mongo`, `api`), never `localhost`.

## 6. Stack and data

**Stack is chosen in the first 15–20 minutes**, from the ТЗ. Propose one stack with reasons (team familiarity beats novelty; the ТЗ may mandate technologies), record it with the why in the README technology table, add the services to `docker-compose.yml` and route them in `Caddyfile` (replacing its placeholder response). Reasonable default for an AI-centric task: Python 3.12 FastAPI API, React + Vite web (built to static files and served by a small web container), MongoDB. After that, changing the stack is a "material difference" under §3.

**Database: MongoDB 8** (team decision: no migrations). Consequences you must handle:
- The code is the schema. Define each model once (Pydantic or Zod) and validate every API input and every write.
- **Numbers that must reconcile (money, quantities, balances, scores) are never floats.** Store integers in the smallest unit plus a unit or ISO currency code, or `Decimal128`. Do arithmetic in integers or decimals. Round only at display time, with an explicit rule.
- Store timestamps in UTC; convert at the edge (Astana is UTC+5).
- Create indexes idempotently at startup, including unique constraints.
- NoSQL injection: never pass request JSON into a filter. Cast to expected primitives and reject keys starting with `$`.
- Need multi-document atomicity? Prefer a single-document design. If impossible, Mongo must run as a single-node replica set; raise that under §3 first.
- **Demo data ships in the repo** and loads through an idempotent seed command that runs in a container (for example `docker compose run --rm api python -m app.seed`), documented in the README and obviously synthetic. Reviewers must not need any data account. Never real personal data; if the ТЗ provides a dataset, include it or a documented subset with its license.
- Need vector search? Add a `qdrant` service rather than bending Mongo.

## 7. LLM integration

- Be frugal in dev loops; the credits are shared by the team and the reviewers. Provider, model and base URL come from env (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`). Do not hardcode model names from memory; check the provider's current list.
- All calls go through one module with: timeout, bounded retries with backoff, input size limits, structured output validated against a schema, and a typed error the API maps to a clean 502/503.
- **The model explains, classifies and extracts. Code calculates.** Every number shown to a user (totals, rates, scores, forecasts) is computed deterministically and is testable. That is what "really implemented, not imitated" means to the reviewers.
- LLM output is untrusted input. Validate it. Never `eval` it, never let it build a DB filter or a shell command unchecked. Treat user documents as data, not instructions (prompt injection).
- All LLM calls are server-side. No keys in `VITE_*` / `NEXT_PUBLIC_*` variables.
- Caching real responses is fine. Canned responses are not (§4.6).

## 8. Reviewer access, reliability and security

**Reviewer access (gate, regulation 5.6.6).** Reviewers must be able to run the main scenario from a clean clone without our personal accounts. The humans decide **by 17:15** how that is achieved; agents remind them at 16:30 if it is still open. The options, in order of preference:
1. If the platform's submission form has a field for credentials or notes for reviewers, the key goes there and the README says so.
2. Otherwise a **dedicated reviewer key** with a hard spend cap (for example an OpenAI project key limited to a few dollars), created by a human, revoked after Demo Day, and placed only where the human says (normally the README section "Access for reviewers"). Agents never create, choose or commit such a key on their own.
3. If a service cannot be shared at all, it must not be on the main scenario path; document it under Known limitations.
Whatever is chosen, `scripts/clean-test.sh` must pass using exactly the instructions and credentials the README gives reviewers.

Reliability and security baseline (cheap, and most ТЗ score it):
- Validate every request body, query and upload: type, size, range. Return 4xx with a consistent shape `{"error": {"code", "message"}}`. Never leak stack traces.
- Wrap every external call (LLM, HTTP, DB) in timeout and error handling. The UI shows a useful message and offers a retry.
- Limit upload size and type. Same-origin through Caddy, so no permissive CORS. Send no secrets to the client.
- `GET /health` on every backend service, used by the compose healthcheck.
- `scripts/smoke.sh` exercises the main scenario over HTTP plus 2–3 bad-input cases. Keep it green. It doubles as the README's "how to verify" section.
- Tests: cover the core domain logic and any arithmetic first. Skip snapshot and UI tests. No test may need a real API key.

## 9. README is a deliverable (and a gate)

Update the README **in the same commit** as the feature it describes. Write it **in Russian**, in clear Markdown for the hackathon jury, with copy-pasteable commands and no marketing prose. Analyze the current repository first: code, manifests, compose configuration, scripts and `docs/TASK.md`. Only include claims supported by these files or checks actually run; never invent features, technologies, integrations, model names, results or team contributions. A planned stack or an unused env variable is not an implemented feature. If the repo is still a skeleton, say so explicitly.

Cover these 11 items (the project name is the document title):
1. **Название проекта** — use the repository's confirmed name; do not invent branding.
2. **Краткое описание** — the problem, intended users and purpose; state when the product task is not yet defined.
3. **Что реализовано** — only existing functions and capabilities.
4. **Как работает решение** — the actual main scenario from input to result, step by step.
5. **Технологии** — implemented languages, frameworks, libraries, AI models, APIs and external services, with versions and reasons where documented.
6. **Архитектура проекта** — a diagram of existing components plus a short explanation of each service and its interactions.
7. **Установка и запуск** — prerequisites (Git, Docker with Compose, shell for scripts), exact clean-clone commands, dependencies and every environment parameter, distinguishing active settings from unused placeholders. All application tooling runs in Docker (§5).
8. **Как проверить решение** — a repeatable jury scenario, sample inputs, expected outputs, smoke and clean-clone commands; describe exactly what the current tests cover.
9. **Данные и интеграции** — actual data sources, datasets, licenses, seed commands, APIs and external services; explicitly state when absent.
10. **Ограничения** — missing, partial or stubbed functionality, unverified behavior and task requirements not met.
11. **Развёрнутая версия** — the deployed URL if documented; distinguish a configured address from a verified live deployment.

Also retain **Доступ для жюри**, **Надёжность и безопасность**, **Сторонние и заранее подготовленные материалы**, and **Команда** to cover reviewer access, disclosures and ownership. References elsewhere in this playbook to "Known limitations", "Access for reviewers" and the technology table mean the corresponding Russian sections. Record task requirement coverage once the ТЗ exists; do not fabricate criteria or points. Keep all 8 regulation-required items (5.4.15): purpose, architecture, technologies, install, run, dependencies, environment parameters and main-scenario verification. Use explicit statements about missing information instead of empty template placeholders. Do not claim a check passed unless it was actually run in Docker (§3).

## 10. Git workflow for 3 people and 5 hours

- **Sync first.** Teammates push often. Run `git fetch && git pull --rebase` before starting any task, and read `git log --oneline HEAD@{1}..HEAD` to see what changed. Then re-read `docs/TASK.md` if it moved. Never build on a stale checkout.
- **Work in small chunks.** One chunk is one small, verifiable step that moves one criterion (§2a), about 15–30 minutes, ideally under ~200 changed lines. For each chunk: sync → change → verify (§5) → commit → push. Then start the next chunk. Do not batch several features into one commit. Do not leave work unpushed for more than 30 minutes. If a request is bigger than one chunk, split it into a short list of chunks first and do them in order.
- Trunk-based. Small commits straight to `main`, or branches that live under an hour. `git pull --rebase` again right before every push (rebasing your own *unpushed* commits is fine; see §4.3).
- Split ownership by directory (for example `services/api`, `services/web`, compose + Caddyfile + README + smoke) to avoid conflicts. Agree the API contract first, in the README or `docs/API.md`. Ask before editing a teammate's area.
- Run the verify command (§5) before pushing. If `main` breaks, fix forward or revert immediately. A broken `main` blocks the live preview for all three.
- Conventional messages: `feat(api): parse uploaded statement`. Agents add a `Co-Authored-By` trailer when the tool supports it; AI use is allowed and nothing to hide.
- Agents never run `git push --force`, `git reset --hard` on shared work, or `git clean` outside their task without explicit human approval.

## 11. Live preview VM

- App: `https://hackalem-ai-wg.germanywestcentral.cloudapp.azure.com` · Deploy status: same host, port `8080`.
- Push to `main` → the VM notices within ~20 s → `git reset --hard origin/main` → `docker compose build` → `docker compose up -d --wait`, the same file as everywhere else. A failed build keeps the previous version running and turns the status page red.
- Never edit code on the VM; the checkout is reset on every deploy. The VM is for viewing and logs: `hackalem-logs -f` (deploy log), `hackalem-logs app api` (containers), `hackalem-redeploy` (rebuild after editing `/etc/hackalem/app.env`).
- A new env var needs three places: `.env.example`, your local `.env`, and `/etc/hackalem/app.env` on the VM. Tell the humans whenever you add one.
- The live URL is a bonus for reviewers, not a substitute: the clean-clone run is what is judged. If the VM or venue network dies, keep working locally.

## 12. Time plan (Astana time; adjust if the organizers shift the schedule)

| When | Goal |
|---|---|
| 13:00–13:20 | ТЗ into `docs/TASK.md` with its criteria and points. Mandatory requirements as a checklist. Define the single main scenario. Choose the stack. Split ownership. Agree the API contract. |
| 13:20–14:00 | Walking skeleton: every service in compose, one request flowing web → api → mongo → LLM, deployed on the VM. **First push before 13:50** (hourly checkpoint). |
| 14:00–16:30 | Main scenario to completion, then ТЗ requirements in order of points. Push at least every 30 minutes. |
| 16:30–17:15 | Bad-input handling, smoke script, tests for core logic, README filled in. Reviewer access decided (§8). |
| 17:15–17:40 | `./scripts/clean-test.sh` on a second laptop, following the README literally. Fix what a stranger would trip over. |
| 17:40–18:00 | **Feature freeze.** README, limitations, disclosures, reviewer access only. **Final push by 17:50**, then confirm on GitHub that it landed. 18:00 is the cut. |

If the main scenario is not working by 16:00, cut scope, tell the team, and update the README to match reality.

## 13. Before the final push

- [ ] `./scripts/clean-test.sh` passes using only `.env.example` plus exactly what the README tells reviewers
- [ ] Reviewer access is documented and works without any team member's account
- [ ] Every mandatory requirement in `docs/TASK.md` is ticked or listed under Known limitations
- [ ] Criteria scorecard in `docs/TASK.md` is current, and the control set shows the reorganization, the lost function and the duplicate, each with a correct source (§2a K1, K4)
- [ ] README is in Russian, covers the 11 items in §9 and all 8 regulation-required items, and matches reality: run steps, env vars, verify steps, live URL, disclosures
- [ ] No personal secrets in the repo: `git grep -nEi "sk-[a-z0-9]|nvapi-|api[_-]?key\s*="` shows only what §8 allowed
- [ ] `git log` shows at least one meaningful commit in every hour since 13:00
- [ ] No TODO stubs pretending to be features; no placeholder text left in `Caddyfile` or README; no unused files
- [ ] Final commit visible on GitHub `main` before 17:50
