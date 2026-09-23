// O1 (docs/TASK.md §12a): «после» functions vs legislation.
//   1 candidates  code: up to 3 norms per function, cosine over embeddings when
//                 configured (norm vectors cached in Mongo), else token Jaccard
//   2 judge       LLM (prompts/regulatory.md): basis | contradicts | none
//   3 quote       code: the norm line closest to the function, verbatim
//   4 verify      both quotes must be substrings of their texts, else dropped
// Norms are the shipped adilet.zan.kz slice (AGENTS.md §7a) plus the clauses of
// uploaded «regulations», which win ties. Runs inside the compare stage and never
// fails the analysis: checkRegulatorySafe returns [] with a status instead.
import { createHash } from "node:crypto";

import { prompt } from "../prompts.js";
import { ADILET_URL, findRegulatoryNorms, saveNormEmbeddings } from "../regulatoryNorms.js";
import { RegulatoryResponse } from "../schemas.js";
import { DISCLAIMER } from "./report.js";
import { cosine, jaccard, normalize, quoteOf, tokens } from "./util.js";

const TOP_K = 3;
const JACCARD_FLOOR = 0.05;
const COSINE_FLOOR = 0.35;
const UPLOADED_BONUS = 0.05;
const BATCH = 20;
const NORM_CHARS = 700;
const EMBED_CHARS = 2000;
const MIN_CONFIDENCE = 0.6;

const LABELS = {
  REGULATORY_BASIS: "Нормативное основание",
  POTENTIAL_REGULATORY_CONFLICT: "Возможное расхождение с нормой",
};

const functionText = (fn) => `${fn.canonical}. ${fn.text ?? fn.quote}`;
const normText = (norm) => `${norm.article_title ?? ""} ${norm.text}`;
const hash = (text) => createHash("sha1").update(text).digest("hex").slice(0, 16);
export const ruDate = (iso) => (iso ? iso.split("-").reverse().join(".") : null);

