// O1 without a key: the shipped adilet.zan.kz slice, a stubbed judge, and
// lexical candidates (embed() returns null). docs/TASK.md §12a.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { DISCLAIMER } from "../src/pipeline/report.js";
import { checkRegulatory, checkRegulatorySafe, normQuote, uploadedNorms, withRegulatorySection } from "../src/pipeline/regulatory.js";
import { quoteOf } from "../src/pipeline/util.js";
import { ADILET_URL, clauseOf, readNormFiles } from "../src/regulatoryNorms.js";

const NORMS = readNormFiles();
const byClause = (docId, clause) => NORMS.find((n) => n.doc_id === docId && n.clause === clause);
const ART61 = byClause("Z030000415_", "Статья 61");
const ART15 = NORMS.find((n) => n.doc_id === "Z1500000410" && n.article === "15");

function fn(id, clauseId, text, owners = ["БВА"], canonical = text.slice(0, 60)) {
  return { func_id: id, doc_id: "after_1", side: "after", clause_id: clauseId, ref: `п. ${clauseId}, стр. 1`, owners, canonical, category: "other", quote: quoteOf(text), text };
}
const docOf = (fns, extra = []) => [
  { doc_id: "after_1", side: "after", clauses: fns.map((f) => ({ doc_id: "after_1", clause_id: f.clause_id, text: f.text, ref: f.ref })) },
  ...extra,
];

/** Judge stub: answers per function id; `pick(norms)` returns the short id to cite. */
function stubLlm(answers) {
  const stats = { calls: 0, model: "stub", embeddings: "unavailable" };
  return {
    stats,
    model: "stub",
    async embed() {
      return null;
    },
    async completeJson({ name, prompt, schema }) {
      stats.calls++;
      assert.ok(name.startsWith("regulatory"), `unexpected llm call ${name}`);
      const input = JSON.parse(prompt.split("<document>")[1].split("</document>")[0]);
      const results = input.functions.map((f) => {
        const answer = answers[f.id] ?? { relation: "none" };
        const norm = answer.clause ? input.norms.find((n) => f.candidates.includes(n.id) && n.clause.startsWith(answer.clause)) : null;
        return { id: f.id, norm_id: answer.norm_id ?? norm?.id ?? null, relation: answer.relation, confidence: answer.confidence ?? 0.9, reason: "Возможно, связано; требует проверки." };
      });
      return schema.parse({ results });
    },
  };
}

test("shipped norms: 477 pieces in force, adilet links, article clauses", () => {
  assert.equal(NORMS.length, 477);
  assert.ok(NORMS.every((n) => n.origin === "corpus" && ADILET_URL.test(n.source_url) && n.text.length > 0));
  assert.deepEqual([...new Set(NORMS.map((n) => n.doc_id))].sort(), ["Z030000415_", "Z1200000550", "Z1500000410"]);
  assert.ok(ART61 && ART61.text.includes("непосредственно подчиняется совету директоров"));
  assert.equal(clauseOf({ article: "11", point: "2" }), "Статья 11, п. 2");
  assert.equal(clauseOf({ article: null, article_title: "Преамбула" }), "Преамбула");
});

test("a bad line fails loudly with file and line", () => {
  const dir = mkdtempSync(join(tmpdir(), "norms-"));
  const row = { doc_id: "Z1", lang: "rus", doc_title: "Тест", status: "утратил силу", redaction_date: null, article: "1", text: "т", chunk_index: 0, source_url: "https://adilet.zan.kz/rus/docs/Z1" };
  writeFileSync(join(dir, "Z1.jsonl"), `${JSON.stringify(row)}\n`);
  assert.throws(() => readNormFiles(pathToFileURL(`${dir}/`)), /Z1\.jsonl:1: status/);
});

