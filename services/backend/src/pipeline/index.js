// Runs one analysis in the background and records progress in Mongo `analyses`
// (docs/TASK.md §2, §6). Each stage sets `stage` before it starts, so the UI can
// poll GET /api/analyses/:id. Only the stages listed in IMPLEMENTED run; the
// document says so in `pipeline`, so an empty result is never mistaken for
// "no findings".
import { getDb } from "../db.js";
import { HttpError } from "../httpError.js";
import { AnalysisDocumentSchema, extractClauses } from "./clauses.js";

export const STAGES = ["clauses", "structure", "extract", "compare", "report"];
const IMPLEMENTED = ["clauses"];
const PARALLEL_FILES = 4;

const analyses = () => getDb().collection("analyses");

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * @param {string} id  analysis id
 * @param {{side: string, buffer: Buffer, filename: string, mimetype?: string}[]} files
 */
export async function runPipeline(id, files) {
  const set = (fields) => analyses().updateOne({ _id: id }, { $set: { ...fields, updated_at: new Date() } });
  let current = null;
  try {
    current = "clauses";
    await set({ status: "running", stage: current });
    const counters = {};
    const inputs = files.map((file) => {
      counters[file.side] = (counters[file.side] || 0) + 1;
      return { ...file, docId: `${file.side}_${counters[file.side]}` };
    });
    const documents = await mapLimit(inputs, PARALLEL_FILES, async (file) => {
      try {
        const result = await extractClauses(file, { docId: file.docId, side: file.side });
        return AnalysisDocumentSchema.parse({
          doc_id: file.docId,
          side: file.side,
          filename: result.document.filename,
          format: result.document.format,
          sha256: result.document.sha256,
          title: result.document.title ?? null,
          preamble: result.preamble,
          warnings: result.warnings,
          stats: result.stats,
          clauses: result.clauses,
        });
      } catch (err) {
        err.filename = file.filename;
        throw err;
      }
    });

    const count = (side) => documents.filter((d) => d.side === side).reduce((sum, d) => sum + d.clauses.length, 0);
    await set({
      documents,
      stats: { clauses_before: count("before"), clauses_after: count("after"), clauses_regulation: count("regulation") },
    });

    await set({
      status: "done",
      stage: IMPLEMENTED.at(-1),
      pipeline: { implemented: IMPLEMENTED, pending: STAGES.filter((stage) => !IMPLEMENTED.includes(stage)) },
    });
  } catch (err) {
    console.error(`analysis ${id} failed at ${current}:`, err);
    const safe = err instanceof HttpError; // our own messages (extractor errors); anything else stays in the log
    await set({
      status: "failed",
      error: {
        stage: current,
        code: safe ? err.code : "pipeline_failed",
        message: safe ? err.message : "Внутренняя ошибка при анализе.",
        filename: err.filename ?? null,
      },
    }).catch((writeErr) => console.error(`analysis ${id}: could not record failure`, writeErr));
  }
}
