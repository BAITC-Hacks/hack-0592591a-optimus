// Real file -> HTTP extractor -> all mandatory stages. Only the model and result
// store are test adapters; no account, paid API, or canned application endpoint.
import assert from "node:assert/strict";
import { runPipeline } from "../src/pipeline/run.js";

function fixtureLlm() {
  const stats = { calls: 0, retries: 0, model: "test-fixture", embeddings: "unavailable" };
  return { stats, embed: async () => null, async completeJson({ name, prompt, schema }) {
    stats.calls++;
    const rows = [...prompt.matchAll(/^\[([^\]]+)\] (.+)$/gm)].map(m => ({ id: m[1], text: m[2] }));
    let out;
    if (name.startsWith("structure")) {
      out = { units: [ ["Audit department", "AUD"], ["Risk department", "RISK"] ].flatMap(([label, abbr]) => {
        const row = rows.find(r => r.text.includes(`${label} (${abbr})`));
        return row ? [{ name: label, abbr, kind: "department", parent: null, source_clause: row.id }] : [];
      }) };
    } else if (name.startsWith("extract")) {
      out = { functions: rows.filter(r => /conducts|prepares|maintains/.test(r.text)).map(r => ({
        clause_id: r.id, owners: [r.text.includes("(RISK)") ? "RISK" : "AUD"], category: "other",
        canonical: r.text.includes("conducts") ? "проводить аудит" : r.text.includes("prepares") ? "готовить отчёты" : "вести реестр рисков",
      })) };
    } else if (name.startsWith("judge")) {
      const items = JSON.parse(prompt.match(/<document>\s*([\s\S]*?)\s*<\/document>/)[1]);
      out = { results: items.map(item => ({ id: item.id, candidate_id: null, relation: "none", confidence: 1 })) };
    } else if (name === "report") {
      out = { conclusion_md: "## Итоги\n\nВыводы сформированы по синтетическим исходным документам. Проверьте цитаты и возможную потерю обязанности готовить отчёты." };
    } else throw new Error(`Unexpected model call in fixture: ${name}`);
    return schema.parse(out);
  } };
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const cases = JSON.parse(input);
// A mixed set exercises cross-format processing within one analysis too.
cases.push({ kind: "mixed", files: [cases[0].files[0], cases[2].files[1], cases[3].files[1]] });
for (const { kind, files } of cases) {
  const state = {};
  const result = await runPipeline(`format-test-${kind}`, files.map(f => ({ ...f, buffer: Buffer.from(f.data, "base64") })), {
    llm: fixtureLlm(), save: async fields => Object.assign(state, fields),
    checkRegulatory: async () => ({ findings: [], stats: { regulatory_status: "no_norms" } }),
  });
  assert.equal(state.status, "done", JSON.stringify(state.error));
  assert.equal(result.functions.before.length, 2, kind);
  assert.ok(result.matches.some(m => m.relation === "same"), kind);
  const unitById = new Map(result.units.map(u => [u.unit_id, u]));
  assert.ok(result.unit_changes.some(c => c.status === "created" && unitById.get(c.after)?.abbr === "RISK"), kind);
  assert.ok(result.unit_changes.some(c => c.status === "kept" && unitById.get(c.after)?.abbr === "AUD"), kind);
  const loss = result.findings.find(f => f.type === "POTENTIAL_LOSS");
  assert.ok(loss?.citations.some(c => c.quote.includes("quarterly reports")), kind);
  for (const finding of result.findings) for (const c of finding.citations) {
    const doc = state.documents.find(d => d.doc_id === c.doc_id);
    assert.equal(doc.side, c.side);
    assert.ok(doc.clauses.find(p => p.clause_id === c.clause_id)?.text.includes(c.quote), kind);
  }
  assert.match(result.conclusion_md, /рекомендательный характер/);
  console.log(`PASS ${kind}: real extraction -> units -> functions -> comparison -> cited conclusion`);
}
