// Analysis API (docs/TASK.md §7). Public on purpose: reviewers and smoke.sh run
// the main scenario without an account. Every input problem is answered before
// the 202, so the background pipeline only sees files of a supported type.
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import { Router } from "express";

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

async function startAnalysis(files, source) {
  assertLlmConfigured(); // 503 llm_unavailable before anything is queued (docs/TASK.md §7)
  const id = `a_${randomBytes(6).toString("hex")}`;
  const now = new Date();
  await getDb().collection("analyses").insertOne({
    _id: id,
    status: "queued",
    stage: null,
    error: null,
    source,
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
      res.status(202).json({ analysis_id: await startAnalysis(files, "upload") });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/analyses/demo  the bundled control pair (services/backend/demo/{before,after})
analyses.post("/demo", async (_req, res, next) => {
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
    res.status(202).json({ analysis_id: await startAnalysis(files, "demo") });
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
