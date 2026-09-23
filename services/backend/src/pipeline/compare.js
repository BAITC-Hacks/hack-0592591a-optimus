// Stage 4 (docs/TASK.md §5): match «до» functions to «после», detect findings,
// verify every quote. Matching steps 1–3 and every finding rule are code; the
// LLM only judges candidate pairs (judge.md) and reviews conflict candidates
// (conflict.md). Unit-tested with a stubbed llm in test/compare.test.js.
import { prompt } from "../prompts.js";
import { ConflictResponse, DupJudgeResponse, JudgeResponse } from "../schemas.js";
import { cosine, disjoint, isAncestor, isSubset, jaccard, mapLimit, normalize, quoteOf, sameSet, tokens } from "./util.js";

export const JACCARD_SAME = 0.6;
export const JACCARD_CANDIDATE = 0.15;
export const JACCARD_DUP = 0.7;
export const COSINE_DUP = 0.9;
const TOP_K = 3;
// The judge's answer is accepted only with enough confidence; weak «partial» answers count as not found.
export const JUDGE_MIN = { same: 0.6, partial: 0.7 };
// «После» pairs with lexical similarity in this band are shown to the LLM before they can be a duplicate.
export const JACCARD_DUP_REVIEW = 0.4;
const DUP_JUDGE_BATCH = 25;
const DUP_JUDGE_MAX_PAIRS = 100;
const JUDGE_BATCH = 20;
const CONFLICT_PAIRS_PER_OWNER = 3;
const NOTE_LIMIT = 5;

export const REVIEW_NOTE = "Требует проверки ответственным сотрудником.";

export const FINDING_LABELS = {
  POTENTIAL_LOSS: "Возможная потеря функции",
  MOVED: "Функция перераспределена",
  OVERLAP: "Пересечение общей и частной нормы",
  POTENTIAL_DUPLICATION: "Возможное дублирование",
  POTENTIAL_CONFLICT: "Возможный конфликт независимости / ответственности",
  NOTE: "Примечание",
};

const ORDER = { POTENTIAL_LOSS: 0, POTENTIAL_CONFLICT: 1, POTENTIAL_DUPLICATION: 2, MOVED: 3, OVERLAP: 4, NOTE: 5 };
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 };

const textOf = (fn) => fn.text ?? fn.quote;
const matchText = (fn) => `${fn.canonical} ${textOf(fn)}`;

function citation(fn) {
  return { doc_id: fn.doc_id, side: fn.side, clause_id: fn.clause_id, ref: fn.ref, quote: fn.quote || quoteOf(textOf(fn)) };
}

// ---------------------------------------------------------------- matching

/**
 * Steps 1–5 of §5 for every «до» function.
 * @returns {Promise<{matches: object[], stats: object, vectors: {before: Array|null, after: Array|null}}>}
 */
