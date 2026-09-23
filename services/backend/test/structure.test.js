import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStructure, successorContext } from '../src/pipeline/structure.js';

const docs = ['before', 'after'].map(side => ({ doc_id: `${side}_1`, side, filename: `${side}.docx`, clauses: [
  { clause_id: '1', text: 'Структура', ref: 'абзац 1' },
  { clause_id: '1.1', text: side === 'before' ? 'Отдел аудита (АУД)' : 'Отдел проверок (ПРВ)', ref: 'абзац 2' },
  { clause_id: '5', text: 'Права и обязанности', ref: 'абзац 3' },
  { clause_id: '5.1', text: 'Проводит проверки филиалов.', ref: 'абзац 4' },
] }));
function llm(answer) { return { async completeJson({name,schema,prompt}) {
  if (name.startsWith('structure:')) {
    const before = name.includes('before');
    return schema.parse({ units: [{name: before?'Отдел аудита':'Отдел проверок', abbr: before?'АУД':'ПРВ', kind:'department',parent:null,source_clause:'1.1'}] });
  }
  assert.match(prompt, /before_1 · 5\.1/);
  assert.match(prompt, /after_1 · 5\.1/);
  if (answer instanceof Error) throw answer;
  return schema.parse(answer);
} }; }

test('successor assessment receives duties and document-qualified evidence', async () => {
  assert.match(successorContext(docs), /before_1 · 5\.1/);
  const result = await buildStructure(docs, llm({changes:[{unit:'АУД',successors:['ПРВ'],reason:'Перенос обязанностей: до 5.1, после 5.1'}]}));
  assert.equal(result.unit_changes.find(c=>c.before).status,'reorganized');
});

test('failed, omitted, duplicate or unknown successor decisions never become removal', async () => {
  for (const answer of [new Error('timeout'), {changes:[]}, {changes:[{unit:'АУД',successors:['UNKNOWN'],reason:'test'}]}, {changes:[{unit:'АУД',successors:[],reason:'test'},{unit:'АУД',successors:[],reason:'test'}]}]) {
    await assert.rejects(buildStructure(docs,llm(answer)), { code:'structure_incomplete' });
  }
});

test('an explicit complete assessment may still find no successor', async () => {
  const result = await buildStructure(docs, llm({changes:[{unit:'АУД',successors:[],reason:'Нет подтверждённой преемственности'}]}));
  assert.equal(result.unit_changes.find(c=>c.before).status,'removed');
});