/** The judge sees norms under short ids (n1, n2 …); they mean nothing to a reader. */
export function cleanReason(text) {
  const out = String(text ?? "")
    .replace(/\s*\(?\b[nN]\d{1,3}\b\)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out ? out[0].toUpperCase() + out.slice(1) : out;
}

/** Clauses of uploaded regulation documents, in the norm shape. */
export function uploadedNorms(docs) {
  return docs
    .filter((doc) => doc.side === "regulation")
    .flatMap((doc) => {
      const title = doc.title || doc.filename || doc.doc_id;
      return doc.clauses.map((c) => ({
        norm_id: `${doc.doc_id}:${c.clause_id}`,
        origin: "uploaded",
        doc_id: doc.doc_id,
        doc_title: title,
        article_title: null,
        clause: `п. ${c.clause_id}`,
        text: c.text,
        breadcrumb: `${title} | ${c.ref}`,
        redaction_date: null,
        source_url: null,
        ref: c.ref,
      }));
    });
}

/** Up to TOP_K candidate norms per function: [{j, score}] indexes into `norms`. */
export function pickCandidates(fns, norms, vectors = null) {
  const normTokens = norms.map((n) => tokens(normText(n)));
  const floor = vectors ? COSINE_FLOOR : JACCARD_FLOOR;
  return fns.map((fn, i) => {
    const mine = tokens(functionText(fn));
    const scored = [];
    norms.forEach((norm, j) => {
      const base = vectors ? cosine(vectors.fns[i], vectors.norms[j]) : jaccard(mine, normTokens[j]);
      if (base >= floor) scored.push({ j, score: base + (norm.origin === "uploaded" ? UPLOADED_BONUS : 0) });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, TOP_K);
  });
}

/** The line of the norm closest to the function; always a substring of norm.text. */
export function normQuote(norm, fn) {
  const mine = tokens(functionText(fn));
  const lines = norm.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 20 && !/^Сноска/i.test(line));
  let best = lines[0] ?? norm.text.trim();
  let bestScore = -1;
  for (const line of lines) {
    const score = jaccard(mine, tokens(line));
    if (score > bestScore) [best, bestScore] = [line, score];
  }
  return quoteOf(best);
}

/** Vectors for functions and norms, or null (lexical candidates). New norm vectors are cached. */
async function embedAll(fns, norms, llm, saveEmbeddings) {
  const fnVectors = await llm.embed(fns.map((fn) => functionText(fn).slice(0, EMBED_CHARS)));
  if (!fnVectors) return null;
  const model = process.env.EMBEDDING_MODEL || "embedding";
  const keyOf = (norm) => `${model}:${hash(norm.text)}`;
  const missing = norms.filter((norm) => !(norm.embedding && norm.embedding_key === keyOf(norm)));
  if (missing.length) {
    const vectors = await llm.embed(missing.map((norm) => normText(norm).slice(0, EMBED_CHARS)));
    if (!vectors) return null;
    missing.forEach((norm, i) => Object.assign(norm, { embedding: vectors[i], embedding_key: keyOf(norm) }));
    const cached = missing.filter((n) => n.origin === "corpus").map(({ norm_id, embedding, embedding_key }) => ({ norm_id, embedding, embedding_key }));
    await saveEmbeddings(cached).catch((err) => console.warn(`[regulatory] embedding cache not saved: ${err.message}`));
  }
  return { fns: fnVectors, norms: norms.map((norm) => norm.embedding) };
}

/** One LLM call per BATCH functions; norms are sent once per batch under short ids. */
async function judge(items, llm) {
  const verdicts = new Map();
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  await Promise.all(
    batches.map(async (batch, b) => {
      const shortIds = new Map();
      const norms = [];
      for (const item of batch) {
        for (const { norm } of item.candidates) {
          if (shortIds.has(norm.norm_id)) continue;
          shortIds.set(norm.norm_id, `n${shortIds.size + 1}`);
          norms.push({ id: shortIds.get(norm.norm_id), act: norm.doc_title, clause: norm.clause, text: norm.text.slice(0, NORM_CHARS) });
        }
      }
      const functions = batch.map(({ fn, candidates }) => ({
        id: fn.func_id,
        owners: fn.owners,
        canonical: fn.canonical,
        text: fn.quote,
        candidates: candidates.map(({ norm }) => shortIds.get(norm.norm_id)),
      }));
      const answer = await llm.completeJson({
        name: `regulatory:${b + 1}`,
        prompt: prompt("regulatory", { items: JSON.stringify({ norms, functions }, null, 1) }),
        schema: RegulatoryResponse,
      });
      const longIds = new Map([...shortIds].map(([normId, short]) => [short, normId]));
      for (const r of answer.results) verdicts.set(r.id, { ...r, norm_id: r.norm_id ? (longIds.get(r.norm_id) ?? null) : null, unknown: Boolean(r.norm_id && !longIds.has(r.norm_id)) });
    }),
  );
  return verdicts;
}

function verified(finding, norm, clauseIndex) {
  const cite = finding.citations[0];
  const clause = clauseIndex.get(`${cite.doc_id}:${cite.clause_id}`);
  const orgQuote = normalize(cite.quote);
  const normQ = normalize(finding.norm.quote);
  const linkOk = norm.origin === "uploaded" ? norm.source_url === null : ADILET_URL.test(norm.source_url ?? "");
  return Boolean(clause) && orgQuote.length > 0 && normalize(clause.text).includes(orgQuote) && normQ.length > 0 && normalize(norm.text).includes(normQ) && linkOk;
}

/**
 * @param {{after: object[], docs: object[], llm: object, norms: object[], saveEmbeddings?: Function}} input
 *   after: «после» functions with text; docs: all analysis documents (incl. side "regulation");
 *   norms: corpus norms from Mongo.
 */
export async function checkRegulatory({ after, docs, llm, norms: corpus, saveEmbeddings = async () => {} }) {
  const norms = [...uploadedNorms(docs), ...corpus];
  const stats = {
    regulatory_status: "ok",
    regulatory_norms: corpus.length,
    regulatory_uploaded_norms: norms.length - corpus.length,
    regulatory_mode: "lexical",
    regulatory_judged: 0,
    regulatory_basis: 0,
    regulatory_conflicts: 0,
    regulatory_rejected: 0,
    regulatory_dropped_unverified: 0,
  };
  if (!norms.length) return { findings: [], stats: { ...stats, regulatory_status: "no_norms" } };
  if (!after.length) return { findings: [], stats: { ...stats, regulatory_status: "no_functions" } };

  const vectors = await embedAll(after, norms, llm, saveEmbeddings);
  if (vectors) stats.regulatory_mode = "embeddings";
  const picks = pickCandidates(after, norms, vectors);
  const items = after
    .map((fn, i) => ({ fn, candidates: picks[i].map(({ j, score }) => ({ norm: norms[j], score })) }))
    .filter((item) => item.candidates.length);
  stats.regulatory_judged = items.length;
  const verdicts = items.length ? await judge(items, llm) : new Map();

  const clauseIndex = new Map(docs.flatMap((d) => d.clauses.map((c) => [`${d.doc_id}:${c.clause_id}`, c])));
  const findings = [];
  for (const { fn, candidates } of items) {
    const verdict = verdicts.get(fn.func_id);
    if (!verdict || verdict.relation === "none") continue;
    const candidate = candidates.find((c) => c.norm.norm_id === verdict.norm_id);
    if (verdict.unknown || !candidate || verdict.confidence < MIN_CONFIDENCE) {
      stats.regulatory_rejected++;
      continue;
    }
    const { norm } = candidate;
    const type = verdict.relation === "contradicts" ? "POTENTIAL_REGULATORY_CONFLICT" : "REGULATORY_BASIS";
    const act = `${norm.clause} «${norm.doc_title}»`;
    const finding = {
      finding_id: "",
      type,
      severity: type === "REGULATORY_BASIS" ? "info" : "high",
      label: LABELS[type],
      units: fn.owners,
      title: type === "REGULATORY_BASIS" ? `${fn.canonical}: основание — ${act}` : `${fn.canonical}: возможно расходится с ${act}`,
      explanation: cleanReason(verdict.reason) || "Связь с нормой требует проверки.",
      confidence: verdict.confidence,
      citations: [{ doc_id: fn.doc_id, side: "after", clause_id: fn.clause_id, ref: fn.ref, quote: fn.quote || quoteOf(fn.text) }],
      norm: {
        norm_id: norm.norm_id,
        origin: norm.origin,
        doc_id: norm.doc_id,
        doc_title: norm.doc_title,
        clause: norm.clause,
        breadcrumb: norm.breadcrumb,
        redaction_date: norm.redaction_date ?? null,
        source_url: norm.source_url ?? null,
        ref: norm.ref ?? null,
        quote: normQuote(norm, fn),
      },
    };
    if (!verified(finding, norm, clauseIndex)) {
      stats.regulatory_dropped_unverified++;
      continue;
    }
    findings.push(finding);
  }
  const rank = (f) => (f.type === "POTENTIAL_REGULATORY_CONFLICT" ? 0 : 1);
  findings.sort((a, b) => rank(a) - rank(b) || b.confidence - a.confidence);
  findings.forEach((f, i) => (f.finding_id = `r_${String(i + 1).padStart(3, "0")}`));
  stats.regulatory_basis = findings.filter((f) => f.type === "REGULATORY_BASIS").length;
  stats.regulatory_conflicts = findings.filter((f) => f.type === "POTENTIAL_REGULATORY_CONFLICT").length;
  return { findings, stats };
}

/** The pipeline entry: loads the corpus from Mongo and never throws. */
export async function checkRegulatorySafe({ after, docs, llm, loadNorms = findRegulatoryNorms, saveEmbeddings = saveNormEmbeddings }) {
  try {
    return await checkRegulatory({ after, docs, llm, norms: await loadNorms(), saveEmbeddings });
  } catch (err) {
    console.warn(`[regulatory] skipped: ${err.code ?? "error"}: ${err.message}`);
    return { findings: [], stats: { regulatory_status: "failed", regulatory_error: err.code ?? "regulatory_failed" } };
  }
}

/** Code-built conclusion section for O1, placed above the disclaimer. Refs are the ones report.js uses. */
export function withRegulatorySection(conclusionMd, { findings, stats }) {
  if (stats.regulatory_status !== "ok") return conclusionMd;
  const conflicts = findings.filter((f) => f.type === "POTENTIAL_REGULATORY_CONFLICT");
  const lines = [
    "## Сверка с законодательством",
    "",
    `Функций «после» с нормами-кандидатами: ${stats.regulatory_judged}. Возможных расхождений с нормами: ${conflicts.length}; функций с нормативным основанием: ${stats.regulatory_basis}. Нормы и ссылки на adilet.zan.kz — на вкладке «Нормативные требования». Норма — нормативное основание для проверки, а не юридический вывод.`,
  ];
  for (const f of conflicts.slice(0, 5)) {
    const edition = f.norm.redaction_date ? `, ред. от ${ruDate(f.norm.redaction_date)}` : "";
    lines.push("", `- ${f.citations[0] ? `[после · ${f.citations[0].doc_id} · п. ${f.citations[0].clause_id}] ` : ""}${f.title}${edition}.`);
  }
  const section = lines.join("\n");
  const tail = `\n\n---\n\n_${DISCLAIMER}_`;
  const at = conclusionMd.lastIndexOf(tail);
  return at === -1 ? `${conclusionMd.trim()}\n\n${section}\n` : `${conclusionMd.slice(0, at).trim()}\n\n${section}${conclusionMd.slice(at)}`;
}
