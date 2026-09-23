// Runs one analysis in the background and records progress in Mongo `analyses`
// (docs/TASK.md §2, §6). Each stage sets `stage` before it starts, so the UI can
// poll GET /api/analyses/:id; the full result lands in the same document.
//
//   runPipeline(id, files)   files: [{ side: "before"|"after"|"regulation", buffer, filename, mimetype? }]
import { z } from "zod";

import { getDb } from "../db.js";
import { HttpError } from "../httpError.js";
import { createLlm } from "../llm.js";
import { AnalysisResult } from "../schemas.js";
import { assertRelevantDocuments } from "./classify.js";
import { AnalysisDocumentSchema, extractClauses } from "./clauses.js";
import { compareFunctions } from "./compare.js";
import { extractFunctions } from "./extract.js";
import { checkRegulatorySafe, withRegulatorySection } from "./regulatory.js";
import { writeConclusion } from "./report.js";
import { buildStructure } from "./structure.js";

export const STAGES = ["clauses", "structure", "functions", "compare", "report"];
const PARALLEL_FILES = 4;

const DocumentSchema = AnalysisDocumentSchema.extend({ pages: z.number().int().nullable() });

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
 * Analyses left "queued" or "running" by a previous process were interrupted by a
 * restart or redeploy: the pipeline runs in memory, so they can never finish. Mark
 * them failed at startup so the UI stops polling and says what happened.
 */
export async function failInterruptedAnalyses() {
  const result = await analyses().updateMany(
    { status: { $in: ["queued", "running"] } },
    { $set: { status: "failed", finished_at: new Date(), updated_at: new Date(), error: { stage: null, code: "interrupted", message: "Анализ прерван перезапуском сервера. Запустите анализ заново.", filename: null } } },
  );
  if (result.modifiedCount) console.warn(`[pipeline] ${result.modifiedCount} interrupted analysis(es) marked failed`);
}

/**
 * @param {string} id  analysis id (document already inserted with status "queued")
 * @param {{side: string, buffer: Buffer, filename: string, mimetype?: string}[]} files
 * @param {{llm?: object, extractClauses?: Function}} deps  stubs for tests
 */
