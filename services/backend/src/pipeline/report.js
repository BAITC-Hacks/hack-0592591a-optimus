// Stage 5: render verified records directly. A second freeform model response
// cannot add claims, remove evidence, or silently truncate the finding list.
import { HttpError } from '../httpError.js';
import { FINDING_LABELS, clauseIndexOf, verifyFindings } from './compare.js';
import { quoteOf } from './util.js';

export const DISCLAIMER = 'Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.';
const escape = value => String(value ?? '').replace(/\s+/g, ' ').replace(/[\\`*_{}\[\]()<>#+!|]/g, '\\$&');
export const refOf = c => `[${c.side === 'before' ? 'до' : 'после'} · ${escape(c.doc_id)} · п. ${escape(c.clause_id)}]`;
const STATUS = { created: 'распознано только в «после» (возможное создание)', kept: 'распознано в обоих комплектах', removed: 'распознано только в «до» (преемник не установлен)', reorganized: 'возможная реорганизация / перераспределение обязанностей' };
const ACTION = {
  POTENTIAL_LOSS: 'Проверить, где закреплён полный объём обязанности; при необходимости явно назначить исполнителя.',
  POTENTIAL_DUPLICATION: 'Уточнить границы обязанностей подразделений и необходимость совместного исполнения.',
  OVERLAP: 'Проверить, дополняет ли частная обязанность общую норму без избыточного дублирования.',
  POTENTIAL_CONFLICT: 'Проверить независимость исполнителя и контролёра и разграничение их полномочий.',
  MOVED: 'Подтвердить передачу обязанности и полномочия нового исполнителя.',
  NOTE: 'Проверить применение новой нормы в связанных документах.',
};
const incomplete = () => new HttpError(502, 'report_unverified', 'Не удалось подтвердить источники заключения. Анализ не завершён; повторите анализ.');

export async function writeConclusion({ findings, units, unit_changes, stats = {}, documents = [] }) {
  const index = clauseIndexOf(documents);
  if (verifyFindings(findings, index).dropped) throw incomplete();
  const unitById = new Map(units.map(u => [u.unit_id, u]));
  const unitSource = id => {
    const u = unitById.get(id);
    const c = u && index.get(`${u.doc_id}:${u.source_clause}`);
    if (!c || c.side !== u.side || !c.text.trim()) throw incomplete();
    return { unit: u, citation: { doc_id: u.doc_id, side: u.side, clause_id: u.source_clause, ref: c.ref, quote: quoteOf(c.text) } };
  };
  const evidence = c => `  - ${refOf(c)} (${escape(c.ref)}): «${escape(c.quote)}»`;
  const lines = [
    '## Итоги анализа', '',
    `Проверенных наблюдений: ${findings.length}. Возможная потеря: ${findings.filter(f => f.type === 'POTENTIAL_LOSS').length}; дублирование: ${findings.filter(f => f.type === 'POTENTIAL_DUPLICATION').length}; конфликт независимости: ${findings.filter(f => f.type === 'POTENTIAL_CONFLICT').length}.`, '',
    'Результат относится к распознанным подразделениям и функциям в переданных документах. Отсутствие наблюдения не доказывает отсутствие проблемы. Классификация и возможная преемственность требуют проверки по полным документам.',
  ];
  if (stats.dropped_unverified || stats.units_dropped_unverified || stats.duplicate_pairs_unreviewed) {
    lines.push('', 'Часть кандидатов не подтверждена источниками или не проверена. Полноту результата необходимо проверить вручную.');
  }
  lines.push('', '## Изменения подразделений', '');
  if (!unit_changes.length) lines.push('Изменения подразделений не распознаны; это не подтверждает неизменность структуры.');
  for (const change of unit_changes) {
    const sources = [...new Set([change.before, change.after, ...(change.successors ?? [])].filter(Boolean))].map(unitSource);
    if (!sources.length) throw incomplete();
    const label = sources.map(s => escape(s.unit.abbr || s.unit.name)).join(' → ');
    lines.push(`- ${label}: ${STATUS[change.status] ?? 'требует проверки'}.`, ...sources.map(s => evidence(s.citation)));
  }
  for (const [title, types] of [
    ['Возможная потеря функций', ['POTENTIAL_LOSS']],
    ['Возможное дублирование и пересечения', ['POTENTIAL_DUPLICATION', 'OVERLAP']],
    ['Возможные конфликты независимости', ['POTENTIAL_CONFLICT']],
    ['Перераспределение и новые нормы', ['MOVED', 'NOTE']],
  ]) {
    lines.push('', `## ${title}`, '');
    const rows = findings.filter(f => types.includes(f.type));
    if (!rows.length) lines.push('Среди распознанных функций проверенных наблюдений этой категории нет.');
    for (const f of rows) {
      lines.push(`- ${escape(f.finding_id)} — ${FINDING_LABELS[f.type]}. Требует проверки.`, ...f.citations.map(evidence));
    }
  }
  lines.push('', '## Рекомендации', '');
  for (const type of Object.keys(ACTION)) {
    const rows = findings.filter(f => f.type === type);
    if (rows.length) lines.push(`- ${ACTION[type]} Основание: ${rows.map(f => escape(f.finding_id)).join(', ')} (источники приведены выше).`);
  }
  if (!findings.length) lines.push('Проверить полноту распознавания и сопоставления обязанностей по исходным документам.');
  lines.push('', '## Исходные документы', '', ...documents.map(d => `- ${escape(d.doc_id)}: ${escape(d.filename)}`));
  return { conclusion_md: `${lines.join('\n')}\n\n---\n\n_${DISCLAIMER}_\n`, stats: { conclusion: 'verified', refs_stripped: 0 } };
}
