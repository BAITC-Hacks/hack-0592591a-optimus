// Stage 4 rules without a key: a stubbed llm answers the judge and the conflict
// review; embeddings are stubbed vectors or null (lexical fallback).
import assert from "node:assert/strict";
import { test } from "node:test";

import { compareFunctions, matchFunctions, verifyFindings, clauseIndexOf } from "../src/pipeline/compare.js";
import { refOf } from "../src/pipeline/report.js";
import { diffUnits, unitCandidates } from "../src/pipeline/structure.js";
import { expandOwners, isCandidate, sectionsOf } from "../src/pipeline/extract.js";
import { jaccard, normalize, quoteOf, tokens } from "../src/pipeline/util.js";

let counter = 0;
function fn(side, clauseId, text, owners, category = "other", canonical = text.slice(0, 40)) {
  counter++;
  return {
    func_id: `${side === "before" ? "fb" : "fa"}_${String(counter).padStart(3, "0")}`,
    doc_id: `${side}_1`,
    side,
    clause_id: clauseId,
    ref: `п. ${clauseId}, стр. 1, строка ${counter}`,
    owners,
    canonical,
    category,
    quote: quoteOf(text),
    text,
  };
}
const docsOf = (before, after) => [
  { doc_id: "before_1", side: "before", clauses: before.map((f) => ({ doc_id: "before_1", clause_id: f.clause_id, text: f.text, ref: f.ref })) },
  { doc_id: "after_1", side: "after", clauses: after.map((f) => ({ doc_id: "after_1", clause_id: f.clause_id, text: f.text, ref: f.ref })) },
];
const UNITS = [
  { unit_id: "u_after_1", side: "after", name: "Блок внутреннего аудита", abbr: "БВА", kind: "block", parent: null },
  { unit_id: "u_after_2", side: "after", name: "Департамент непрерывного мониторинга", abbr: "ДНМ", kind: "department", parent: "БВА" },
  { unit_id: "u_after_3", side: "after", name: "Департамент контроля качества аудита и методологии", abbr: "ДККМ", kind: "department", parent: "БВА" },
];

function stubLlm({ judge = [], conflict = [], duplicates = [], vectors = null } = {}) {
  const stats = { calls: 0, retries: 0, model: "stub", embeddings: vectors ? "ok" : "unavailable" };
  return {
    stats,
    model: "stub",
    async completeJson({ name, schema }) {
      stats.calls++;
      if (name.startsWith("judge")) return schema.parse({ results: judge });
      if (name.startsWith("dupjudge")) return schema.parse({ results: duplicates });
      if (name.startsWith("conflict")) return schema.parse({ reviews: conflict });
      throw new Error(`unexpected llm call ${name}`);
    },
    async embed(texts) {
      if (!vectors) return null;
      return texts.map((t) => vectors[t] ?? [0, 0, 1]);
    },
  };
}

test("helpers: normalize, tokens, jaccard, quoteOf", () => {
  assert.equal(normalize("Ёлка, «пункт» 5.3.2!"), "елка пункт 5 3 2");
  assert.ok(tokens("готовит предложения для включения в план работ").has("готов"));
  assert.ok(jaccard(tokens("готовит предложения для включения в план работ БВА"), tokens("готовят предложения для включения в план работ БВА")) >= 0.99);
  const long = "слово ".repeat(80).trim();
  assert.ok(quoteOf(long).length <= 300 && long.startsWith(quoteOf(long)));
});

test("only exact source text bypasses the judge; lexical similarity selects candidates", async () => {
  const before = [fn("before", "5.4.2", "готовит предложения для включения в план работ БВА;", ["ДНМ"], "plan"), fn("before", "5.4.7", "выносит предложения по повышению профессионального уровня работников ДНМ Главному аудитору;", ["ДНМ"], "other")];
  const after = [fn("after", "5.4.2", "готовит предложения для включения в план работ БВА;", ["ДНМ"], "plan"), fn("after", "5.4.6", "выносят предложения по повышению профессионального уровня работников ДНМ Главному аудитору.", ["ДНМ"], "other")];
  const llm = stubLlm({ judge: [{ id: before[1].func_id, candidate_id: after[1].func_id, relation: "same", confidence: 0.9 }] });
  const { matches } = await matchFunctions({ before, after, llm });
  assert.deepEqual(matches[0].steps, ["exact"]);
  assert.equal(matches[0].relation, "same");
  assert.equal(matches[1].after_id, after[1].func_id);
  assert.equal(matches[1].steps.at(-1), "judge");
  assert.equal(llm.stats.calls, 1);
});

