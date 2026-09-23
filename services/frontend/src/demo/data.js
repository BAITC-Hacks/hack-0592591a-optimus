// Demo dataset (bundled) + enum → label/class/icon maps. One source of truth for labels.
import raw from "../data/demo_data.json";

export const demo = raw;

export const SEVERITY = {
  high: { label: "Высокая", cls: "sev-high", icon: "alert-octagon" },
  medium: { label: "Средняя", cls: "sev-medium", icon: "alert-triangle" },
  low: { label: "Низкая", cls: "sev-low", icon: "info" },
};

export const STATUS = {
  pending: { label: "Не проверено", cls: "st-pending", icon: "clock" },
  accepted: { label: "Принято", cls: "st-accepted", icon: "check-circle" },
  accepted_edited: { label: "Принято с правками", cls: "st-accepted", icon: "pencil" },
  rejected: { label: "Отклонено", cls: "st-rejected", icon: "x" },
};

export const CONFIDENCE = {
  high: { label: "уверенность: высокая", cls: "high" },
  medium: { label: "уверенность: средняя", cls: "mid" },
  low: { label: "уверенность: низкая", cls: "low" },
};

export const BASIS = {
  explicit: { label: "явно в документе", icon: "file-text" },
  inferred: { label: "вывод агента", icon: "sparkles" },
};

export const TAB_LABELS = {
  overview: "Обзор",
  structure: "Структура",
  functions: "Функции",
  duplication: "Дублирование",
  coi: "Конфликт интересов",
  doc_quality: "Качество документа",
  compliance: "Соответствие",
  benchmark: "Бенчмарк",
  recommendations: "Рекомендации",
};

export const SESSION_STATUS = {
  draft: { label: "Черновик", cls: "badge-outline" },
  analyzing: { label: "Идёт анализ", cls: "badge-info" },
  review: { label: "На проверке", cls: "badge-dup" },
  completed: { label: "Завершено", cls: "badge-ok" },
};

export const COMPLIANCE_STATUS = {
  met: { label: "Выполнено", icon: "check-circle", cls: "c-met" },
  partial: { label: "Частично", icon: "alert-triangle", cls: "c-partial" },
  not_met: { label: "Не выполнено", icon: "alert-octagon", cls: "c-not" },
  no_internal_clause: { label: "Нет внутренней нормы", icon: "search", cls: "c-none" },
};

export const REJECT_REASONS = raw.enums.reject_reasons || [
  "Ложное срабатывание", "Намеренное изменение", "Покрыто другим документом",
  "Нерелевантная норма", "Устаревшая редакция", "Другое",
];

export const GLOSSARY = {
  "БВА": "Блок внутреннего аудита",
  "ДНМ": "Департамент непрерывного мониторинга СВК",
  "ДККМ": "Департамент контроля качества аудита и методологии",
  "ДИТААД": "Департамент ИТ-аудита и анализа данных",
  "ДОА": "Департамент операционного аудита",
  "СВК": "Система внутреннего контроля",
  "КИ": "Конфликт интересов",
  "ДЗО": "Дочерние и зависимые организации",
};

// para_id → finding ids, per document side (for margin markers in the viewer)
export const paraFindingIndex = { before: {}, after: {} };
for (const f of raw.findings) {
  for (const c of f.citations) {
    if (c.type === "internal" && c.anchor?.para_id) {
      (paraFindingIndex[c.doc][c.anchor.para_id] ||= []).push(f.id);
    }
  }
}

export const findingById = Object.fromEntries(raw.findings.map((f) => [f.id, f]));

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
