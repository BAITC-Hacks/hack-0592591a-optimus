// Enum → label / class / icon, in one place (DESIGN_SYSTEM.md §11).
export const UNIT_STATUS = {
  created: { label: "Создано", cls: "badge-created", icon: "plus-circle" },
  kept: { label: "Сохранено", cls: "badge-kept", icon: "check-circle" },
  reorganized: { label: "Реорганизовано", cls: "badge-reorg", icon: "shuffle" },
  removed: { label: "Упразднено", cls: "badge-abolished", icon: "minus-circle" },
};

export const FINDING_TYPE = {
  POTENTIAL_LOSS: { label: "Возможная потеря функции", cls: "badge-loss", card: "f-loss", tile: "tile-loss", icon: "alert-octagon", quote: "q-loss" },
  POTENTIAL_CONFLICT: { label: "Возможный конфликт независимости / ответственности", cls: "badge-conflict", card: "f-conflict", tile: "tile-conflict", icon: "scale", quote: "" },
  POTENTIAL_DUPLICATION: { label: "Возможное дублирование", cls: "badge-dup", card: "f-dup", tile: "tile-dup", icon: "copy", quote: "q-dup" },
  OVERLAP: { label: "Пересечение общей и частной нормы", cls: "badge-dup", card: "f-dup", tile: "tile-dup", icon: "copy", quote: "q-dup" },
  MOVED: { label: "Функция перераспределена", cls: "badge-info", card: "f-info", tile: "tile-soft", icon: "shuffle", quote: "" },
  NOTE: { label: "Примечание", cls: "badge-info", card: "f-info", tile: "tile-soft", icon: "info", quote: "" },
};

// O1 findings, «Нормативные требования» tab (docs/TASK.md §12a).
export const REGULATORY_TYPE = {
  POTENTIAL_REGULATORY_CONFLICT: { label: "Возможное расхождение с нормой", cls: "badge-conflict", card: "f-conflict", icon: "scale" },
  REGULATORY_BASIS: { label: "Нормативное основание", cls: "badge-ok", card: "f-info", icon: "scale" },
};

// Main list vs the collapsed group of low-importance cards (docs/TASK.md §8).
export const PRIMARY_FINDINGS = ["POTENTIAL_LOSS", "POTENTIAL_CONFLICT", "POTENTIAL_DUPLICATION"];
export const SECONDARY_FINDINGS = ["MOVED", "OVERLAP", "NOTE"];

export const SEVERITY = {
  high: { label: "важность высокая", cls: "high" },
  medium: { label: "важность средняя", cls: "mid" },
  low: { label: "важность низкая", cls: "low" },
  info: { label: "справочно", cls: "low" },
};

export const RELATION = {
  same: { label: "Совпадает", cls: "badge-ok", icon: "check" },
  partial: { label: "Частично", cls: "badge-dup", icon: "compare" },
  moved: { label: "Перераспределена", cls: "badge-info", icon: "shuffle" },
  unmatched: { label: "Не найдена", cls: "badge-loss", icon: "alert-octagon" },
};

export const STEP = {
  exact: "точное совпадение",
  jaccard: "лексическое сходство",
  embeddings: "семантическое сходство",
  lexical: "лексические кандидаты",
  judge: "оценка модели",
};

export const STAGES = [
  { key: "clauses", label: "Разбор", hint: "Извлекаем пункты из документов" },
  { key: "structure", label: "Структура", hint: "Определяем подразделения «до» и «после»" },
  { key: "functions", label: "Функции", hint: "Модель размечает функции по пунктам" },
  { key: "compare", label: "Сопоставление", hint: "Сопоставляем функции и ищем отклонения" },
  { key: "report", label: "Заключение", hint: "Формируем заключение" },
];

export const CATEGORY = {
  perform_audit: "проведение проверок",
  quality_control: "контроль качества",
  plan: "планирование",
  report: "отчётность",
  method: "методология",
  monitor: "мониторинг",
  interact: "взаимодействие",
  other: "прочее",
};

export const SIDE = { before: "до", after: "после" };

export const REVIEW_NOTE = "Требует проверки ответственным сотрудником.";

export function fileTypeClass(name) {
  const ext = String(name).split(".").pop().toLowerCase();
  if (ext === "pdf") return { cls: "ft-pdf", label: "PDF" };
  if (ext === "docx" || ext === "doc") return { cls: "ft-docx", label: "DOCX" };
  return { cls: "ft-xlsx", label: "XLSX" };
}