test("step 3 embeddings pick the candidate, step 4 judge accepts it; owner change makes it moved", async () => {
  const before = [fn("before", "5.3.3", "организует по решению Главного аудитора руководство курируемых плановых и внеплановых проверок по Обществу", ["Направление ВА"], "perform_audit", "руководить курируемыми проверками")];
  const after = [
    fn("after", "5.3.2", "обеспечивают кураторство аудиторских заданий согласно решению руководителя блока", ["ДНМ", "ДККМ"], "perform_audit", "курировать аудиторские задания"),
    fn("after", "5.4.2", "готовит предложения для включения в план работ БВА;", ["ДНМ"], "plan", "готовить предложения в план"),
  ];
  const vectors = { [`${before[0].canonical} ${before[0].text}`]: [1, 0, 0], [`${after[0].canonical} ${after[0].text}`]: [0.95, 0.1, 0], [`${after[1].canonical} ${after[1].text}`]: [0, 1, 0] };
  const llm = stubLlm({ vectors, judge: [{ id: before[0].func_id, candidate_id: after[0].func_id, relation: "same", confidence: 0.85 }] });
  const { matches, stats } = await matchFunctions({ before, after, llm });
  assert.equal(stats.embeddings, "ok");
  assert.deepEqual(matches[0].steps, ["exact", "jaccard", "embeddings", "judge"]);
  assert.equal(matches[0].after_id, after[0].func_id);
  assert.equal(matches[0].relation, "moved");
  assert.equal(matches[0].basis, "same");
});

test("a weak partial assessment retains both sources instead of claiming full absence", async () => {
  const before = [fn("before", "5.7.2", "доводить до сведения Руководителей Общества результаты по запросу оказания консультационных услуг;", ["ДНМ"], "interact", "доводить результаты консультаций")];
  const after = [fn("after", "2.4.7", "консультировать по запросу и информировать о результатах мониторинга СВК;", ["БВА"], "interact", "консультировать руководителей")];
  const llm = stubLlm({ judge: [{ id: before[0].func_id, candidate_id: after[0].func_id, relation: "partial", confidence: 0.55 }] });
  const { matches } = await matchFunctions({ before, after, llm });
  assert.equal(matches[0].basis, "partial");
  assert.equal(matches[0].after_id, after[0].func_id);
  assert.equal(llm.stats.calls, 1);
});

test("negation and narrowed scope are judged even when canonical labels are identical", async () => {
  for (const [afterText, relation] of [
    ["Отдел не проводит проверку исполнения договорных обязательств", "none"],
    ["Отдел проводит проверку исполнения только новых договорных обязательств", "partial"],
  ]) {
    const before = [fn("before", "1.1", "Отдел проводит проверку исполнения договорных обязательств", ["Отдел"], "other", "проводить проверку")];
    const after = [fn("after", "1.1", afterText, ["Отдел"], "other", "проводить проверку")];
    const llm = stubLlm({ judge: [{ id: before[0].func_id, candidate_id: relation === "none" ? null : after[0].func_id, relation, confidence: 0.9 }] });
    const result = await compareFunctions({ before, after, units: [], docs: docsOf(before, after), llm });
    assert.equal(llm.stats.calls, 1);
    assert.equal(result.matches[0].steps.at(-1), "judge");
    assert.equal(result.findings[0].type, "POTENTIAL_LOSS");
    assert.equal(result.findings[0].citations.length, relation === "partial" ? 2 : 1);
  }
});

test("a confident «partial» judge answer becomes a medium partial-loss finding citing both clauses", async () => {
  const before = [fn("before", "5.7.2", "доводить до сведения Руководителей Общества результаты по запросу оказания консультационных услуг;", ["ДНМ"], "interact", "доводить результаты консультаций")];
  const after = [fn("after", "2.4.7", "консультировать по запросу и информировать о результатах мониторинга СВК;", ["БВА"], "interact", "консультировать руководителей")];
  const llm = stubLlm({ judge: [{ id: before[0].func_id, candidate_id: after[0].func_id, relation: "partial", confidence: 0.8 }] });
  const result = await compareFunctions({ before, after, units: UNITS, docs: docsOf(before, after), llm });
  assert.equal(result.matches[0].relation, "moved");
  assert.equal(result.matches[0].basis, "partial");
  const loss = result.findings.find((f) => f.type === "POTENTIAL_LOSS");
  assert.equal(loss.severity, "medium");
  assert.deepEqual(loss.citations.map((c) => c.clause_id), ["5.7.2", "2.4.7"]);
  assert.equal(result.findings.filter((f) => f.type === "MOVED").length, 0);
});

