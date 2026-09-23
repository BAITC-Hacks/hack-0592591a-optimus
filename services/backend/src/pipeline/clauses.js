// Stage 1 of the pipeline (docs/TASK.md §4): extractor fragments -> clauses.
//
// The extractor cuts the file into located fragments; this module groups them
// into clauses the rest of the pipeline cites: "5.3.2", sub-item "5.3.2.а".
// Pure code, no LLM. Clean-ups measured on the demo PDFs (docs/TASK.md §3):
//   - glued ids inside a fragment ("…Общества. 3.10.Работники могут") are split,
//     but only when the id continues the numbering, so "см. п. 3. Настоящего" is not;
//   - page-number fragments ("6") are dropped;
//   - everything from «Оглавление» / «Содержание» after the body is dropped;
//   - sub-items (clause null, marker "а") become child clauses "<parent>.<marker>".
import { z } from "zod";

import { extractDocument } from "../extractorClient.js";

// Same pattern as docs/TASK.md §4; the lookbehind keeps "1.10" from matching as "0.".
const GLUED_ID = /(?<![\d.])(\d{1,2}(?:\.\d{1,2}){0,3})\.\s*(?=[А-ЯЁ«])/g;
const PAGE_NUMBER = /^\d{1,3}$/;
const TOC = /^(оглавление|содержание)(?![а-яё])/i; // not \b: in JS it only sees ASCII letters

// What stage 1 writes to Mongo `analyses.documents[]` (docs/TASK.md §6). Validated before every write.
export const SIDES = ["before", "after", "regulation"];

export const ClauseSchema = z.object({
  doc_id: z.string().min(1),
  side: z.enum(SIDES),
  clause_id: z.string().min(1).max(200),
  parent_id: z.string().nullable(),
  text: z.string(),
  fragment_ids: z.array(z.string()).min(1),
  ref: z.string().min(1),
});

export const AnalysisDocumentSchema = z.object({
  doc_id: z.string().min(1),
  side: z.enum(SIDES),
  filename: z.string().min(1),
  format: z.enum(["docx", "pdf", "xlsx", "xls"]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().nullable(),
  preamble: z.string(),
  warnings: z.array(z.string()),
  stats: z.record(z.string(), z.number().int().nonnegative()),
  clauses: z.array(ClauseSchema),
});

const numericParts = (id) => id.split(".").map(Number);

/** True when `next` can follow `prev`: first child, or next sibling of prev or of one of its ancestors. */
export function continuesNumbering(prev, next) {
  if (!/^\d+(\.\d+)*$/.test(next)) return false;
  const n = numericParts(next);
  if (!prev) return n.length === 1 && n[0] === 1;
  const p = numericParts(prev);
  if (n.length === p.length + 1 && p.every((v, i) => v === n[i]) && n[n.length - 1] === 1) return true;
  for (let k = 1; k <= p.length; k++) {
    if (n.length === k && p.slice(0, k - 1).every((v, i) => v === n[i]) && n[k - 1] === p[k - 1] + 1) return true;
  }
  return false;
}

const parentOf = (id) => (id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null);

// The location part of an extractor ref: "п. 3.9, стр. 6, строки 22–28" -> "стр. 6, строки 22–28".
const whereOf = (fragment) => (fragment.clause ? fragment.ref.slice(fragment.ref.indexOf(", ") + 2) : fragment.ref);

const stripLabel = (text, label) => text.replace(new RegExp(`^\\s*${label.replace(/\./g, "\\.")}[.)]?\\s*`), "");

/**
 * @param {{fragments: object[]}} extraction  the extractor response
 * @param {{docId: string, side: "before"|"after"|"regulation"}} meta
 * @returns {{clauses: object[], preamble: string, stats: object}}
 */
export function buildClauses(extraction, { docId, side }) {
  const clauses = [];
  const seen = new Map(); // clause_id -> count, to keep ids unique
  const stats = { fragments: extraction.fragments.length, page_numbers_dropped: 0, tail_dropped: 0, glued_split: 0, duplicate_ids: 0 };
  const preamble = [];
  let open = null; // clause receiving continuation text
  let lastNumeric = null; // last numeric clause id, parent of sub-items and base for the sequence check

  const openClause = (clauseId, text, fragment, where) => {
    let id = clauseId;
    const count = (seen.get(clauseId) || 0) + 1;
    seen.set(clauseId, count);
    if (count > 1) {
      id = `${clauseId}#${count}`;
      stats.duplicate_ids++;
    }
    open = {
      doc_id: docId,
      side,
      clause_id: id,
      parent_id: parentOf(clauseId),
      text,
      fragment_ids: [fragment.id],
      ref: `п. ${clauseId}, ${where}`,
    };
    clauses.push(open);
  };

  const append = (text, fragment) => {
    if (!text) return;
    if (!open) {
      preamble.push(text);
      return;
    }
    open.text = open.text ? `${open.text} ${text}` : text;
    if (open.fragment_ids.at(-1) !== fragment.id) open.fragment_ids.push(fragment.id);
  };

  // Splits one fragment's text on glued ids that continue the numbering.
  const consume = (text, fragment) => {
    const where = whereOf(fragment);
    let cursor = 0;
    for (const match of text.matchAll(GLUED_ID)) {
      const id = match[1];
      if (!continuesNumbering(lastNumeric, id)) continue;
      append(text.slice(cursor, match.index).trim(), fragment);
      cursor = match.index + match[0].length;
      // Opened empty; the text up to the next accepted id (or the end) is appended to it.
      openClause(id, "", fragment, where);
      lastNumeric = id;
      stats.glued_split++;
    }
    append(text.slice(cursor).trim(), fragment);
  };

  for (const [index, fragment] of extraction.fragments.entries()) {
    const text = fragment.text.trim();
    if (PAGE_NUMBER.test(text)) {
      stats.page_numbers_dropped++;
      continue;
    }
    if (TOC.test(text) && lastNumeric) {
      stats.tail_dropped = extraction.fragments.length - index;
      break;
    }
    if (fragment.kind === "sheet_row" && !fragment.clause) {
      // Excel: each row is its own record, cited by sheet and row.
      const { sheet, row } = fragment.location;
      openClause(`${sheet}!${row}`, text, fragment, whereOf(fragment));
      open.ref = fragment.ref;
      open = null;
      continue;
    }
    if (fragment.clause && /^\d+(\.\d+)*$/.test(fragment.clause)) {
      openClause(fragment.clause, "", fragment, whereOf(fragment));
      lastNumeric = fragment.clause;
      consume(stripLabel(text, fragment.clause), fragment);
    } else if (fragment.clause) {
      // Named clause ("Глава 2", "Статья 5"): cite as is, no numbering.
      openClause(fragment.clause, text, fragment, whereOf(fragment));
      open.ref = fragment.ref;
    } else if (fragment.marker && lastNumeric) {
      openClause(`${lastNumeric}.${fragment.marker}`, "", fragment, whereOf(fragment));
      consume(stripLabel(text, fragment.marker), fragment);
    } else if (fragment.kind === "heading" && !lastNumeric) {
      preamble.push(text);
    } else {
      consume(text, fragment);
    }
  }

  return { clauses, preamble: preamble.join("\n"), stats: { ...stats, clauses: clauses.length } };
}

/** Extract one uploaded file and group it into clauses. */
export async function extractClauses(file, meta) {
  const extraction = await extractDocument(file);
  return { document: extraction.document, warnings: extraction.warnings, ...buildClauses(extraction, meta) };
}
