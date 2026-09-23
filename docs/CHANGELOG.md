# Changelog (team work log)

This is an append-only log, so the three of us and our agents know what is done, what is claimed and what is blocked. `git log` stays the evidence of the work itself. This file adds the claims and blockers that git cannot show. The rules are in AGENTS.md §10.

One line per event, newest at the bottom. Never edit, reorder or delete earlier lines:

`- HH:MM · who · status · what now works (or what is being taken) · criteria · commit`

- `HH:MM` is Astana time.
- `who` is the person and the agent, e.g. `kairadio/Claude`.
- `status` is one of:
  - `start`: a claim. Name the files or area.
  - `done`: the work is pushed.
  - `blocked`: say on what.
  - `drop`: the claim is released.
- `commit` is optional. A `done` line goes into the same commit as its work, so `git log -S "<what>" -- docs/CHANGELOG.md` finds it.
- `.gitattributes` sets `merge=union` on this file, so concurrent appends never conflict. After a rebase, lines can land slightly out of time order. That is expected.

Lines up to 15:15 were reconstructed from `git log`. The agent comes from each commit's Co-Authored-By trailer. The criteria come from the commit's `Criteria:` line where it had one, and otherwise were mapped from the subject.

## Log

- 13:22 · Khazretsultan/Codex · done · Russian README and agent guidance aligned with the jury requirements · K3 · a5c6dcb
- 13:52 · Khazretsultan/Claude · done · ТЗ, criteria gate and chunked workflow in `docs/TASK.md` and AGENTS.md · K3 · f55f49a
- 13:54 · Khazretsultan/Claude · done · Express API skeleton served at `/api` via Caddy · K2 · d46ca9e
- 13:57 · Khazretsultan/Claude · done · Vue 3 + Vite app served by Caddy · K2 · 0e3415c
- 14:02 · Khazretsultan/Codex · done · Caddy routing rebuilt on deploy; Vue replaces the placeholder · K3 · 56491d3
- 14:13 · Khazretsultan/Claude · done · extractor service: Word/PDF/Excel into located fragments · K2 M4 · 10667ca
- 14:17 · kairadio/Claude · done · backend connects to MongoDB and reports it in `/api/health` · K2 · 3e046d5
- 14:18 · Khazretsultan/Claude · done · `POST /api/documents/extract` through the extractor client · K2 · 6c04e28
- 14:28 · kairadio/Claude · done · architecture spec: 5-module pipeline, rules, control set (`docs/TASK.md`) · K2 K3 · e053c52
- 14:31 · kairadio/Claude · done · email/password signup and login with a session cookie · — · 8c70e78
- 14:32 · kairadio/Claude · done · spec: clause parsing on the extractor; auth and extractor facts · K2 · 8a7fd93 06cb6b0
- 14:39 · Khazretsultan/Claude · done · extractor sub-items carry `marker`, same for docx and pdf · K2 M4 · ee2895b
- 14:41 · Khazretsultan/Claude · done · AGENTS.md §7a: regulatory corpus tool (adilet.zan.kz via ereestr.kz) · K5 O1 · 4587a19
- 14:43 · Khazretsultan/Claude · done · extractor parses off the event loop · K2 · e83038d
- 14:47 · Khazretsultan/Codex · done · spec: conflict detection is never cut (M3) · K1 M3 · a5ff63a
- 14:50 · Khazretsultan/Codex · done · extractor keeps Word numbering overrides in source refs · K2 M4 · cf44f85
- 14:51 · kairadio/Claude · done · demo account seeded at startup and documented for the jury · K3 · 2fe513f
- 14:52 · Khazretsultan/Codex · done · test: `/health` stays responsive while a document is parsed · K2 K3 · 0f1a531
- 14:54 · Khazretsultan/Codex · done · README auth commands safe to copy into shells · K3 · 5bde386
- 14:55 · bolatashim/Cursor · done · Kazakhtelecom-styled design system and auth screen · K4 K3 · 1cd447b
- 14:56 · Khazretsultan/Codex · done · supplied anonymized before/after PDFs shipped in `services/backend/demo/` · K1 K3 · f0eaccc
- 14:58 · bolatashim/Cursor · done · AGENTS.md §6a: design system mandatory for UI work · K4 · d9c616f
- 15:02 · kairadio/Claude · done · spec: embedding fallback before the LLM judge, advisory labels, overlap vs duplication, LLM-reviewed conflicts · K2 M2 M3 · 4b72e48 5ccdd87
- 15:03 · kairadio/Claude · done · `EMBEDDING_MODEL` in `.env.example` · K2 · d52c905
- 15:15 · kairadio/Claude · done · compose passes LLM and embedding env vars to the backend · K2 · a4c4cba
- 15:17 · Khazretsultan/Claude · done · spec: O1 today on a parallel track (§12a), O2 dropped; AGENTS.md §7a fixes; this changelog · K5 O1, K3
- 15:19 · Khazretsultan/Claude · start · `pipeline/clauses.js` (+ `test/clauses.test.js`), `routes/analyses.js` (POST /api/analyses with before/after/regulations, /demo, GET /:id; 415/413/422 before 202), smoke demo run · K1 M1 M4, K3
- 15:31 · Khazretsultan/Claude · done · pipeline stage 1 `clauses.js`: fragments → clauses (glued ids, sub-items `5.3.2.а`, page numbers, TOC tail); `node --test` in the backend image · K1 M4, K3
- 15:23 · kairadio/Claude · start · `src/llm.js`, `src/schemas.js`, `src/prompts/*.md`, `pipeline/{structure,extract,compare,report}.js` + `pipeline/run.js` (runner the analyses route calls), `test/compare.test.js`; then the results UI in `services/frontend` (upload → progress → tabs) · K1 M1–M5, K2, K4
- 15:47 · Khazretsultan/Claude · done · `routes/analyses.js`: POST /api/analyses (before/after/regulations; 415/413/422 before 202), /demo, GET /:id; stage-1 runner `pipeline/index.js` (`runPipeline(id, files)`, `IMPLEMENTED`/`STAGES`); `src/upload.js` shared by both upload routes. **kairadio:** I did not create your claimed `run.js`/`schemas.js`; `ClauseSchema`/`AnalysisDocumentSchema` sit in `clauses.js`. Rename or replace `pipeline/index.js` with your `run.js` (one import in `routes/analyses.js`) and move the schemas as you like · K1 M1 M4, K3
- 15:55 · Khazretsultan/Claude · done · smoke.sh runs the demo analysis (queued → done, clause 5.6.2 with its source) + 415/422/404 on the analysis API; 20 checks · K3, K1
- 15:55 · bolatashim/Cursor · start · demo-data frontend flow (spec от владельца): shell с сессиями и степпером, загрузка ДО/ПОСЛЕ, прогресс анализа, review-workspace с вкладками и просмотром документов, отчёт; данные — bundled demo_data.json (мок до готовности пайплайна; пересекается с results-UI kairadio — согласовать интеграцию) · K4 M1–M5 (UI)
- 15:55 · Khazretsultan/Claude · start · O1 data: `services/backend/data/regulatory/` (3 acts from the adilet corpus) + README dataset disclosure · K5 O1, K3
- 15:57 · Khazretsultan/Claude · done · O1 data: 3 acts in force from the adilet corpus in `services/backend/data/regulatory/` (477 pieces, validated), disclosed in the README; not loaded yet · K5 O1, K3
- 15:54 · kairadio/Claude · done · pipeline stages 2–5 end to end: `llm.js` (openai SDK, JSON mode, zod, retries, 503), `structure.js` (units + diff + successors), `extract.js` (functions per section), `compare.js` (exact → Jaccard → lexical/embedding candidates → judge; loss / moved / overlap / duplication / LLM-reviewed conflict / note; quote verification), `report.js` (RU conclusion, refs stripped, disclaimer), `pipeline/run.js` replaces `index.js`; `routes/analyses.js` now 503 without a key; `compare.test.js` (16 tests green in the image); smoke runs the full demo and asserts the control set (27 checks with a key, 18 without); results UI in Vue (upload, progress, units / matches / findings / conclusion, clause dialog); README rewritten. Demo pair: ДИТААД+ДОА created, направление ВА → ДИТААД, ДОА; losses 5.6.2 / 5.6.3 / 5.7.2; ДККМ conflict 5.3.2 ↔ 5.5.2; duplicate 5.4.3 ↔ 5.5.8; 0 unverified quotes; ~49 LLM calls, ~2.5–3 min · K1 M1–M5, K2, K3, K4
- 15:59 · kairadio/Claude · start · frontend follow-up: visual check of the results workspace at desktop and ~600 px, fixes. Note for bolatashim: the results UI is already on main (`App.vue`, `src/components/*`, `api.js`, `domain.js`), wired to the real `/api/analyses` API and verified with the demo run; please build on it instead of a demo-data flow (AGENTS.md §4.6 forbids hardcoded data on the main path) · K4
- 16:04 · Khazretsultan/Claude · start · O1 code. New files: `src/regulatoryNorms.js`, `src/pipeline/regulatory.js`, `src/prompts/regulatory.md`, `test/regulatory.test.js`, `frontend/src/components/RegulatoryTab.vue`, `frontend/src/adilet.js`. Small hook-ins only in teammates' files: backend `Dockerfile` (COPY data), `seed.js`, `run.js` (one call after compare), `schemas.js`; frontend `App.vue` (one tab), `domain.js`, `Icon.vue` (external-link) · K5 O1
- 16:05 · kairadio/Claude · done · results workspace checked in headless Chrome at 1280 px and 600 px (upload, units, matches, findings, conclusion, clause dialog render per the design system); unit names capitalized, matching steps in Russian on cards. Verified: local smoke 27/27, VM smoke 27/27 (https://hackalem-ai-wg…), clean-test 18/18 without a key · K4, K3
- 16:14 · Khazretsultan/Claude · done · O1 backend: norms loaded at startup (`regulatoryNorms.js`, `ensureRegulatoryNorms()`, Dockerfile COPY data), `pipeline/regulatory.js` (candidates → judge `prompts/regulatory.md` → norm quote → verify) wired in `run.js`, `analysis.regulatory` + conclusion section; 7 tests; README, AGENTS.md §7a and TASK.md §12a describe it · K5 O1, K2 K4
- 16:17 · Khazretsultan/Codex · start · user-approved review fixes, delivered sequentially: comparison failure handling, semantic/partial matches, format coverage, cross-document identity, grounded report, acceptance tests and TASK/README accuracy. Own compare.js, extract.js, clauses.js, report.js and their tests; no O1 work. Small run.js/docs hook-ins preserve the active O1 claim · K1–K4 M1–M5
- 16:22 · bolatashim/Cursor · done · демо-концепт интерфейса аналитика на `/#demo` (src/demo/, точка входа в main.js, App.vue kairadio не тронут): сайдбар сессий, степпер, шаги 1–6 (загрузка ДО/ПОСЛЕ, запуск, прогресс, review с вкладками, цитаты в полном тексте документа, решения принять/отклонить с комментарием и undo, отчёт с печатью PDF); данные — вшитый demo_data.json, API анализа не вызывается; README «Ограничения» дополнен. Рабочая версия на главной остаётся основным сценарием · K4 (UI-концепт)
- 16:28 · Khazretsultan/Codex · done · comparison timeout/incomplete verdicts stop the analysis with comparison_incomplete rather than false loss/clean duplication results; provider retry and UI restart preserved. Docker: 26 backend tests, live-model smoke 27/27; diff checked · K1 K2 K3 M2 M3
- 16:19 · kairadio/Claude · done · embeddings on: `EMBEDDING_MODEL=text-embedding-3-small` verified against the API and set in local `.env` and VM app.env (VM redeployed); `stats.embeddings`=ok, 5 embedding calls per demo run, judge candidates now semantic. Confident «partial» judge answers become medium POTENTIAL_LOSS with both citations (5.7.2 ↔ 2.4.7 case) instead of counting as found; `embedding_calls` in stats; README updated. Local smoke 27/27 with embeddings; 24 backend tests green incl. O1 · K1 M2, K2, K4
- 16:36 · Khazretsultan/Claude · done · O1 UI: «Нормативные требования» tab (`RegulatoryTab.vue`, `adilet.js` with `ADILET_BASE` = old.adilet.zan.kz, `external-link` icon), checked at desktop and phone width on the VM run a_b55b9a775863 (20 bases, links open the article); short norm ids stripped from reasons; smoke adds the O1 check (28 with a model); README expected O1 output · K5 O1, K4 K3
- 16:39 · bolatashim/Cursor · done · демо-концепт /#demo упрощён по фидбеку: без панели сессий и обзорных таблиц, 4 шага (документы → анализ → проверка → заключение), карточки только принять/отклонить с комментарием, документ и цитаты открываются в модальном окне; меньше цветов и текста · K4 (UI-концепт)
- 16:38 · kairadio/Claude · done · analyses left queued/running by a restart or redeploy are marked failed (`interrupted`) at startup so the UI stops polling; smoke poll tolerates a slow or failed request (the VM smoke aborted when a push redeployed mid-run). VM analyses with embeddings verified in Mongo: `embeddings: ok`, 197–239 s · K3, K2
- 16:42 · bolatashim/Cursor · done · откат af24117, 91f83fe, 8632557 (git revert): демо-концепт /#demo, вшитый demo_data.json и dev-прокси vite удалены из репозитория; основной интерфейс и пайплайн не затронуты · откат
- 16:41 · bolatashim/Cursor · done · vite.config.js: dev-прокси /api на compose-стек (host.docker.internal:3000, переопределяется API_PROXY_TARGET) — вход и API работают и на dev-сервере 5173 · инфраструктура разработки

- 16:42 · Khazretsultan/Codex · done · only identical source text bypasses the judge; negation/scope changes and weak positive matches remain reviewable; compound-duty overlap is assessed explicitly. Docker: 28 backend tests, smoke 27/27, live negation/partial/duplication probes passed · K1 K2 K3 K4 M2 M3
- 16:50 · kairadio/Claude · done · results UI redesigned per the approved mock (canvas «OrgScope results redesign»): navy top bar with screen switch, verdict headline + lead built by code from stats, distribution bar of «до» functions, «Проверить в первую очередь» rows (≤7, expandable, quotes side by side), before→after unit flow diagram, recommendations panel; per-unit page (rail with counts, unit distribution, sections lost / conflict / overlaps / moved). Old KPI tiles, info bar, card wall and match-table tab removed from the default view (match table via «Все сопоставления», O1 tab kept). Fonts Manrope / Golos Text / Lora bundled. Checked in headless Chrome at 1280 px and 600 px · K4, K1

- 16:55 · Khazretsultan/Codex · done · Word paragraphs/tables, Excel rows, flat points and attachments reach function extraction; generic sources retain refs; inline references and ordinary content sentences are preserved. Incomplete extraction/zero before-functions stop safely. Docker: 34 backend tests, 5 real-format pipeline cases without API keys, live smoke 28/28 including O1 · K1 K2 K3 K4 M1 M2 M4
- 17:25 · kairadio/Claude · done · per-user history and an input guard: analyses started with a session carry user_id, GET /api/analyses (session only) lists the user's runs with status, files, error and a numeric summary; UI «История» screen + five recent runs on the start page, any run reopens by id (running ones keep polling). Pipeline classify step (prompts/classify.md, pipeline/classify.js): each «до»/«после» document is checked by the model for being about units and their functions; a manual / contract / article stops the run with 422 irrelevant_document naming the file, lexical override keeps documents where ≥50 % of clauses name units; UI shows «Документы не подходят для анализа» with the files. Docker: 39 backend tests, smoke with three new checks (history 401, manual.pdf refused, history lists the user's run and not another's) · K1 K4 M2

- 17:16 · Khazretsultan/Codex · done · M1 assessment receives structure plus duties and preserves document identity; incomplete/invalid successor answers stop instead of implying removal. Added three regressions. Docker: 37 backend tests; full live-model smoke 28/28. An earlier control run exposed inconsistent reorganization; fixed and rerun before push · K1 K2 K3 M1
- 17:18 · Khazretsultan/Claude · start · `services/backend/src/llm.js` CONCURRENCY 6 → 12 (key limits 5000 RPM / 2M TPM, 0 retries observed) · K1
- 17:18 · Khazretsultan/Claude · done · LLM calls: up to 12 in flight per analysis (was 6), so both documents' extract chunks run at once; backend tests 42/42 in Docker; README updated · K1 · llm concurrency
- 17:20 · kairadio/Claude · done · UI aligned to the design file «OrgScope — Org Structure Comparison UI»: light header with the six design tabs (Обзор · Структура · Потеря функций · Дублирование и конфликты · Заключение · Рекомендации) and «Экспорт заключения»; design palette (cream page, white cards, teal primary, serif headings) via tokens; Обзор gains «1 · Изменения структуры» cards (сохранено / реорганизовано / создано / упразднено with unit names) and «2–3 · Выявленные риски» cards (потеря / дублирование / конфликт) linking to the new «Потеря функций» and «Дублирование и конфликты» screens; «Рекомендации» screen with the module cards Рекомендации / Соответствие законодательству (O1). Design-only features (expert confirmation, comments, operator comparison, DOCX/PDF export) not implemented. Docker: frontend built, headless Chrome screenshots of overview / losses / recommendations · K4
- 17:21 · Khazretsultan/Claude · start · frontend: brand favicon (Chrome showed none: /favicon.ico fell back to index.html), cache headers (hashed assets immutable, index.html revalidated), the open analysis screen / unit survives a reload, finished analyses reopen from memory. Files: frontend index.html, public/, Caddyfile, Dockerfile, App.vue · K4 K3

- 17:22 · Khazretsultan/Codex · done · identical clause numbering across files no longer hides duplicates; references include document IDs and filename legend; quote verification checks side and preserves punctuation/case. Fixed inverted history smoke assertion under errexit. Docker: 44 backend tests, 5 format cases, expanded smoke 33/33 · K1 K2 K3 K4 M3 M4