test("without embeddings the judge sees lexical candidates; none → POTENTIAL_LOSS with the clause quote", async () => {
  const before = [fn("before", "5.6.2", "формировать группы контроля качества с привлечением работников БВА в соответствии с ресурсным планом;", ["ДККМ"], "quality_control", "формировать группы контроля качества")];
  const after = [fn("after", "5.5.2", "организует мониторинг качества работников БВА по плану контроля;", ["ДККМ"], "quality_control", "мониторинг качества аудита")];
  const llm = stubLlm({ judge: [{ id: before[0].func_id, candidate_id: null, relation: "none", confidence: 0.9 }] });
  const result = await compareFunctions({ before, after, units: UNITS, docs: docsOf(before, after), llm });
  assert.equal(result.stats.embeddings, "unavailable");
  assert.equal(result.matches[0].relation, "unmatched");
  assert.deepEqual(result.matches[0].steps, ["exact", "jaccard", "lexical", "judge"]);
  const loss = result.findings.find((f) => f.type === "POTENTIAL_LOSS");
  assert.ok(loss);
  assert.equal(loss.severity, "high");
  assert.equal(loss.citations[0].clause_id, "5.6.2");
  assert.equal(loss.citations[0].quote, before[0].text);
  assert.ok(loss.explanation.endsWith("Требует проверки ответственным сотрудником."));
  assert.equal(result.stats.dropped_unverified, 0);
});

test("judge timeout, missing/duplicate verdict and an unknown candidate cannot become a loss", async () => {
  const before = [fn("before", "5.6.2", "формировать группы контроля качества с привлечением работников БВА в соответствии с ресурсным планом;", ["ДККМ"], "quality_control", "формировать группы контроля качества")];
  const after = [fn("after", "5.5.2", "организует мониторинг качества работников БВА по плану контроля;", ["ДККМ"], "quality_control", "мониторинг качества аудита")];
  const timeout = stubLlm();
  timeout.completeJson = async () => { throw new Error("simulated timeout"); };
  const verdict = { id: before[0].func_id, candidate_id: null, relation: "none", confidence: 0.9 };
  for (const llm of [timeout, stubLlm(), stubLlm({ judge: [verdict, verdict] }), stubLlm({ judge: [{ ...verdict, candidate_id: "invented", relation: "same" }] })]) {
    await assert.rejects(compareFunctions({ before, after, units: UNITS, docs: docsOf(before, after), llm }),
      (error) => error.code === "comparison_incomplete" && error.status === 502);
  }
});

test("failed duplicate review cannot produce an apparently clean comparison", async () => {
  const after = [
    fn("after", "1.1", "планирует закупки оборудования для филиалов", ["А"], "plan", "планирование филиалов"),
    fn("after", "2.1", "планирует закупки оборудования для офиса", ["Б"], "plan", "планирование офиса"),
  ];
  await assert.rejects(compareFunctions({ before: [], after, units: [], docs: docsOf([], after), llm: stubLlm() }),
    (error) => error.code === "comparison_incomplete");
});

test("a shared part of compound duties is a sourced partial duplication, not full equivalence", async () => {
  const after = [
    fn("after", "5.4.3", "запрашивает у Руководителей Общества информацию, необходимую для осуществления функций БВА, контролирует своевременность и полноту предоставления;", ["ДНМ"], "interact", "Запрашивать информацию и контролировать полноту ее предоставления"),
    fn("after", "5.5.8", "запрашивает у Руководителей Общества информацию, которая необходима для осуществления функций контроля качества внутреннего аудита;", ["ДККМ"], "interact", "Запрашивать информацию для контроля качества внутреннего аудита"),
  ];
  const llm = stubLlm({ duplicates: [{ pair_id: 1, relation: "overlap", confidence: 0.9 }] });
  const result = await compareFunctions({ before: [], after, units: UNITS, docs: docsOf([], after), llm });
  assert.equal(llm.stats.calls, 1);
  assert.equal(result.findings[0].type, "POTENTIAL_DUPLICATION");
  assert.match(result.findings[0].explanation, /Частично пересекающиеся/);
  assert.deepEqual(result.findings[0].citations.map(c => c.quote), after.map(f => f.text));
});