export async function runPipeline(id, files, deps = {}) {
  const started = Date.now();
  const set = deps.save ?? ((fields) => analyses().updateOne({ _id: id }, { $set: { ...fields, updated_at: new Date() } }));
  let current = null;
  try {
    const llm = deps.llm ?? createLlm(); // throws 503 llm_unavailable without a key

    // 1. clauses: extractor fragments -> clauses, one document per file.
    current = "clauses";
    await set({ status: "running", stage: current });
    const counters = {};
    const inputs = files.map((file) => {
      counters[file.side] = (counters[file.side] || 0) + 1;
      return { ...file, docId: `${file.side}_${counters[file.side]}` };
    });
    const documents = await mapLimit(inputs, PARALLEL_FILES, async (file) => {
      try {
        const result = await (deps.extractClauses ?? extractClauses)(file, { docId: file.docId, side: file.side });
        if (!result.clauses.length) throw new HttpError(422, "no_clauses", `В документе «${file.filename}» не найдено текстовых пунктов или фрагментов.`);
        if (result.warnings.length) throw new HttpError(422, "incomplete_document", `Документ «${file.filename}» извлечён не полностью: ${result.warnings.join(" ")} Анализ остановлен, чтобы не принять пропущенный текст за потерю функции.`);
        return DocumentSchema.parse({
          doc_id: file.docId,
          side: file.side,
          filename: result.document.filename,
          format: result.document.format,
          sha256: result.document.sha256,
          title: result.document.title ?? null,
          pages: result.document.pages ?? null,
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
    // Still the clauses stage: refuse documents that are not about units and
    // their functions (a manual, a contract) before any structure is inferred.
    await set({ documents });
    await assertRelevantDocuments(documents, llm);
    const docs = documents.filter((d) => d.side === "before" || d.side === "after");
    const count = (side) => documents.filter((d) => d.side === side).reduce((sum, d) => sum + d.clauses.length, 0);
    const clauseStats = { clauses_before: count("before"), clauses_after: count("after"), clauses_regulation: count("regulation") };

    // 2. units and their diff.
    current = "structure";
    await set({ stage: current, documents, stats: clauseStats });
    const structure = await buildStructure(docs, llm);

    // 3. functions per clause.
    current = "functions";
    await set({ stage: current, units: structure.units, unit_changes: structure.unit_changes });
    const extracted = await Promise.all(docs.map((doc) => extractFunctions(doc, structure.units, llm)));
    const before = extracted.filter((_, i) => docs[i].side === "before").flatMap((r) => r.functions);
    const after = extracted.filter((_, i) => docs[i].side === "after").flatMap((r) => r.functions);
    if (!before.length) throw new HttpError(422, "no_functions", "В комплекте «до» не распознаны функции. Проверьте документы; достоверное сравнение невозможно.");
    before.forEach((fn, i) => (fn.func_id = `fb_${String(i + 1).padStart(3, "0")}`));
    after.forEach((fn, i) => (fn.func_id = `fa_${String(i + 1).padStart(3, "0")}`));
    const persist = (fns) => fns.map(({ text, ...fn }) => fn); // clause text is already in documents[]

    // 4. match, detect, verify.
    current = "compare";
    await set({ stage: current, functions: { before: persist(before), after: persist(after) } });
    const compared = await compareFunctions({ before, after, units: structure.units, docs, llm });
    // O1 (optional, docs/TASK.md §12a): «после» functions vs legislation. Still the
    // compare stage, so the five-stage progress is unchanged; never fails the run.
    const regulatory = await (deps.checkRegulatory ?? checkRegulatorySafe)({ after, docs: documents, llm });

    // 5. conclusion.
    current = "report";
    await set({ stage: current, matches: compared.matches, findings: compared.findings, regulatory: regulatory.findings });
    const stats = {
      ...clauseStats,
      ...structure.stats,
      functions_before: before.length,
      functions_after: after.length,
      ...compared.stats,
      ...regulatory.stats,
      extract_chunks: extracted.reduce((n, r) => n + r.stats.chunks, 0),
    };
    const report = await writeConclusion({ findings: compared.findings, units: structure.units, unit_changes: structure.unit_changes, stats, llm, documents });
    report.conclusion_md = withRegulatorySection(report.conclusion_md, regulatory);
    const finalStats = {
      ...stats,
      ...report.stats,
      llm_model: llm.stats.model ?? llm.model ?? null,
      llm_calls: llm.stats.calls,
      llm_retries: llm.stats.retries,
      embedding_calls: llm.stats.embedding_calls ?? 0,
      embeddings: llm.stats.embeddings,
      duration_ms: Date.now() - started,
    };
    const result = AnalysisResult.parse({
      units: structure.units,
      unit_changes: structure.unit_changes,
      functions: { before: persist(before), after: persist(after) },
      matches: compared.matches,
      findings: compared.findings,
      regulatory: regulatory.findings,
      conclusion_md: report.conclusion_md,
      stats: finalStats,
    });
    await set({ ...result, status: "done", stage: "done", error: null, finished_at: new Date(), pipeline: { implemented: STAGES, pending: [] } });
    console.log(`[pipeline] ${id} done in ${Math.round((Date.now() - started) / 1000)} s: ${JSON.stringify(finalStats)}`);
    return result;
  } catch (err) {
    const safe = err instanceof HttpError; // our own messages; anything else stays in the log
    if (safe) console.warn(`[pipeline] ${id} failed at ${current}: ${err.code}: ${err.message}`);
    else console.error(`[pipeline] ${id} failed at ${current}:`, err);
    await set({
      status: "failed",
      finished_at: new Date(),
      error: { stage: current, code: safe ? err.code : "pipeline_failed", message: safe ? err.message : "Внутренняя ошибка при анализе.", filename: err.filename ?? null },
    }).catch((writeErr) => console.error(`[pipeline] ${id}: could not record failure`, writeErr));
    return null;
  }
}
