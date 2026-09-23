import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildClauses, continuesNumbering } from "../src/pipeline/clauses.js";

const demo = JSON.parse(readFileSync(new URL("./fixtures/redakciya_9_extract.json", import.meta.url)));
const byId = (result) => new Map(result.clauses.map((c) => [c.clause_id, c]));

test("continuesNumbering accepts child, sibling and ancestor sibling only", () => {
  assert.equal(continuesNumbering("3.9", "3.10"), true);
  assert.equal(continuesNumbering("3.9", "3.9.1"), true);
  assert.equal(continuesNumbering("9.60", "10"), true);
  assert.equal(continuesNumbering("5.3.2", "5.4"), true);
  assert.equal(continuesNumbering(null, "1"), true);
  assert.equal(continuesNumbering("3.9", "3"), false); // "см. п. 3." is a reference, not a new clause
  assert.equal(continuesNumbering("3.9", "3.12"), false);
  assert.equal(continuesNumbering("3.9", "3.9.2"), false);
});

test("demo ред. 9: glued ids inside a sub-item and a fragment are split into their own clauses", () => {
  const clauses = byId(buildClauses(demo, { docId: "after_1", side: "after" }));
  const b = clauses.get("3.9.б");
  assert.equal(b.text, "Руководитель направления.");
  assert.equal(b.parent_id, "3.9");
  const c310 = clauses.get("3.10");
  assert.equal(c310.text, "Рабочие места работников БВА могут располагаться в филиалах Общества.");
  assert.equal(c310.ref, "п. 3.10, стр. 6, строки 31–35");
  assert.equal(c310.parent_id, "3");
  assert.ok(clauses.get("3.11").text.startsWith("Работники могут выполнять"));
  // "3.12.По вопросам…" starts a fragment with clause null (no space after the id).
  assert.ok(clauses.get("3.12").text.startsWith("По вопросам соблюдения"));
  assert.equal(clauses.get("3.12").ref, "п. 3.12, стр. 6, строки 36–37");
});

test("demo ред. 9: sub-items become child clauses, page numbers and the «Оглавление» tail are dropped", () => {
  const result = buildClauses(demo, { docId: "after_1", side: "after" });
  const clauses = byId(result);
  const a = clauses.get("5.3.2.а");
  assert.equal(a.parent_id, "5.3.2");
  assert.ok(a.text.startsWith("аудит ИТ систем"));
  assert.equal(a.ref, "п. 5.3.2.а, стр. 8, строки 24–26");
  assert.equal(clauses.get("5.3").text, "Директоры департаментов и Директоры направлений ДИТААД и ДОА:");
  assert.ok(clauses.get("4").text.startsWith("Внутренний аудит в ДЗО"));
  assert.ok(![...clauses.values()].some((c) => /^\d+$/.test(c.text)), "a page number leaked into a clause");
  assert.equal(result.stats.page_numbers_dropped, 1);
  assert.equal(result.stats.tail_dropped, 4);
  assert.equal(result.stats.duplicate_ids, 0);
  for (const clause of result.clauses) {
    assert.equal(clause.doc_id, "after_1");
    assert.equal(clause.side, "after");
    assert.ok(clause.fragment_ids.length > 0);
    assert.match(clause.ref, /стр\. \d+, строк/);
  }
});

test("ordinary content text and inline references do not discard or split duties", () => {
  const fragments = [
    { id: "f1", kind: "paragraph", text: "3.9. Содержание отчета определяется директором согласно п. 3.10. Порядок согласования сохраняется.", clause: "3.9", ref: "п. 3.9, абзац 1" },
    { id: "f2", kind: "paragraph", text: "Содержание отчета проверяется директором.", clause: null, ref: "абзац 2" },
    { id: "f3", kind: "paragraph", text: "3.10. Отдел проверяет выполнение обязательств.", clause: "3.10", ref: "п. 3.10, абзац 3" },
  ];
  const result = buildClauses({ fragments }, { docId: "before_1", side: "before" });
  assert.deepEqual(result.clauses.map(c => c.clause_id), ["3.9", "3.10"]);
  assert.match(result.clauses[0].text, /согласно п\. 3\.10/);
  assert.match(result.clauses[0].text, /Содержание отчета проверяется/);
  assert.equal(result.stats.tail_dropped, 0);
});

test("unnumbered paragraphs and Word table rows retain independent source references", () => {
  const fragments = [
    { id: "f1", kind: "paragraph", text: "Отдел планирует ежегодные проверки.", ref: "абзац 1" },
    { id: "f2", kind: "table_row", text: "Отдел контролирует исполнение договорных обязательств.", ref: "таблица 1, строка 1" },
  ];
  const result = buildClauses({ fragments }, { docId: "before_1", side: "before" });
  assert.deepEqual(result.clauses.map(c => [c.clause_id, c.text, c.ref]), fragments.map(f => [`fragment:${f.id}`, f.text, f.ref]));
});

test("clause text excludes its label; a number that does not continue the sequence stays text", () => {
  const extraction = {
    fragments: [
      { id: "f1", kind: "paragraph", text: "1. Общие положения", clause: "1", marker: null, ref: "п. 1, абзац 1", location: { paragraph: 1 } },
      { id: "f2", kind: "paragraph", text: "1.1. Отдел выполняет функции, см. п. 3. Настоящего положения.", clause: "1.1", marker: null, ref: "п. 1.1, абзац 2", location: { paragraph: 2 } },
      { id: "f3", kind: "list_item", text: "а) планирует закупки;", clause: null, marker: "а", ref: "абзац 3", location: { paragraph: 3 } },
      { id: "f4", kind: "paragraph", text: "с учётом бюджета.", clause: null, marker: null, ref: "абзац 4", location: { paragraph: 4 } },
    ],
  };
  const result = buildClauses(extraction, { docId: "before_1", side: "before" });
  assert.deepEqual(
    result.clauses.map((c) => [c.clause_id, c.text, c.ref]),
    [
      ["1", "Общие положения", "п. 1, абзац 1"],
      ["1.1", "Отдел выполняет функции, см. п. 3. Настоящего положения.", "п. 1.1, абзац 2"],
      ["1.1.а", "планирует закупки; с учётом бюджета.", "п. 1.1.а, абзац 3"],
    ],
  );
  assert.deepEqual(result.clauses[2].fragment_ids, ["f3", "f4"]);
});

test("Excel rows are separate records cited by sheet and row", () => {
  const extraction = {
    fragments: [
      { id: "f1", kind: "sheet_row", text: "Код | Подразделение", clause: null, marker: null, ref: "лист «Структура», строка 1", location: { sheet: "Структура", row: 1 } },
      { id: "f2", kind: "sheet_row", text: "101 | Отдел закупок", clause: null, marker: null, ref: "лист «Структура», строка 2", location: { sheet: "Структура", row: 2 } },
    ],
  };
  const result = buildClauses(extraction, { docId: "before_1", side: "before" });
  assert.deepEqual(
    result.clauses.map((c) => [c.clause_id, c.text, c.ref]),
    [
      ["Структура!1", "Код | Подразделение", "лист «Структура», строка 1"],
      ["Структура!2", "101 | Отдел закупок", "лист «Структура», строка 2"],
    ],
  );
});