test("basis and possible conflict, each with a verified org quote and a verbatim norm line", async () => {
  const basis = fn("fa_001", "3.2", "Служба внутреннего аудита непосредственно подчиняется Совету директоров и отчитывается перед ним о своей работе.");
  const conflict = fn("fa_002", "3.3", "Служба внутреннего аудита подчиняется Правлению и отчитывается перед Председателем Правления о своей работе.");
  const unrelated = fn("fa_003", "7.1", "Служба внутреннего аудита хранит документы о своей работе и передаёт их совету директоров.");
  const llm = stubLlm({ fa_001: { relation: "basis", clause: "Статья 61" }, fa_002: { relation: "contradicts", clause: "Статья 61" }, fa_003: { relation: "basis", norm_id: "n999" } });
  const { findings, stats } = await checkRegulatory({ after: [basis, conflict, unrelated], docs: docOf([basis, conflict, unrelated]), llm, norms: [ART61, ART15] });

  assert.equal(stats.regulatory_status, "ok");
  assert.equal(stats.regulatory_mode, "lexical");
  assert.equal(stats.regulatory_rejected, 1, "a norm id the model invented is rejected");
  assert.deepEqual(findings.map((f) => f.type), ["POTENTIAL_REGULATORY_CONFLICT", "REGULATORY_BASIS"], "conflicts first");
  for (const f of findings) {
    assert.equal(f.norm.clause, "Статья 61");
    assert.equal(f.norm.source_url, ART61.source_url);
    assert.equal(f.norm.redaction_date, "2026-08-13");
    assert.ok(ART61.text.includes(f.norm.quote), "norm quote is verbatim");
    assert.ok(f.citations[0].quote.length > 0);
  }
  assert.match(findings[1].norm.quote, /подчиняется совету директоров/, "the closest line of the article is quoted");
});

test("a tampered org quote is dropped", async () => {
  const f = fn("fa_010", "3.2", "Служба внутреннего аудита непосредственно подчиняется Совету директоров и отчитывается перед ним.");
  f.quote = "Служба внутреннего аудита подчиняется Президенту.";
  const { findings, stats } = await checkRegulatory({ after: [f], docs: docOf([f]), llm: stubLlm({ fa_010: { relation: "basis", clause: "Статья 61" } }), norms: [ART61] });
  assert.equal(findings.length, 0);
  assert.equal(stats.regulatory_dropped_unverified, 1);
});

test("uploaded regulations become norms without a link and win ties", async () => {
  const regulation = { doc_id: "regulation_1", side: "regulation", title: "Стандарт СВА", filename: "std.pdf", clauses: [{ clause_id: "2.1", text: "Служба внутреннего аудита непосредственно подчиняется Совету директоров и отчитывается перед ним о своей работе.", ref: "п. 2.1, стр. 1" }] };
  const [norm] = uploadedNorms([regulation]);
  assert.equal(norm.origin, "uploaded");
  assert.equal(norm.source_url, null);
  const f = fn("fa_020", "3.2", "Служба внутреннего аудита непосредственно подчиняется Совету директоров и отчитывается перед ним о своей работе.");
  const { findings } = await checkRegulatory({ after: [f], docs: docOf([f], [regulation]), llm: stubLlm({ fa_020: { relation: "basis", clause: "п. 2.1" } }), norms: [ART61] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].norm.origin, "uploaded");
  assert.equal(findings[0].norm.ref, "п. 2.1, стр. 1");
});

test("no norms, failures and the conclusion section never break the analysis", async () => {
  const f = fn("fa_030", "1.1", "Служба внутреннего аудита отчитывается перед Советом директоров.");
  assert.equal((await checkRegulatory({ after: [f], docs: docOf([f]), llm: stubLlm({}), norms: [] })).stats.regulatory_status, "no_norms");
  const failed = await checkRegulatorySafe({ after: [f], docs: docOf([f]), llm: stubLlm({}), loadNorms: async () => { throw Object.assign(new Error("db down"), { code: "db" }); } });
  assert.deepEqual(failed.findings, []);
  assert.equal(failed.stats.regulatory_status, "failed");

  const md = `## Итоги\n\nТекст.\n\n---\n\n_${DISCLAIMER}_\n`;
  const conflict = { type: "POTENTIAL_REGULATORY_CONFLICT", title: "Функция: возможно расходится со Статья 61", citations: [{ clause_id: "3.3" }], norm: { redaction_date: "2026-08-13" } };
  const out = withRegulatorySection(md, { findings: [conflict], stats: { regulatory_status: "ok", regulatory_judged: 2, regulatory_basis: 1 } });
  assert.ok(out.indexOf("## Сверка с законодательством") < out.indexOf(DISCLAIMER), "section sits above the disclaimer");
  assert.match(out, /\[после · п\. 3\.3\].*ред\. от 13\.08\.2026/);
  assert.equal(withRegulatorySection(md, { findings: [], stats: { regulatory_status: "no_norms" } }), md);
});

test("normQuote returns a line of the norm, never invented text", () => {
  const f = fn("fa_040", "1.1", "Работники службы внутреннего аудита не избираются в совет директоров и исполнительный орган.");
  const quote = normQuote(ART61, f);
  assert.ok(ART61.text.includes(quote));
  assert.match(quote, /не могут быть избраны/);
});
