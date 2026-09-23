// Plain-Russian sentences and groupings for the results screens. All numbers
// come from the analysis document; nothing here calls the model.

const FORMS = {
  unit: ["подразделение", "подразделения", "подразделений"],
  fn: ["функция", "функции", "функций"],
};

export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const WORDS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"];
const WORDS_N = ["", "одно", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"];
const WORDS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"];
const numWord = (n, gender) => (n <= 10 ? (gender === "f" ? WORDS_F : gender === "m" ? WORDS_M : WORDS_N)[n] : String(n));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const SHORT_TYPE = {
  POTENTIAL_LOSS: "Потеря",
  POTENTIAL_CONFLICT: "Конфликт",
  POTENTIAL_DUPLICATION: "Дублирование",
  OVERLAP: "Пересечение",
  MOVED: "Перераспределена",
  NOTE: "Примечание",
};

export const TYPE_COLOR = {
  POTENTIAL_LOSS: "loss",
  POTENTIAL_CONFLICT: "conflict",
  POTENTIAL_DUPLICATION: "dup",
  OVERLAP: "dup",
  MOVED: "info",
  NOTE: "info",
};

export const isPartialLoss = (f) => f.type === "POTENTIAL_LOSS" && f.severity !== "high";
export const shortType = (f) => (isPartialLoss(f) ? "Частично" : SHORT_TYPE[f.type] ?? f.type);

/** "Возможная потеря функции: формировать группы" → "Формировать группы". */
export function rowTitle(finding) {
  const idx = finding.title.indexOf(": ");
  const text = idx >= 0 ? finding.title.slice(idx + 2) : finding.title;
  return cap(text);
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2, info: 3 };
const TYPE_RANK = { POTENTIAL_LOSS: 0, POTENTIAL_CONFLICT: 1, POTENTIAL_DUPLICATION: 2, OVERLAP: 3, MOVED: 4, NOTE: 5 };

export function sortFindings(findings) {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || TYPE_RANK[a.type] - TYPE_RANK[b.type]);
}

export const isPrimary = (f) => f.severity === "high" || f.severity === "medium";

/** Distribution of «до» functions: kept / moved / partial / lost. */
export function distribution(matches) {
  const d = { kept: 0, moved: 0, partial: 0, lost: 0, total: matches.length };
  for (const m of matches) {
    if (m.relation === "unmatched") d.lost++;
    else if (m.relation === "partial" || m.basis === "partial") d.partial++;
    else if (m.relation === "moved") d.moved++;
    else d.kept++;
  }
  return d;
}

export function unitLabel(unit) {
  return unit ? unit.abbr || unit.name : "";
}

/** One-line verdict, built from counts. */
export function headline(analysis) {
  const changes = analysis.unit_changes ?? [];
  const created = changes.filter((c) => c.status === "created").length;
  const reorganized = changes.filter((c) => c.status === "reorganized").length;
  const findings = analysis.findings ?? [];
  const lostHigh = findings.filter((f) => f.type === "POTENTIAL_LOSS" && f.severity === "high").length;
  const conflicts = findings.filter((f) => f.type === "POTENTIAL_CONFLICT").length;
  const dups = findings.filter((f) => f.type === "POTENTIAL_DUPLICATION").length;
  const parts = [];
  if (created) parts.push(`${numWord(created, "n")} ${plural(created, FORMS.unit)} ${plural(created, ["создано", "созданы", "создано"])}`);
  else if (reorganized) parts.push(`${numWord(reorganized, "n")} ${plural(reorganized, FORMS.unit)} ${plural(reorganized, ["реорганизовано", "реорганизованы", "реорганизовано"])}`);
  if (lostHigh) parts.push(`${numWord(lostHigh, "f")} ${plural(lostHigh, FORMS.fn)} ${plural(lostHigh, ["могла быть утрачена", "могли быть утрачены", "могли быть утрачены"])}`);
  else if (conflicts) parts.push(`${numWord(conflicts, "m")} ${plural(conflicts, ["признак конфликта", "признака конфликта", "признаков конфликта"])}`);
  else if (dups) parts.push(`${numWord(dups, "n")} ${plural(dups, ["дублирование функций", "дублирования функций", "дублирований функций"])}`);
  if (!parts.length) return "Существенных отклонений не найдено";
  return cap(parts.join(", "));
}