export async function matchFunctions({ before, after, llm }) {
  const stats = { exact: 0, jaccard: 0, judge_same: 0, judge_partial: 0, unmatched: 0, judge_batches: 0, embeddings: "unavailable" };
  const afterTokens = after.map((fn) => tokens(matchText(fn)));
  const afterNorm = after.map((fn) => normalize(textOf(fn)));
  const afterCanon = after.map((fn) => normalize(fn.canonical));
  const matches = new Array(before.length);
  const pending = [];

  before.forEach((fn, i) => {
    const norm = normalize(textOf(fn));
    const canon = normalize(fn.canonical);
    const exactAt = after.findIndex((_, j) => afterNorm[j] === norm || (canon && afterCanon[j] === canon));
    if (exactAt >= 0) {
      matches[i] = { before_id: fn.func_id, after_id: after[exactAt].func_id, relation: "same", confidence: 1, steps: ["exact"], score: 1 };
      stats.exact++;
      return;
    }
    const mine = tokens(matchText(fn));
    let best = -1;
    let bestScore = 0;
    afterTokens.forEach((theirs, j) => {
      const score = jaccard(mine, theirs);
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    if (bestScore >= JACCARD_SAME) {
      matches[i] = { before_id: fn.func_id, after_id: after[best].func_id, relation: "same", confidence: 0.8, steps: ["exact", "jaccard"], score: bestScore };
      stats.jaccard++;
      return;
    }
    pending.push({ index: i, mine });
  });

  // Step 3: candidates by embeddings, falling back to lexical similarity.
  let vectors = { before: null, after: null };
  if (pending.length && after.length) {
    const all = await llm.embed([...before.map(matchText), ...after.map(matchText)]);
    if (all) {
      vectors = { before: all.slice(0, before.length), after: all.slice(before.length) };
      stats.embeddings = "ok";
    }
  }
  const candidatesFor = ({ index, mine }) => {
    const scored = after.map((fn, j) => ({
      j,
      score: vectors.after ? cosine(vectors.before[index], vectors.after[j]) : jaccard(mine, afterTokens[j]),
    }));
    const floor = vectors.after ? 0.3 : JACCARD_CANDIDATE;
    return scored
      .filter((s) => s.score >= floor)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);
  };
  const judgeItems = [];
  for (const item of pending) {
    const candidates = candidatesFor(item);
    if (!candidates.length) {
      matches[item.index] = { before_id: before[item.index].func_id, after_id: null, relation: "unmatched", confidence: 0.9, steps: ["exact", "jaccard", vectors.after ? "embeddings" : "lexical"], score: 0 };
      stats.unmatched++;
      continue;
    }
    judgeItems.push({ ...item, candidates });
  }

  // Step 4: the LLM judge, in batches.
  const batches = [];
  for (let i = 0; i < judgeItems.length; i += JUDGE_BATCH) batches.push(judgeItems.slice(i, i + JUDGE_BATCH));
  stats.judge_batches = batches.length;
  const stepList = ["exact", "jaccard", vectors.after ? "embeddings" : "lexical", "judge"];
  await mapLimit(batches, 6, async (batch, b) => {
    const payload = batch.map((item) => ({
      id: before[item.index].func_id,
      owners: before[item.index].owners,
      text: textOf(before[item.index]),
      candidates: item.candidates.map((c) => ({ id: after[c.j].func_id, owners: after[c.j].owners, text: textOf(after[c.j]) })),
    }));
    let results = new Map();
    try {
      const response = await llm.completeJson({
        name: `judge:${b + 1}/${batches.length}`,
        schema: JudgeResponse,
        prompt: prompt("judge", { items: JSON.stringify(payload, null, 1) }),
      });
      results = new Map(response.results.map((r) => [r.id, r]));
    } catch (err) {
      console.warn(`[compare] judge batch ${b + 1} failed (${err.message}); its functions count as unmatched`);
    }
    for (const item of batch) {
      const fn = before[item.index];
      const verdict = results.get(fn.func_id);
      const allowed = new Set(item.candidates.map((c) => after[c.j].func_id));
      const accepted = verdict && verdict.relation !== "none" && verdict.candidate_id && allowed.has(verdict.candidate_id) && verdict.confidence >= JUDGE_MIN[verdict.relation];
      if (accepted) {
        const chosen = item.candidates.find((c) => after[c.j].func_id === verdict.candidate_id);
        matches[item.index] = { before_id: fn.func_id, after_id: verdict.candidate_id, relation: verdict.relation, confidence: verdict.confidence, steps: stepList, score: chosen.score };
        stats[verdict.relation === "same" ? "judge_same" : "judge_partial"]++;
      } else {
        matches[item.index] = { before_id: fn.func_id, after_id: null, relation: "unmatched", confidence: verdict ? verdict.confidence : 0.5, steps: stepList, score: item.candidates[0].score };
        stats.unmatched++;
      }
    }
  });

  // Owner change on an accepted pair → moved.
  const afterById = new Map(after.map((fn) => [fn.func_id, fn]));
  before.forEach((fn, i) => {
    const m = matches[i];
    if (m.after_id && !sameSet(fn.owners.map(normalize), afterById.get(m.after_id).owners.map(normalize))) {
      m.basis = m.relation;
      m.relation = "moved";
    }
  });
  return { matches, stats, vectors };
}

// ---------------------------------------------------------------- findings

function makeFinding(list, data) {
  list.push({ finding_id: `f_${String(list.length + 1).padStart(3, "0")}`, review: null, ...data, label: FINDING_LABELS[data.type] });
}

const ownersText = (owners) => (owners.length ? owners.join(", ") : "исполнитель не указан");
const STEP_RU = { exact: "точное совпадение", jaccard: "лексическое сходство", embeddings: "семантические кандидаты", lexical: "лексические кандидаты", judge: "оценка модели" };
const stepsText = (steps) => steps.map((s) => STEP_RU[s] ?? s).join(" → ");

/** Deterministic rules of §5 on top of the matches. Conflict candidates go through the LLM. */
export async function detectFindings({ before, after, matches, units, vectors, llm, beforeClauses = [], afterClauses = [] }) {
  const findings = [];
  const stats = { conflict_candidates: 0, conflict_candidates_rejected: 0, conflict_unreviewed: 0 };
  const afterById = new Map(after.map((fn) => [fn.func_id, fn]));
  const beforeById = new Map(before.map((fn) => [fn.func_id, fn]));

  for (const m of matches) {
    const fn = beforeById.get(m.before_id);
    if (m.relation === "unmatched") {
      makeFinding(findings, {
        type: "POTENTIAL_LOSS",
        severity: "high",
        units: fn.owners,
        title: `Возможная потеря функции: ${fn.canonical}`,
        explanation: `Закреплено в документах «до» (${fn.ref}) за ${ownersText(fn.owners)}. В документах «после» эквивалентной обязанности не найдено (проверено: ${stepsText(m.steps)}). ${REVIEW_NOTE}`,
        citations: [citation(fn)],
      });
    } else if (m.relation === "moved") {
      const target = afterById.get(m.after_id);
      makeFinding(findings, {
        type: "MOVED",
        severity: "low",
        units: [...new Set([...fn.owners, ...target.owners])],
        title: `Функция перераспределена: ${fn.canonical}`,
        explanation: `«До» — ${ownersText(fn.owners)} (${fn.ref}); «после» — ${ownersText(target.owners)} (${target.ref}). Сопоставление: ${m.basis === "partial" ? "частичное" : "то же содержание"} (${STEP_RU[m.steps.at(-1)] ?? m.steps.at(-1)}). ${REVIEW_NOTE}`,
        citations: [citation(fn), citation(target)],
      });
    }
  }

  // Duplication and overlap among «после» functions. Pairs in the review band are confirmed by the LLM first.
  const afterUnits = units.filter((u) => u.side === "after");
  const genericOwners = new Set(afterUnits.filter((u) => u.kind === "block" || u.kind === "position").map((u) => u.abbr || u.name));
  const afterTokens = after.map((fn) => tokens(matchText(fn)));
  const afterCanon = after.map((fn) => normalize(fn.canonical));
  const pairs = [];
  for (let i = 0; i < after.length; i++) {
    for (let j = i + 1; j < after.length; j++) {
      const a = after[i];
      const b = after[j];
      if (a.clause_id === b.clause_id || isAncestor(a.clause_id, b.clause_id) || isAncestor(b.clause_id, a.clause_id)) continue;
      if (!a.owners.length && !b.owners.length) continue;
      const lexical = jaccard(afterTokens[i], afterTokens[j]);
      const semantic = vectors?.after ? cosine(vectors.after[i], vectors.after[j]) : 0;
      if (afterCanon[i] === afterCanon[j] || lexical >= JACCARD_DUP || semantic >= COSINE_DUP) pairs.push({ a, b, lexical, basis: "same" });
      else if (lexical >= JACCARD_DUP_REVIEW) pairs.push({ a, b, lexical, basis: null });
    }
  }
  const toReview = pairs.filter((p) => !p.basis).sort((x, y) => y.lexical - x.lexical).slice(0, DUP_JUDGE_MAX_PAIRS);
  stats.duplicate_pairs_reviewed = toReview.length;
  const reviewBatches = [];
  for (let i = 0; i < toReview.length; i += DUP_JUDGE_BATCH) reviewBatches.push(toReview.slice(i, i + DUP_JUDGE_BATCH));
  await mapLimit(reviewBatches, 4, async (batch, b) => {
    try {
      const response = await llm.completeJson({
        name: `dupjudge:${b + 1}/${reviewBatches.length}`,
        schema: DupJudgeResponse,
        prompt: prompt("dupjudge", {
          pairs: JSON.stringify(
            batch.map((p, k) => ({ pair_id: k + 1, a: { clause_id: p.a.clause_id, owners: p.a.owners, text: textOf(p.a) }, b: { clause_id: p.b.clause_id, owners: p.b.owners, text: textOf(p.b) } })),
            null,
            1,
          ),
        }),
      });
      for (const r of response.results) {
        const pair = batch[r.pair_id - 1];
        if (pair && r.relation !== "none" && r.confidence >= 0.6) pair.basis = r.relation;
      }
    } catch (err) {
      console.warn(`[compare] duplicate review batch ${b + 1} failed (${err.message}); those pairs are not reported`);
    }
  });
  for (const { a, b, lexical, basis } of pairs) {
    if (!basis) continue;
    // Generic owner (the block, a top position) or one owner set inside the other → overlap, not duplication.
    const generic = isSubset(a.owners, b.owners) || isSubset(b.owners, a.owners) || a.owners.some((o) => genericOwners.has(o)) || b.owners.some((o) => genericOwners.has(o));
    const peers = disjoint(a.owners, b.owners);
    const type = generic ? "OVERLAP" : "POTENTIAL_DUPLICATION";
    const weak = a.category === "other" || b.category === "other" || !peers;
    const severity = type === "OVERLAP" ? "low" : weak ? "low" : "medium";
    const wide = a.owners.length >= b.owners.length ? a : b;
    const narrow = wide === a ? b : a;
    makeFinding(findings, {
      type,
      severity,
      units: [...new Set([...a.owners, ...b.owners])],
      title: `${type === "OVERLAP" ? "Пересечение общей и частной нормы" : "Возможное дублирование"}: ${a.canonical}`,
      explanation:
        type === "OVERLAP"
          ? `Одна норма общая (${ownersText(wide.owners)}), другая — частная (${ownersText(narrow.owners)}): ${a.ref} и ${b.ref}. Это пересечение, а не дублирование между равными подразделениями. ${REVIEW_NOTE}`
          : `Одинаковая по содержанию функция закреплена за разными подразделениями: ${ownersText(a.owners)} (${a.ref}) и ${ownersText(b.owners)} (${b.ref}). Сходство текста ${Math.round(lexical * 100)} %${basis === "same" && lexical < JACCARD_DUP ? ", совпадение подтверждено моделью" : basis === "overlap" ? ", модель считает функции пересекающимися" : ""}. ${REVIEW_NOTE}`,
      citations: [citation(a), citation(b)],
    });
  }

  // Conflict candidates: one owner performs audits and controls audit quality.
  const unitByKey = new Map(afterUnits.map((u) => [u.abbr || u.name, u]));
  const parents = new Set(afterUnits.map((u) => normalize(u.parent ?? "")));
  const owners = [...new Set(after.flatMap((fn) => fn.owners))].filter((o) => {
    const unit = unitByKey.get(o);
    return unit && unit.kind !== "position" && unit.kind !== "block" && !parents.has(normalize(unit.abbr ?? "")) && !parents.has(normalize(unit.name));
  });
  const candidateSets = [];
  for (const owner of owners) {
    const perform = after.filter((fn) => fn.owners.includes(owner) && fn.category === "perform_audit");
    const control = after.filter((fn) => fn.owners.includes(owner) && fn.category === "quality_control");
    if (!perform.length || !control.length) continue;
    // The quality-control norm must be specific to the unit (or narrower than the performing norm): a
    // duty every department shares («оценивают результаты своих проверок») is not a structural conflict.
    const candidatePairs = [];
    for (const c of control.sort((x, y) => x.owners.length - y.owners.length)) {
      for (const p of perform.sort((x, y) => x.owners.length - y.owners.length)) {
        if (c.owners.length < p.owners.length || c.owners.length === 1) candidatePairs.push({ perform: p, control: c });
      }
    }
    if (!candidatePairs.length) continue;
    candidateSets.push({ owner, pairs: candidatePairs.slice(0, CONFLICT_PAIRS_PER_OWNER) });
  }
  stats.conflict_candidates = candidateSets.length;
  await mapLimit(candidateSets, 4, async ({ owner, pairs }) => {
    let reviews = null;
    try {
      const response = await llm.completeJson({
        name: `conflict:${owner}`,
        schema: ConflictResponse,
        prompt: prompt("conflict", {
          owner,
          pairs: JSON.stringify(
            pairs.map((p, k) => ({ pair_id: k + 1, perform: { clause_id: p.perform.clause_id, text: textOf(p.perform) }, control: { clause_id: p.control.clause_id, text: textOf(p.control) } })),
            null,
            1,
          ),
        }),
      });
      reviews = response.reviews;
    } catch (err) {
      console.warn(`[compare] conflict review for ${owner} failed (${err.message}); candidate kept unreviewed`);
    }
    const confirmed = reviews ? reviews.find((r) => r.verdict === "potential_conflict" && pairs[r.pair_id - 1]) : null;
    if (reviews && !confirmed) {
      stats.conflict_candidates_rejected++;
      return;
    }
    const pair = confirmed ? pairs[confirmed.pair_id - 1] : pairs[0];
    if (!reviews) stats.conflict_unreviewed++;
    makeFinding(findings, {
      type: "POTENTIAL_CONFLICT",
      severity: reviews ? "high" : "medium",
      units: [owner],
      title: `Возможный конфликт независимости: ${owner} проводит проверки и контролирует качество аудита`,
      explanation: `${owner} закреплён как исполнитель проверок (${pair.perform.ref}) и как контролёр качества аудита (${pair.control.ref}). ${
        reviews ? `Оценка модели: ${confirmed.reason}` : "Кандидат выявлен по правилу; проверка моделью не удалась, поэтому вывод оставлен со средней важностью."
      } ${REVIEW_NOTE}`,
      review: reviews ? { verdict: "potential_conflict", reason: confirmed.reason } : { verdict: "unreviewed", reason: "проверка моделью не удалась" },
      citations: [citation(pair.perform), citation(pair.control)],
    });
  });

  // New conflict-of-interest rules in «после».
  const beforeNorm = new Set(beforeClauses.map((c) => normalize(c.text)));
  let notes = 0;
  for (const clause of afterClauses) {
    if (notes >= NOTE_LIMIT) break;
    if (!/конфликт[а-я]* интересов/i.test(clause.text) || beforeNorm.has(normalize(clause.text))) continue;
    notes++;
    makeFinding(findings, {
      type: "NOTE",
      severity: "info",
      units: [],
      title: `Новая норма о конфликте интересов: п. ${clause.clause_id}`,
      explanation: `Пункт ${clause.clause_id} документов «после» вводит правило о конфликте интересов, которого в таком виде нет в документах «до». ${REVIEW_NOTE}`,
      citations: [{ doc_id: clause.doc_id, side: "after", clause_id: clause.clause_id, ref: clause.ref, quote: quoteOf(clause.text) }],
    });
  }

  findings.sort((a, b) => ORDER[a.type] - ORDER[b.type] || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  findings.forEach((f, i) => (f.finding_id = `f_${String(i + 1).padStart(3, "0")}`));
  return { findings, stats };
}

// ---------------------------------------------------------------- verify

/** Every citation's quote must be a substring of its clause; otherwise the finding is dropped. */
export function verifyFindings(findings, clauseIndex) {
  const kept = [];
  let dropped = 0;
  for (const finding of findings) {
    const ok =
      finding.citations.length > 0 &&
      finding.citations.every((c) => {
        const clause = clauseIndex.get(`${c.doc_id}:${c.clause_id}`);
        const quote = normalize(c.quote);
        return Boolean(clause) && quote.length > 0 && normalize(clause.text).includes(quote);
      });
    if (ok) kept.push(finding);
    else dropped++;
  }
  return { findings: kept, dropped };
}

export const clauseIndexOf = (docs) => new Map(docs.flatMap((d) => d.clauses.map((c) => [`${d.doc_id}:${c.clause_id}`, c])));

/** Whole stage: match → detect → verify. */
export async function compareFunctions({ before, after, units, docs, llm }) {
  const { matches, stats: matchStats, vectors } = await matchFunctions({ before, after, llm });
  const beforeClauses = docs.filter((d) => d.side === "before").flatMap((d) => d.clauses);
  const afterClauses = docs.filter((d) => d.side === "after").flatMap((d) => d.clauses);
  const { findings: raw, stats: detectStats } = await detectFindings({ before, after, matches, units, vectors, llm, beforeClauses, afterClauses });
  const { findings, dropped } = verifyFindings(raw, clauseIndexOf(docs));
  const count = (type) => findings.filter((f) => f.type === type).length;
  return {
    matches: matches.map(({ score, basis, ...m }) => ({ ...m, score: Number(score.toFixed(3)), ...(basis ? { basis } : {}) })),
    findings,
    stats: {
      ...matchStats,
      ...detectStats,
      dropped_unverified: dropped,
      potential_loss: count("POTENTIAL_LOSS"),
      moved: count("MOVED"),
      overlap: count("OVERLAP"),
      potential_duplication: count("POTENTIAL_DUPLICATION"),
      potential_conflict: count("POTENTIAL_CONFLICT"),
      notes: count("NOTE"),
    },
  };
}