test("generic vs specific owners → OVERLAP, disjoint peers → POTENTIAL_DUPLICATION, never both for one pair", async () => {
  const text = "запрашивает у Руководителей Общества информацию, необходимую для осуществления функций БВА;";
  const after = [
    fn("after", "5.3.6", text, ["ДНМ", "ДККМ"], "interact", "запрашивать информацию у руководителей"), // «Директоры департаментов»
    fn("after", "5.4.3", text, ["ДНМ"], "interact", "запрашивать информацию у руководителей"),
    fn("after", "5.5.8", "запрашивает у Руководителей Общества информацию, которая необходима для осуществления функций контроля;", ["ДККМ"], "interact", "запрашивать информацию у руководителей"),
    fn("after", "5.4.10", "осуществляет выполнение прочих поручений Главного аудитора.", ["ДНМ"], "other", "выполнять поручения главного аудитора"),
    fn("after", "5.5.10", "осуществляет выполнение прочих поручений Главного аудитора.", ["ДККМ"], "other", "выполнять поручения главного аудитора"),
  ];
  const result = await compareFunctions({ before: [], after, units: UNITS, docs: docsOf([], after), llm: stubLlm() });
  const pair = (f) => f.citations.map((c) => c.clause_id).sort().join("+");
  const overlaps = result.findings.filter((f) => f.type === "OVERLAP").map(pair);
  const dups = result.findings.filter((f) => f.type === "POTENTIAL_DUPLICATION");
  assert.ok(overlaps.includes("5.3.6+5.4.3"));
  assert.ok(overlaps.includes("5.3.6+5.5.8"));
  assert.ok(!dups.some((f) => pair(f) === "5.3.6+5.4.3"));
  const peer = dups.find((f) => pair(f) === "5.4.3+5.5.8");
  assert.equal(peer.severity, "medium");
  assert.equal(dups.find((f) => pair(f) === "5.4.10+5.5.10").severity, "low");
});

test("conflict candidate: perform_audit + quality_control at one department goes through the LLM review", async () => {
  const after = [
    fn("after", "5.3.5", "проводят проверки и обеспечивают выполнение плана работ БВА", ["ДНМ", "ДККМ"], "perform_audit", "проводить проверки"),
    fn("after", "5.5.2", "организует непрерывный мониторинг качества деятельности внутреннего аудита", ["ДККМ"], "quality_control", "контролировать качество аудита"),
  ];
  const confirmed = await compareFunctions({ before: [], after, units: UNITS, docs: docsOf([], after), llm: stubLlm({ conflict: [{ pair_id: 1, verdict: "potential_conflict", reason: "подразделение проверяет и само оценивает качество проверок" }] }) });
  const finding = confirmed.findings.find((f) => f.type === "POTENTIAL_CONFLICT");
  assert.ok(finding);
  assert.equal(finding.severity, "high");
  assert.equal(finding.review.verdict, "potential_conflict");
  assert.deepEqual(finding.citations.map((c) => c.clause_id).sort(), ["5.3.5", "5.5.2"]);
  assert.deepEqual(finding.units, ["ДККМ"]);

  const rejected = await compareFunctions({ before: [], after, units: UNITS, docs: docsOf([], after), llm: stubLlm({ conflict: [{ pair_id: 1, verdict: "none", reason: "разные объекты" }] }) });
  assert.equal(rejected.findings.filter((f) => f.type === "POTENTIAL_CONFLICT").length, 0);
  assert.equal(rejected.stats.conflict_candidates_rejected, 1);
});

test("verify drops a finding whose quote is not in its clause", () => {
  const clause = { doc_id: "after_1", clause_id: "4.4", text: "Главный аудитор раскрывает конфликт интересов.", ref: "п. 4.4" };
  const index = clauseIndexOf([{ doc_id: "after_1", side: "after", clauses: [clause] }]);
  const good = { finding_id: "f_001", type: "NOTE", citations: [{ doc_id: "after_1", side: "after", clause_id: "4.4", ref: "п. 4.4", quote: "раскрывает конфликт интересов" }] };
  const tampered = { finding_id: "f_002", type: "NOTE", citations: [{ doc_id: "after_1", side: "after", clause_id: "4.4", ref: "п. 4.4", quote: "утаивает конфликт интересов" }] };
  const unknown = { finding_id: "f_003", type: "NOTE", citations: [{ doc_id: "after_1", side: "after", clause_id: "9.9", ref: "п. 9.9", quote: "раскрывает" }] };
  const result = verifyFindings([good, tampered, unknown], index);
  assert.deepEqual(result.findings.map((f) => f.finding_id), ["f_001"]);
  assert.equal(result.dropped, 2);
});

