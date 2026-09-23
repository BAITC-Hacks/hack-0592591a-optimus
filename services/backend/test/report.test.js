import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeConclusion, DISCLAIMER } from '../src/pipeline/report.js';
const documents = [{doc_id:'before_1',side:'before',filename:'[audit].pdf',clauses:[{clause_id:'1',text:'Отдел проводит аудит.',ref:'абзац 1'}]}];
const citation = {doc_id:'before_1',side:'before',clause_id:'1',quote:'Отдел проводит аудит.',ref:'абзац 1'};
const finding = {finding_id:'f_001',type:'POTENTIAL_LOSS',citations:[citation],title:'UNSUPPORTED CLAIM',explanation:'UNSUPPORTED CLAIM'};
const input = {findings:[finding],units:[],unit_changes:[],documents};

test('report cannot retain unsupported model prose and includes document identity and disclaimer', async () => {
  const out = await writeConclusion({...input,llm:{completeJson(){throw new Error('must not call model');}}});
  assert.equal(out.stats.conclusion,'verified');
  assert.ok(!out.conclusion_md.includes('UNSUPPORTED CLAIM'));
  assert.ok(out.conclusion_md.includes('[до · before\\_1 · п. 1]'));
  assert.ok(out.conclusion_md.includes('before\\_1: \\[audit\\].pdf'));
  assert.ok(out.conclusion_md.includes(citation.quote));
  assert.ok(out.conclusion_md.trim().endsWith(`_${DISCLAIMER}_`));
});

test('report rejects an invalid citation instead of removing its token and keeping the claim', async () => {
  await assert.rejects(writeConclusion({...input,findings:[{...finding,citations:[{...citation,quote:'Отдел не проводит аудит.'}]}]}),{code:'report_unverified'});
});

test('report includes every finding beyond the old 60-finding cutoff', async () => {
  const findings = Array.from({length:65},(_,i)=>({...finding,finding_id:`finding-${i}`}));
  const out=await writeConclusion({...input,findings});
  for (const f of findings) assert.ok(out.conclusion_md.includes(`${f.finding_id} —`));
});

test('unit claims require their own source and never reuse model reasons as facts', async () => {
  const units=[{unit_id:'u1',doc_id:'before_1',side:'before',name:'Отдел',source_clause:'1'}];
  const unit_changes=[{status:'removed',before:'u1',after:null,successors:[],reason:'UNSUPPORTED CLAIM'}];
  const out=await writeConclusion({...input,units,unit_changes});
  assert.ok(!out.conclusion_md.includes('UNSUPPORTED CLAIM'));
  assert.ok(out.conclusion_md.includes('преемник не установлен'));
  await assert.rejects(writeConclusion({...input,units:[{...units[0],source_clause:'99'}],unit_changes}),{code:'report_unverified'});
});