/** Two or three sentences under the headline. */
export function lead(analysis) {
  const units = new Map((analysis.units ?? []).map((u) => [u.unit_id, u]));
  const name = (id) => unitLabel(units.get(id));
  const changes = analysis.unit_changes ?? [];
  const findings = analysis.findings ?? [];
  const stats = analysis.stats ?? {};
  const sentences = [];
  const created = changes.filter((c) => c.status === "created").map((c) => name(c.after));
  const reorganized = changes.filter((c) => c.status === "reorganized");
  const removed = changes.filter((c) => c.status === "removed").map((c) => name(c.before));
  if (created.length) sentences.push(`${created.length > 1 ? "Созданы" : "Создано"} ${created.join(" и ")}`);
  for (const c of reorganized) {
    sentences.push(`${name(c.before)} ${c.successors.length > 1 ? `распределено между ${c.successors.map(name).join(" и ")}` : c.successors.length === 1 ? `передано ${name(c.successors[0])}` : "реорганизовано"}`);
  }
  if (removed.length) sentences.push(`${removed.length > 1 ? "Упразднены" : "Упразднено"} ${removed.join(", ")}`);
  const first = sentences.length ? `${sentences.join("; ").replace(/^./, (ch) => ch.toUpperCase())}.` : "Состав подразделений не изменился.";
  const lost = findings.filter((f) => f.type === "POTENTIAL_LOSS" && f.severity === "high").length;
  const partial = findings.filter(isPartialLoss).length;
  const total = stats.functions_before ?? 0;
  const second =
    lost || partial
      ? `Из ${total} ${plural(total, FORMS.fn)} редакции «до» ${lost ? `у ${lost} не найдено эквивалента` : ""}${lost && partial ? ", " : ""}${partial ? `у ${partial} найден только частичный` : ""}.`
      : `Все ${total} ${plural(total, FORMS.fn)} редакции «до» нашли эквивалент в редакции «после».`;
  const conflicts = findings.filter((f) => f.type === "POTENTIAL_CONFLICT");
  const dups = findings.filter((f) => f.type === "POTENTIAL_DUPLICATION");
  const third = [];
  if (conflicts.length) third.push(`${numWord(conflicts.length, "m")} ${plural(conflicts.length, ["признак конфликта независимости", "признака конфликта независимости", "признаков конфликта независимости"])} у ${[...new Set(conflicts.flatMap((f) => f.units))].join(", ")}`);
  if (dups.length) third.push(`${numWord(dups.length, "f")} ${plural(dups.length, ["совпадающая функция", "совпадающие функции", "совпадающих функций"])} у ${[...new Set(dups.flatMap((f) => f.units))].slice(0, 3).join(" и ")}`);
  return [first, second, third.length ? `${cap(third.join(" и "))}.` : ""].filter(Boolean).join(" ");
}

/** Recommendations from the conclusion Markdown («## Рекомендации» section), as plain lines. */
export function recommendations(markdown) {
  const match = /##\s*Рекомендации[^\n]*\n([\s\S]*?)(?:\n##\s|\n---|$)/.exec(markdown ?? "");
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").replace(/\[(до|после) · п\. [^\]]+\]/g, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 3)
    .slice(0, 5);
}

/** Findings that mention a unit, grouped for its page. */
export function unitFindings(findings, label) {
  const mine = findings.filter((f) => f.units.includes(label));
  return {
    lost: mine.filter((f) => f.type === "POTENTIAL_LOSS"),
    conflicts: mine.filter((f) => f.type === "POTENTIAL_CONFLICT"),
    overlaps: mine.filter((f) => f.type === "POTENTIAL_DUPLICATION" || f.type === "OVERLAP"),
    moved: mine.filter((f) => f.type === "MOVED"),
    notes: mine.filter((f) => f.type === "NOTE"),
  };
}