test("structure: regex candidates and the diff by abbreviation", () => {
  const clauses = [
    { clause_id: "3.4.а", text: "Департамент ИТ-аудита и анализа данных (ДИТААД);" },
    { clause_id: "3.4.б", text: "Департамент контроля качества аудита и методологии (далее – ДККМ);" },
    { clause_id: "3.4.в", text: "Департамент ИТ-аудита и анализа данных (ДИТААД) — повтор;" },
  ];
  assert.deepEqual(unitCandidates(clauses).map((c) => [c.abbr, c.clause_id]), [["ДИТААД", "3.4.а"], ["ДККМ", "3.4.б"]]);
  const before = [{ unit_id: "u_before_1", key: "ДНМ", source_clause: "3.4.а" }, { unit_id: "u_before_2", key: "направление внутреннего аудита", source_clause: "3.5.а" }];
  const after = [{ unit_id: "u_after_1", key: "ДНМ", source_clause: "3.4.в" }, { unit_id: "u_after_2", key: "ДИТААД", source_clause: "3.4.а" }];
  const { changes, removed } = diffUnits(before, after);
  assert.deepEqual(changes.map((c) => [c.status, c.before, c.after]), [["kept", "u_before_1", "u_after_1"], ["created", null, "u_after_2"]]);
  assert.deepEqual(removed.map((u) => u.key), ["направление внутреннего аудита"]);
});

test("extract: owner strings map to units, ALL_DEPARTMENTS expands to every department", () => {
  assert.deepEqual(expandOwners(["ALL_DEPARTMENTS"], UNITS), ["ДНМ", "ДККМ"]);
  assert.deepEqual(expandOwners(["Директор ДККМ", "днм", "Главный аудитор"], UNITS), ["ДККМ", "ДНМ", "Главный аудитор"]);
  assert.deepEqual(expandOwners(["Блок внутреннего аудита"], UNITS), ["БВА"]);
});

test("function candidates include flat points, Excel rows, fragments and attachments", () => {
  for (const clause_id of ["1", "Лист!2", "fragment:f00001", "Приложение 1"]) {
    assert.ok(isCandidate({ clause_id, text: "Аудит" }));
  }
  assert.equal(isCandidate({ clause_id: "Лист!2", text: "123" }), false);
  assert.equal(sectionsOf([{ clause_id: "1", text: "Приложение: обязанности" }, { clause_id: "1.1", text: "Отдел проводит аудит" }]).length, 1);
  assert.equal(sectionsOf([{ clause_id: "fragment:f1", text: "Отдел" }, { clause_id: "fragment:f2", text: "Аудит" }]).length, 1);
});


test("identical numbering and ancestor-like numbering across documents do not suppress duplicates", async () => {
  for (const number of ["5.1", "5.1.1"]) {
    const after = [fn("after", "5.1", "Готовит предложения в план работ.", ["ДНМ"], "plan"), fn("after", number, "Готовит предложения в план работ.", ["ДККМ"], "plan")];
    after[1].doc_id = "after_2";
    const docs = after.map(f => ({ doc_id: f.doc_id, side: "after", clauses: [{ ...f }] }));
    const out = await compareFunctions({ before: [], after, units: UNITS, docs, llm: stubLlm() });
    const finding = out.findings.find(f => f.type === "POTENTIAL_DUPLICATION");
    assert.ok(finding, number);
    assert.deepEqual(finding.citations.map(c => c.doc_id), ["after_1", "after_2"]);
    assert.notEqual(refOf(finding.citations[0]), refOf(finding.citations[1]));
  }
});

test("source verification preserves side, case and punctuation, allowing whitespace only", () => {
  const docs = [{ doc_id: "after_1", side: "after", clauses: [{ clause_id: "1", text: "Отдел: проверять, нельзя согласовывать." }] }];
  const citation = { doc_id: "after_1", side: "after", clause_id: "1", quote: "проверять,  нельзя согласовывать." };
  const make = changes => ({ type: "NOTE", citations: [{ ...citation, ...changes }] });
  const out = verifyFindings([make({}), make({ side: "before" }), make({ quote: "проверять нельзя, согласовывать." }), make({ quote: "ПРОВЕРЯТЬ" })], clauseIndexOf(docs));
  assert.equal(out.findings.length, 1);
  assert.equal(out.dropped, 3);
});
