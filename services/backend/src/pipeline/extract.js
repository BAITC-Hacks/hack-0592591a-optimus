// Stage 3 (docs/TASK.md §4): clauses -> functions. One LLM call per chunk of a
// top-level section. The LLM only labels (owners, canonical, category); the
// quote is the clause text itself, set by code, so M4 cannot be faked.
import { prompt } from "../prompts.js";
import { ExtractResponse } from "../schemas.js";
import { depth, mapLimit, normalize, quoteOf, tokens, topLevel } from "./util.js";

const SKIP_SECTION = /термин|определени|сокращени|приложени|оглавлени|содержание/i;
const CHUNK = 35; // candidate clauses per LLM call
const MIN_WORDS = 3;
const ALL = "ALL_DEPARTMENTS";

const sideLabel = (side) => (side === "before" ? "до реорганизации" : "после реорганизации");

/** Top-level sections of a document, in order, without terms/appendices. */
export function sectionsOf(clauses) {
  const sections = new Map();
  for (const clause of clauses) {
    const key = topLevel(clause.clause_id);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(clause);
  }
  return [...sections.entries()].filter(([key, list]) => {
    const heading = list.find((c) => c.clause_id === key);
    return !(heading && SKIP_SECTION.test(heading.text));
  });
}

const wordCount = (text) => normalize(text).split(" ").filter(Boolean).length;

/** Clauses the LLM must assess: anything below a top-level heading with enough words. */
export const isCandidate = (clause) => depth(clause.clause_id) >= 2 && wordCount(clause.text) >= MIN_WORDS;

/** Prompt chunks: ≤ CHUNK candidates each, with their ancestor headings for context. */
export function chunkSection(key, list) {
  const byId = new Map(list.map((c) => [c.clause_id, c]));
  const candidates = list.filter(isCandidate);
  const chunks = [];
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const ids = new Set(slice.map((c) => c.clause_id));
    for (const c of slice) {
      let parent = c.parent_id;
      while (parent) {
        if (byId.has(parent)) ids.add(parent);
        parent = byId.get(parent)?.parent_id ?? null;
      }
    }
    if (byId.has(key)) ids.add(key);
    chunks.push({ section: key, context: list.filter((c) => ids.has(c.clause_id)), candidates: slice });
  }
  return chunks;
}

/**
 * Owner strings from the LLM -> unit abbreviations. Inflection-insensitive:
 * «Директор департамента непрерывного мониторинга…» maps to ДНМ because every
 * stem of the unit's name is in the owner string. ALL_DEPARTMENTS expands to
 * every department of the side.
 */
export function expandOwners(owners, units) {
  const departments = units.filter((u) => u.kind === "department").map((u) => u.abbr || u.name);
  const index = units.map((u) => ({ unit: u, abbrStem: u.abbr ? [...tokens(u.abbr)][0] ?? normalize(u.abbr) : null, nameStems: [...tokens(u.name)] }));
  const out = [];
  for (const raw of owners) {
    const norm = normalize(raw);
    if (raw === ALL || ALL_DEPARTMENTS_TEXT.test(norm)) {
      out.push(...departments);
      continue;
    }
    const stems = tokens(raw);
    let best = null;
    for (const entry of index) {
      const byAbbr = entry.abbrStem && (norm === normalize(entry.unit.abbr) || stems.has(entry.abbrStem));
      const byName = entry.nameStems.length > 0 && entry.nameStems.every((stem) => stems.has(stem));
      if (!byAbbr && !byName) continue;
      const weight = byName ? entry.nameStems.length + 10 : 1;
      if (!best || weight > best.weight) best = { unit: entry.unit, weight };
    }
    // Unmapped roles («Куратор проверки») keep their wording, normalized in case and spacing.
    out.push(best ? best.unit.abbr || best.unit.name : raw.trim().replace(/\s+/g, " ").replace(/^./, (ch) => ch.toUpperCase()));
  }
  return [...new Set(out)];
}

// A role heading that addresses every department («Директоры департаментов:»).
const ALL_DEPARTMENTS_TEXT = /директор[ыаов]*\s+(всех\s+)?департаментов|все\s+департамент|руководител[иеья]+\s+(всех\s+)?(структурных\s+)?подразделений/;

/** True when the clause or one of its ancestors is a heading addressed to all departments. */
export function underAllDepartments(clause, byId) {
  let current = clause;
  while (current) {
    if (ALL_DEPARTMENTS_TEXT.test(normalize(current.text))) return true;
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return false;
}

/**
 * @param {{doc_id, side, filename, clauses}} doc
 * @param {object[]} units  units of the same side (from structure.js)
 * @returns {Promise<{functions: object[], stats: object}>}
 */
export async function extractFunctions(doc, units, llm, { prefix } = {}) {
  const sideUnits = units.filter((u) => u.side === doc.side);
  const block = sideUnits.find((u) => u.kind === "block")?.abbr || "БВА";
  const unitList = sideUnits.map((u) => `${u.abbr || u.name}${u.abbr ? ` — ${u.name}` : ""} (${u.kind})`).join("; ") || "не определены";
  const chunks = sectionsOf(doc.clauses).flatMap(([key, list]) => chunkSection(key, list));
  const byId = new Map(doc.clauses.map((c) => [c.clause_id, c]));
  const idPrefix = prefix ?? (doc.side === "before" ? "fb" : "fa");

  const answers = await mapLimit(chunks, 6, (chunk) =>
    llm.completeJson({
      name: `extract:${doc.doc_id}:${chunk.section}`,
      schema: ExtractResponse,
      prompt: prompt("extract", {
        label: `${sideLabel(doc.side)}, ${doc.filename}`,
        section: chunk.section,
        block,
        units: unitList,
        candidates: chunk.candidates.map((c) => c.clause_id).join(", "),
        clauses: chunk.context.map((c) => `[${c.clause_id}] ${c.text}`).join("\n"),
      }),
    }),
  );

  const functions = [];
  const seen = new Set();
  let unknown = 0;
  answers.forEach((answer, i) => {
    const allowed = new Set(chunks[i].candidates.map((c) => c.clause_id));
    for (const item of answer.functions) {
      const clause = byId.get(item.clause_id);
      if (!clause || !allowed.has(item.clause_id) || seen.has(item.clause_id)) {
        unknown++;
        continue;
      }
      seen.add(item.clause_id);
      functions.push({
        func_id: `${idPrefix}_${String(functions.length + 1).padStart(3, "0")}`,
        doc_id: doc.doc_id,
        side: doc.side,
        clause_id: clause.clause_id,
        ref: clause.ref,
        owners: expandOwners(underAllDepartments(clause, byId) ? [...item.owners, ALL] : item.owners, sideUnits),
        canonical: item.canonical,
        category: item.category,
        quote: quoteOf(clause.text),
        text: clause.text, // in memory for matching; not persisted (clauses already are)
      });
    }
  });
  return { functions, stats: { chunks: chunks.length, candidates: chunks.reduce((n, c) => n + c.candidates.length, 0), functions: functions.length, ignored_ids: unknown } };
}
