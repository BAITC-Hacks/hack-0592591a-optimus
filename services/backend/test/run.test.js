import assert from "node:assert/strict";
import { test } from "node:test";
import { runPipeline } from "../src/pipeline/run.js";

const files = ["before", "after"].map(side => ({ side, filename: `${side}.docx`, buffer: Buffer.from("test-only") }));
function extracted(file, { docId, side }) {
  return {
    document: { filename: file.filename, format: "docx", sha256: "0".repeat(64), pages: null },
    preamble: "", warnings: [], stats: {},
    clauses: [{ doc_id: docId, side, clause_id: "1", parent_id: null, fragment_ids: ["f1"], ref: "абзац 1",
      text: side === "before" ? "Отдел планирует закупки оборудования для филиалов." : "Отдел контролирует закупки оборудования для филиалов." }],
  };
}
function llm({ empty = false } = {}) {
  return { stats: {}, embed: async () => null, async completeJson({ name, schema }) {
    if (name.startsWith("structure")) return schema.parse({ units: [] });
    if (name.startsWith("extract")) return schema.parse({ functions: empty ? [] : [{ clause_id: "1", owners: ["Отдел"], canonical: "работать с закупками", category: "plan" }] });
    throw new Error("simulated provider timeout");
  } };
}

test("an incomplete document fails before classification instead of becoming a lost function", async () => {
  const state = {};
  const result = await runPipeline("incomplete-test", files, {
    llm: llm(), save: async fields => Object.assign(state, fields),
    extractClauses: async (file, meta) => ({ ...extracted(file, meta), warnings: ["Документ обрезан до первых 10 фрагментов."] }),
  });
  assert.equal(result, null);
  assert.equal(state.status, "failed");
  assert.equal(state.error.code, "incomplete_document");
  assert.equal(state.error.stage, "clauses");
  assert.equal(state.findings, undefined);
});

test("zero extracted before-functions never yields an apparently clean conclusion", async () => {
  const state = {};
  await runPipeline("empty-functions-test", files, { llm: llm({ empty: true }), save: async fields => Object.assign(state, fields), extractClauses: extracted });
  assert.equal(state.status, "failed");
  assert.equal(state.error.code, "no_functions");
  assert.equal(state.conclusion_md, undefined);
});

test("a failed comparison is persisted as failed without loss findings or a conclusion", async () => {
  const state = {};
  await runPipeline("failed-judge-test", files, { llm: llm(), save: async fields => Object.assign(state, fields), extractClauses: extracted });
  assert.equal(state.status, "failed");
  assert.equal(state.error.code, "comparison_incomplete");
  assert.equal(state.error.stage, "compare");
  assert.equal(state.findings, undefined);
  assert.equal(state.conclusion_md, undefined);
});
