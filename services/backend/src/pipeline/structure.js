// Stage 2 (docs/TASK.md §4): units per document and the diff between sides.
//
// Code regex-extracts «Название (АББР)» candidates and picks the structure
// section; the LLM completes kinds and hierarchy; code drops any unit whose
// name or abbreviation is not in its cited clause. The diff (kept / created /
// removed) is pure code keyed by abbreviation; one LLM call maps removed units
// to successors, which turns "removed" into "reorganized".
import { prompt } from "../prompts.js";
import { StructureResponse, SuccessorsResponse } from "../schemas.js";
import { HttpError } from "../httpError.js";
import { normalize, tokens, topLevel, unitKey, uniq } from "./util.js";

const UNIT_WORD = "(?:Блок|Департамент|Управление|Отдел|Служба|Направление|Сектор|Группа|Центр|Дирекция|Комитет|Лаборатория|Филиал|Представительство|Служба)";
const CANDIDATE = new RegExp(`(${UNIT_WORD}[^()«»;:]{0,120}?)\\s*\\((?:далее\\s*[–—-]?\\s*)?([А-ЯЁA-Z]{2,12})\\)`, "gu");
const SECTION_HINT = /структур|организац|подчиня|состоит из/i;
const MAX_SECTION_CHARS = 24_000;

/** «Название (АББР)» pairs found by regex anywhere in the document, first occurrence per abbr. */
export function unitCandidates(clauses) {
  const seen = new Map();
  for (const clause of clauses) {
    for (const match of clause.text.matchAll(CANDIDATE)) {
      const abbr = match[2];
      if (!seen.has(abbr)) seen.set(abbr, { name: match[1].trim(), abbr, clause_id: clause.clause_id });
    }
  }
  return [...seen.values()];
}

/** Clauses of the top-level section(s) that describe the structure, capped in size. */
export function structureSection(clauses) {
  const sections = new Map();
  for (const clause of clauses) {
    const key = topLevel(clause.clause_id);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(clause);
  }
  const candidates = new Set(unitCandidates(clauses).map((c) => topLevel(c.clause_id)));
  const picked = [];
  for (const [key, list] of sections) {
    const heading = list.find((c) => c.clause_id === key);
    const headingHit = heading && SECTION_HINT.test(heading.text);
    const bodyHits = list.filter((c) => SECTION_HINT.test(c.text)).length;
    if (headingHit || bodyHits >= 3 || candidates.has(key)) picked.push(...list);
  }
  const chosen = picked.length ? picked : clauses;
  let total = 0;
  return chosen.filter((c) => (total += c.text.length + 12) <= MAX_SECTION_CHARS);
}

const renderClauses = (clauses) => clauses.map((c) => `[${c.clause_id}] ${c.text}`).join("\n");

// Succession needs duties as evidence, not only the list of job titles.
export function successorContext(docs) {
  const selected = [];
  for (const doc of docs) {
    const structural = new Set(structureSection(doc.clauses).map(c => c.clause_id));
    const dutySections = new Set(doc.clauses.filter(c => c.clause_id === topLevel(c.clause_id) && /функци|обязанност|полномочи/i.test(c.text)).map(c => c.clause_id));
    for (const c of doc.clauses) {
      if (structural.has(c.clause_id) || dutySections.has(topLevel(c.clause_id))) selected.push(`[${doc.doc_id} · ${c.clause_id}] ${c.text}`);
    }
  }
  let size = 0;
  return selected.filter(line => (size += line.length + 1) <= 48_000).join("\n");
}

const sideLabel = (side) => (side === "before" ? "до реорганизации" : "после реорганизации");

/** Units of one document: LLM proposes, code verifies each against its cited clause. */
export async function extractUnits(doc, llm) {
  const section = structureSection(doc.clauses);
  const candidates = unitCandidates(doc.clauses);
  const byId = new Map(doc.clauses.map((c) => [c.clause_id, c]));
  const response = await llm.completeJson({
    name: `structure:${doc.doc_id}`,
    schema: StructureResponse,
    prompt: prompt("structure", {
      label: `${sideLabel(doc.side)}, ${doc.filename}`,
      candidates: candidates.length ? candidates.map((c) => `${c.name} (${c.abbr}) — п. ${c.clause_id}`).join("; ") : "не найдены",
      clauses: renderClauses(section),
    }),
  });
  const units = [];
  const dropped = [];
  for (const unit of response.units) {
    const clause = byId.get(unit.source_clause);
    const text = clause ? normalize(clause.text) : "";
    const abbr = unit.abbr ? unit.abbr.trim() : null;
    // Stem-based so «Направление внутреннего аудита» is found in «Директор направления внутреннего аудита».
    const nameStems = [...tokens(unit.name)].slice(0, 3);
    const textStems = clause ? tokens(clause.text) : new Set();
    const nameOk = text.includes(normalize(unit.name)) || (nameStems.length > 0 && nameStems.every((stem) => textStems.has(stem)));
    const abbrOk = abbr ? text.includes(normalize(abbr)) : false;
    if (!clause || !(nameOk || abbrOk)) {
      dropped.push(unit.name);
      continue;
    }
    const key = unitKey({ name: unit.name, abbr });
    if (units.some((u) => u.key === key)) continue;
    units.push({
      unit_id: `u_${doc.side}_${units.length + 1}`,
      side: doc.side,
      doc_id: doc.doc_id,
      key,
      name: unit.name.trim().replace(/^./, (ch) => ch.toUpperCase()),
      abbr,
      kind: unit.kind,
      parent: unit.parent ?? null,
      source_clause: unit.source_clause,
      source_ref: clause.ref,
    });
  }
  if (dropped.length) console.warn(`[structure] ${doc.doc_id}: dropped ${dropped.length} unverified unit(s): ${dropped.join(", ")}`);
  return { units, dropped: dropped.length };
}

