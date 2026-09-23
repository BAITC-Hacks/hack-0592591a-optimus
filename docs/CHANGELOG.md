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
