// Stage 5 (docs/TASK.md §4): the Russian conclusion. The LLM writes from the
// findings only; code removes any reference that is not a finding citation and
// appends the advisory disclaimer. If the LLM fails, a deterministic summary
// is produced so the analysis still completes (stats.conclusion = "fallback").
import { prompt } from "../prompts.js";
import { ReportResponse } from "../schemas.js";
import { FINDING_LABELS } from "./compare.js";

export const DISCLAIMER = "Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.";
const REF = /\[(до|после) · п\. ([^\]]+)\]/g;
const MAX_FINDINGS_IN_PROMPT = 60;

const sideRu = (side) => (side === "before" ? "до" : "после");

export const refOf = (citation) => `[${sideRu(citation.side)} · п. ${citation.clause_id}]`;

/** Removes references that are not in `allowed`; returns the text and how many were stripped. */
export function stripUnknownRefs(markdown, allowed) {
  let stripped = 0;
  const text = markdown.replace(REF, (match, side, clause) => {
    if (allowed.has(`[${side} · п. ${clause.trim()}]`)) return match;
    stripped++;
    return "";
  });
  return { text: text.replace(/[ \t]+\n/g, "\n"), stripped };
}

const STATUS_RU = { created: "создано", kept: "сохранено", reorganized: "реорганизовано", removed: "упразднено" };

function fallbackConclusion({ findings, units, unit_changes }) {
  const unitById = new Map(units.map((u) => [u.unit_id, u]));
  const name = (id) => {
    const u = unitById.get(id);
    return u ? u.abbr || u.name : id;
  };
  const lines = ["## Итоги реорганизации", ""];
  for (const change of unit_changes) {
    const who = name(change.after ?? change.before);
    const succ = change.successors.length ? ` → ${change.successors.map(name).join(", ")}` : "";
    lines.push(`- ${who}: ${STATUS_RU[change.status]}${succ} (${change.reason}).`);
  }
  const section = (title, types, empty) => {
    lines.push("", `## ${title}`, "");
    const list = findings.filter((f) => types.includes(f.type));
    if (!list.length) lines.push(empty);
    for (const f of list) lines.push(`- ${f.title} ${f.citations.map(refOf).join(" ")}`);
  };
  section("Возможная потеря функций", ["POTENTIAL_LOSS"], "Возможных потерь функций не выявлено.");
  section("Возможное дублирование и пересечения", ["POTENTIAL_DUPLICATION", "OVERLAP"], "Признаков дублирования не выявлено.");
  section("Возможные конфликты независимости / ответственности", ["POTENTIAL_CONFLICT"], "Признаков конфликта не выявлено.");
  lines.push("", "## Рекомендации", "", "- Проверить перечисленные пункты с ответственными подразделениями и при необходимости закрепить функции явно.");
  return lines.join("\n");
}

/**
 * @returns {Promise<{conclusion_md: string, stats: object}>}
 */
export async function writeConclusion({ findings, units, unit_changes, stats, llm }) {
  const allowed = new Set(findings.flatMap((f) => f.citations.map(refOf)));
  const unitById = new Map(units.map((u) => [u.unit_id, u]));
  const unitLabel = (id) => {
    const u = unitById.get(id);
    return u ? `${u.abbr || u.name}${u.abbr ? ` (${u.name})` : ""}` : id;
  };
  let conclusion = null;
  let stripped = 0;
  let source = "llm";
  try {
    const response = await llm.completeJson({
      name: "report",
      schema: ReportResponse,
      maxTokens: 6000,
      prompt: prompt("report", {
        allowed_refs: [...allowed].join(" ") || "нет",
        units: units.map((u) => `${u.side === "before" ? "до" : "после"}: ${unitLabel(u.unit_id)} [${u.kind}]`).join("; "),
        unit_changes: unit_changes
          .map((c) => `${unitLabel(c.after ?? c.before)}: ${STATUS_RU[c.status]}${c.successors.length ? ` → ${c.successors.map(unitLabel).join(", ")}` : ""}; ${c.reason}`)
          .join("\n"),
        stats: JSON.stringify(stats),
        findings: JSON.stringify(
          findings.slice(0, MAX_FINDINGS_IN_PROMPT).map((f) => ({
            type: f.type,
            label: FINDING_LABELS[f.type],
            severity: f.severity,
            units: f.units,
            title: f.title,
            explanation: f.explanation,
            review: f.review,
            citations: f.citations.map((c) => ({ ref: refOf(c), where: c.ref, quote: c.quote.slice(0, 200) })),
          })),
          null,
          1,
        ),
      }),
    });
    ({ text: conclusion, stripped } = stripUnknownRefs(response.conclusion_md, allowed));
  } catch (err) {
    console.warn(`[report] LLM conclusion failed (${err.message}); using the deterministic summary`);
    conclusion = fallbackConclusion({ findings, units, unit_changes });
    source = "fallback";
  }
  return {
    conclusion_md: `${conclusion.trim()}\n\n---\n\n_${DISCLAIMER}_\n`,
    stats: { conclusion: source, refs_stripped: stripped },
  };
}
