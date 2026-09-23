import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRelevantDocuments, documentSample, lexicalShare } from "../src/pipeline/classify.js";

const doc = (side, filename, texts) => ({
  doc_id: `${side}_1`, side, filename, title: null, preamble: "",
  clauses: texts.map((text, i) => ({ clause_id: String(i + 1), text })),
});
const manual = (side) => doc(side, "instructions.pdf", ["Unpack the box and check the parts list.", "Attach the side panels with the 4 mm screws.", "Do not overtighten."]);
const regulation = (side) => doc(side, "polozhenie.docx", ["Департамент аудита (ДА) проводит проверки.", "ДА готовит отчёты о результатах.", "Управление рисков ведёт реестр рисков."]);
const llm = (answer) => ({ completeJson: async ({ schema }) => schema.parse(typeof answer === "function" ? answer() : answer) });

test("a manual uploaded as «до» fails with irrelevant_document naming the file", async () => {
  const documents = [manual("before"), regulation("after")];
  const model = llm(() => ({ relevant: false, kind: "other", summary: "Инструкция по сборке мебели", reason: "Нет подразделений и функций" }));
  model.completeJson = async ({ prompt, schema }) => schema.parse(prompt.includes("Unpack") ? { relevant: false, kind: "other", summary: "Инструкция по сборке мебели", reason: "Нет подразделений и функций." } : { relevant: true, kind: "org_structure", summary: "Положение", reason: "" });
  await assert.rejects(assertRelevantDocuments(documents, model), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, "irrelevant_document");
    assert.match(err.message, /«instructions.pdf» \(«до»\): Инструкция по сборке мебели\. Нет подразделений и функций/);
    assert.equal(err.filename, "instructions.pdf");
    return true;
  });
  assert.equal(documents[0].classification.relevant, false);
  assert.equal(documents[1].classification.relevant, true);
});

test("relevant documents pass and carry their classification", async () => {
  const documents = [regulation("before"), regulation("after"), { ...regulation("regulation"), side: "regulation" }];
  const verdicts = await assertRelevantDocuments(documents, llm({ relevant: true, kind: "org_structure", summary: "Положение об оргструктуре", reason: "Перечислены подразделения" }));
  assert.equal(verdicts.length, 2);
  assert.equal(documents[0].classification.kind, "org_structure");
  assert.equal(documents[2].classification, undefined);
});

test("a model false negative is overridden when most clauses name units or functions", async () => {
  const documents = [regulation("before"), regulation("after")];
  await assertRelevantDocuments(documents, llm({ relevant: false, kind: "other", summary: "", reason: "не уверен" }));
  assert.equal(documents[0].classification.relevant, true);
  assert.match(documents[0].classification.reason, /Оставлен: 67%/);
  assert.equal(lexicalShare(manual("before")), 0);
});

test("a failing classifier call never blocks the analysis", async () => {
  const documents = [manual("before"), manual("after")];
  const verdicts = await assertRelevantDocuments(documents, { completeJson: async () => { throw new Error("timeout"); } });
  assert.equal(verdicts[0].checked, false);
  assert.equal(documents[0].classification.relevant, true);
});

test("the sample keeps the head of the document and a spread over the rest within the budget", () => {
  const texts = Array.from({ length: 200 }, (_, i) => `Пункт ${i + 1} ${"текст ".repeat(30)}`);
  const sample = documentSample({ ...doc("before", "x.docx", texts), title: "Положение", preamble: "Общие положения" });
  assert.ok(sample.startsWith("Заголовок: Положение\nОбщие положения\n[1] "));
  assert.ok(sample.length <= 3500);
});
