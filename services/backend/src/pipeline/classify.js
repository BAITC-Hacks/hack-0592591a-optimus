// Input guard for the clauses stage: a random PDF (assembly instructions, a
// contract, an article) extracts fine and would then be "compared", producing
// nonsense findings. One short model call per «до»/«после» document decides
// whether it describes an organisation's units and their functions; anything
// else fails the analysis with a clear 422 before the structure stage.
import { HttpError } from "../httpError.js";
import { prompt } from "../prompts.js";
import { ClassifyResponse } from "../schemas.js";

const SAMPLE_CHARS = 3500;
const HEAD_CLAUSES = 30;
const SPREAD_CLAUSES = 10;
// Documents whose clauses keep naming units are org documents whatever the model
// says: protects the main scenario from a false negative of the classifier.
const UNIT_RE = /департамент|управлени|отдел|подразделен|дирекци|служб|сектор|блок\b|блока|функци|полномоч/i;
const LEXICAL_OVERRIDE = 0.5;

/** A representative excerpt: title, preamble, the first clauses and a spread over the rest. */
export function documentSample(doc) {
  const parts = [];
  if (doc.title) parts.push(`Заголовок: ${doc.title}`);
  if (doc.preamble) parts.push(doc.preamble.slice(0, 600));
  const clauses = doc.clauses ?? [];
  const head = clauses.slice(0, HEAD_CLAUSES);
  const rest = clauses.slice(HEAD_CLAUSES);
  const step = Math.max(1, Math.floor(rest.length / SPREAD_CLAUSES));
  const spread = rest.filter((_, i) => i % step === 0).slice(0, SPREAD_CLAUSES);
  for (const clause of [...head, ...spread]) parts.push(`[${clause.clause_id}] ${clause.text.slice(0, 220)}`);
  return parts.join("\n").slice(0, SAMPLE_CHARS);
}

export function lexicalShare(doc) {
  const clauses = doc.clauses ?? [];
  if (!clauses.length) return 0;
  return clauses.filter((c) => UNIT_RE.test(c.text)).length / clauses.length;
}

/** @returns {{relevant: boolean, kind: string, summary: string, reason: string, checked: boolean}} */
export async function classifyDocument(doc, llm) {
  let verdict;
  try {
    verdict = await llm.completeJson({ name: "classify", prompt: prompt("classify", { sample: documentSample(doc) }), schema: ClassifyResponse, maxTokens: 400 });
  } catch (err) {
    // The guard never blocks an analysis on its own failure: the later stages
    // still refuse documents without units or functions.
    console.warn(`[pipeline] classify ${doc.doc_id} skipped: ${err.message}`);
    return { relevant: true, kind: "other", summary: "", reason: "", checked: false };
  }
  const share = lexicalShare(doc);
  if (!verdict.relevant && share >= LEXICAL_OVERRIDE) {
    return { ...verdict, relevant: true, checked: true, reason: `${verdict.reason} Оставлен: ${Math.round(share * 100)}% пунктов называют подразделения или функции.`.trim() };
  }
  return { ...verdict, checked: true };
}

const SIDE_RU = { before: "«до»", after: "«после»" };

/**
 * Classifies every «до»/«после» document in parallel, records the verdict on it
 * and throws 422 irrelevant_document naming each document that does not belong.
 */
export async function assertRelevantDocuments(documents, llm) {
  const docs = documents.filter((d) => d.side === "before" || d.side === "after");
  const verdicts = await Promise.all(docs.map((doc) => classifyDocument(doc, llm)));
  docs.forEach((doc, i) => (doc.classification = verdicts[i]));
  const rejected = docs.filter((doc) => !doc.classification.relevant);
  if (!rejected.length) return verdicts;
  const list = rejected
    .map((doc) => {
      const trim = (text) => String(text ?? "").trim().replace(/[.\s]+$/, "");
      const what = [trim(doc.classification.summary), trim(doc.classification.reason)].filter(Boolean).join(". ");
      return `«${doc.filename}» (${SIDE_RU[doc.side]})${what ? `: ${what}` : ""}`;
    })
    .join("; ");
  const err = new HttpError(
    422,
    "irrelevant_document",
    `${rejected.length === 1 ? "Документ не похож" : "Документы не похожи"} на положение об организационной структуре или функциях подразделений: ${list}. Загрузите положения, регламенты или приказы, описывающие подразделения и их функции, «до» и «после» реорганизации.`,
  );
  err.filename = rejected.map((doc) => doc.filename).join(", ");
  throw err;
}