/** Pure diff by key. Removed units come back separately so the caller can ask for successors. */
export function diffUnits(before, after) {
  const beforeByKey = new Map(before.map((u) => [u.key, u]));
  const afterByKey = new Map(after.map((u) => [u.key, u]));
  const changes = [];
  for (const unit of after) {
    const prev = beforeByKey.get(unit.key);
    changes.push(
      prev
        ? { status: "kept", before: prev.unit_id, after: unit.unit_id, successors: [], reason: `есть в обоих комплектах: до п. ${prev.source_clause}, после п. ${unit.source_clause}` }
        : { status: "created", before: null, after: unit.unit_id, successors: [], reason: `нет в документах «до»; после п. ${unit.source_clause}` },
    );
  }
  const removed = before.filter((u) => !afterByKey.has(u.key));
  return { changes, removed };
}

/**
 * @param {Array<{doc_id, side, filename, clauses}>} docs
 * @returns {Promise<{units: object[], unit_changes: object[], stats: object}>}
 */
export async function buildStructure(docs, llm) {
  const perDoc = await Promise.all(docs.map((doc) => extractUnits(doc, llm)));
  const all = perDoc.flatMap((r) => r.units);
  // One list per side; a unit named in several documents of a side is kept once.
  const bySide = { before: [], after: [] };
  for (const unit of all) {
    if (!bySide[unit.side].some((u) => u.key === unit.key)) bySide[unit.side].push(unit);
  }
  bySide.before.forEach((u, i) => (u.unit_id = `u_before_${i + 1}`));
  bySide.after.forEach((u, i) => (u.unit_id = `u_after_${i + 1}`));

  const { changes, removed } = diffUnits(bySide.before, bySide.after);
  if (removed.length) {
    const labelOf = (u) => (u.abbr ? `${u.abbr} — ${u.name}` : u.name);
    let successorsOf = new Map();
    try {
      const response = await llm.completeJson({
        name: "successors",
        schema: SuccessorsResponse.refine(answer => answer.changes.length === removed.length && removed.every(unit => {
          const rows = answer.changes.filter(c => normalize(c.unit) === normalize(unit.key));
          return rows.length === 1 && rows[0].successors.every(key => bySide.after.some(u => normalize(u.key) === normalize(key)));
        }), "Return every removed unit exactly once, with only supplied successor keys"),
        prompt: prompt("successors", {
          removed: removed.map((u) => `${u.key}: ${labelOf(u)} (до п. ${u.source_clause})`).join("; "),
          after_units: bySide.after.map((u) => `${u.key}: ${labelOf(u)} (после п. ${u.source_clause})`).join("; "),
          before_clauses: successorContext(docs.filter((d) => d.side === "before")),
          after_clauses: successorContext(docs.filter((d) => d.side === "after")),
        }),
      });
      successorsOf = new Map(response.changes.map((c) => [normalize(c.unit), c]));
    } catch (err) {
      throw new HttpError(502, "structure_incomplete", "Не удалось оценить реорганизацию всех подразделений. Анализ остановлен; упразднение не установлено. Повторите анализ.");
    }
    const afterKeys = new Map(bySide.after.map((u) => [normalize(u.key), u]));
    for (const unit of removed) {
      const answer = successorsOf.get(normalize(unit.key));
      const successors = uniq((answer?.successors ?? []).map((s) => afterKeys.get(normalize(s))?.unit_id).filter(Boolean));
      changes.push({
        status: successors.length ? "reorganized" : "removed",
        before: unit.unit_id,
        after: null,
        successors,
        reason: answer?.reason || `нет в документах «после»; до п. ${unit.source_clause}`,
      });
    }
  }
  const order = { created: 0, reorganized: 1, removed: 2, kept: 3 };
  changes.sort((a, b) => order[a.status] - order[b.status]);
  return {
    units: [...bySide.before, ...bySide.after],
    unit_changes: changes,
    stats: {
      units_before: bySide.before.length,
      units_after: bySide.after.length,
      units_dropped_unverified: perDoc.reduce((n, r) => n + r.dropped, 0),
      created: changes.filter((c) => c.status === "created").length,
      reorganized: changes.filter((c) => c.status === "reorganized").length,
      removed: changes.filter((c) => c.status === "removed").length,
      kept: changes.filter((c) => c.status === "kept").length,
    },
  };
}
