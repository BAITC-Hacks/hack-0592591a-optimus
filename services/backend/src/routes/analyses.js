// Analysis API (docs/TASK.md §7). Public on purpose: reviewers and smoke.sh run
// the main scenario without an account. Every input problem is answered before
// the 202, so the background pipeline only sees files of a supported type.
// A signed-in user is attached to the analysis so GET /api/analyses lists it later.
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import { Router } from "express";

import { optionalAuth, requireAuth } from "../auth.js";
import { getDb } from "../db.js";
import { HttpError } from "../httpError.js";
import { assertLlmConfigured } from "../llm.js";
import { runPipeline } from "../pipeline/run.js";
import { sniffFileType, uploadFields } from "../upload.js";

const ANALYSIS_ID = /^a_[0-9a-f]{12}$/;
const MAX_FILES_PER_SIDE = 10;
const DEMO_DIR = new URL("../../demo/", import.meta.url);
const SIDE_FIELDS = { before: "before", after: "after", regulations: "regulation" };

export const analyses = Router();

async function startAnalysis(files, source, user) {
  assertLlmConfigured(); // 503 llm_unavailable before anything is queued (docs/TASK.md §7)
  const id = `a_${randomBytes(6).toString("hex")}`;
  const now = new Date();
  await getDb().collection("analyses").insertOne({
    _id: id,
    status: "queued",
    stage: null,
    error: null,
    source,
    user_id: user ? String(user._id) : null,
    created_at: now,
    updated_at: now,
    inputs: files.map((f) => ({ side: f.side, filename: f.filename, size_bytes: f.buffer.length })),
  });
  // Not awaited: the client polls GET /api/analyses/:id. runPipeline records its own failures.
  runPipeline(id, files);
  return id;
}

// POST /api/analyses  multipart: before[] and after[] (required), regulations[] (optional)
analyses.post(
  "/",
  optionalAuth,
  uploadFields(Object.keys(SIDE_FIELDS).map((name) => ({ name, maxCount: MAX_FILES_PER_SIDE }))),
  async (req, res, next) => {
    try {
      const uploaded = req.files || {};
      const missing = ["before", "after"].filter((field) => !uploaded[field]?.length);
      if (missing.length) {
        const names = missing.map((m) => (m === "before" ? "«до»" : "«после»")).join(" и ");
        throw new HttpError(422, "missing_side", `Загрузите документы ${names} реорганизации.`);
      }
      const files = [];
      for (const [field, side] of Object.entries(SIDE_FIELDS)) {
        for (const file of uploaded[field] || []) {
          if (!file.size) throw new HttpError(400, "empty_file", `Файл «${file.originalname}» пустой.`);
          if (!sniffFileType(file.buffer, file.originalname)) {
            throw new HttpError(
              415,
              "unsupported_format",
              `Файл «${file.originalname}» не поддерживается. Загрузите PDF, Word (.docx) или Excel (.xlsx, .xls).`,
            );
          }
          files.push({ side, buffer: file.buffer, filename: file.originalname, mimetype: file.mimetype });
        }
      }
      res.status(202).json({ analysis_id: await startAnalysis(files, "upload", req.user) });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/analyses/demo  the bundled control pair (services/backend/demo/{before,after})
analyses.post("/demo", optionalAuth, async (req, res, next) => {
  try {
    const files = [];
    for (const side of ["before", "after"]) {
      const dir = new URL(`${side}/`, DEMO_DIR);
      for (const name of (await readdir(dir)).sort()) {
        const buffer = await readFile(new URL(name, dir));
        if (sniffFileType(buffer, name)) files.push({ side, buffer, filename: name });
      }
    }
    if (!files.some((f) => f.side === "before") || !files.some((f) => f.side === "after")) {
      throw new HttpError(500, "demo_missing", "Демо-документы не найдены в образе.");
    }
    res.status(202).json({ analysis_id: await startAnalysis(files, "demo", req.user) });
  } catch (err) {
    next(err);
  }
});

const countFindings = (type) => ({ $size: { $filter: { input: { $ifNull: ["$findings", []] }, as: "f", cond: { $eq: ["$$f.type", type] } } } });
const countUnits = (status) => ({ $size: { $filter: { input: { $ifNull: ["$unit_changes", []] }, as: "u", cond: { $eq: ["$$u.status", status] } } } });
const HISTORY_LIMIT = 100;

// GET /api/analyses  the signed-in user's runs, newest first, without the heavy
// result fields: enough for a history list and to reopen any of them by id.
analyses.get("/", requireAuth, async (req, res, next) => {
  try {
    const items = await getDb()
      .collection("analyses")
      .aggregate([
        { $match: { user_id: String(req.user._id) } },
        { $sort: { created_at: -1 } },
        { $limit: HISTORY_LIMIT },
        {
          $project: {
            status: 1,
            stage: 1,
            source: 1,
            created_at: 1,
            finished_at: 1,
            error: 1,
            inputs: 1,
            duration_ms: "$stats.duration_ms",
            summary: {
              functions_before: { $ifNull: ["$stats.functions_before", null] },
              functions_after: { $ifNull: ["$stats.functions_after", null] },
              units_created: countUnits("created"),
              units_reorganized: countUnits("reorganized"),
              losses: countFindings("POTENTIAL_LOSS"),
              conflicts: countFindings("POTENTIAL_CONFLICT"),
              duplications: countFindings("POTENTIAL_DUPLICATION"),
              moved: countFindings("MOVED"),
            },
          },
        },
      ])
      .toArray();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /api/analyses/:id  status while running, the full document when done (docs/TASK.md §6)
analyses.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const analysis = ANALYSIS_ID.test(id) ? await getDb().collection("analyses").findOne({ _id: id }) : null;
    if (!analysis) throw new HttpError(404, "not_found", "Анализ не найден.");
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});
