// Small deterministic helpers shared by the pipeline modules. Unit-tested via
// compare.test.js; no LLM, no I/O.
import { randomBytes } from "node:crypto";

const STOPWORDS = new Set([
  "и", "в", "во", "на", "по", "с", "со", "для", "о", "об", "от", "к", "ко", "у", "не", "что", "как", "а", "из",
  "за", "при", "до", "или", "также", "том", "числе", "его", "их", "ее", "же", "то", "the", "of", "and",
  "настоящего", "настоящим", "данным", "соответствии", "соответствующих", "рамках", "части", "путем", "всех",
]);

/** Lowercase, ё→е, punctuation out, spaces collapsed. Used for every substring check. */
export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A crude stemmer that is good enough for Jaccard on Russian legal prose:
// "готовит"/"готовят"/"готовить" → "готов", "предложения"/"предложений" → "предл".
const stem = (word) => (word.length > 5 ? word.slice(0, 5) : word);

/** Set of stemmed content tokens. */
export function tokens(text) {
  const out = new Set();
  for (const word of normalize(text).split(" ")) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    out.add(stem(word));
  }
  return out;
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Promise.all with at most `limit` tasks running. Keeps order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Verbatim prefix of a clause, cut at a word boundary. Always a substring of `text`. */
export function quoteOf(text, max = 300) {
  const clean = String(text ?? "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max);
  return clean.slice(0, cut > 40 ? cut : max).trim();
}

export const newId = (prefix) => `${prefix}${randomBytes(6).toString("hex")}`;

/** "5.3.2.а#2" → "5"; "Структура!3" → "Структура". */
export const topLevel = (clauseId) => String(clauseId).split("#")[0].split(/[.!]/)[0];

export const depth = (clauseId) => String(clauseId).split("#")[0].split(".").length;

/** True when `ancestor` is a prefix clause of `clauseId` ("5.3.2" of "5.3.2.а"). */
export const isAncestor = (ancestor, clauseId) => clauseId !== ancestor && clauseId.startsWith(`${ancestor}.`);

/** Stable key for a unit: its abbreviation, else its normalized name. */
export const unitKey = (unit) => (unit.abbr ? normalize(unit.abbr).toUpperCase() : normalize(unit.name));

export const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
export const isSubset = (a, b) => a.every((x) => b.includes(x));
export const disjoint = (a, b) => !a.some((x) => b.includes(x));

export const uniq = (items) => [...new Set(items)];
