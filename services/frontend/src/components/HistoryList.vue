<script setup>
// One row per past run of the signed-in user: when, which files, how it ended
// and the headline numbers. Clicking a row reopens the analysis by id.
import { computed } from "vue";
import Icon from "../Icon.vue";

const props = defineProps({
  items: { type: Array, default: () => [] }, // GET /api/analyses rows
  limit: { type: Number, default: 0 },
  activeId: { type: String, default: "" },
});
const emit = defineEmits(["open"]);

const shown = computed(() => (props.limit ? props.items.slice(0, props.limit) : props.items));
const STATUS = {
  queued: { label: "в очереди", cls: "run" },
  running: { label: "выполняется", cls: "run" },
  done: { label: "готово", cls: "ok" },
  failed: { label: "ошибка", cls: "fail" },
};
const REJECTED = new Set(["irrelevant_document", "no_clauses", "incomplete_document", "no_functions"]);

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function when(iso) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `сегодня, ${time}` : `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${time}`;
}
function files(item, side) {
  const names = (item.inputs || []).filter((i) => i.side === side).map((i) => i.filename);
  return names.length ? names.join(", ") : "—";
}
function status(item) {
  if (item.status === "failed" && REJECTED.has(item.error?.code)) return { label: "не подходит", cls: "warn" };
  return STATUS[item.status] || { label: item.status, cls: "run" };
}
function digest(item) {
  const s = item.summary || {};
  if (item.status === "failed") return item.error?.message || "Причина не указана.";
  if (item.status !== "done") return "Анализ ещё выполняется, откройте, чтобы следить за ходом.";
  const parts = [];
  if (s.functions_before != null) parts.push(`${s.functions_before} ${plural(s.functions_before, "функция", "функции", "функций")} «до»`);
  parts.push(`${s.losses} ${plural(s.losses, "возможная потеря", "возможные потери", "возможных потерь")}`);
  if (s.conflicts) parts.push(`${s.conflicts} ${plural(s.conflicts, "конфликт", "конфликта", "конфликтов")}`);
  if (s.duplications) parts.push(`${s.duplications} ${plural(s.duplications, "дублирование", "дублирования", "дублирований")}`);
  if (s.units_created) parts.push(`${s.units_created} ${plural(s.units_created, "новое подразделение", "новых подразделения", "новых подразделений")}`);
  return parts.join(" · ");
}
function duration(item) {
  if (!item.duration_ms) return "";
  const s = Math.round(item.duration_ms / 1000);
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${s % 60} с`;
}
</script>

<template>
  <ul class="history">
    <li v-for="item in shown" :key="item._id">
      <button type="button" class="row" :class="{ active: item._id === activeId }" @click="emit('open', item._id)">
        <div class="when">
          <span class="time">{{ when(item.created_at) }}</span>
          <span class="source" :class="item.source">{{ item.source === "demo" ? "демо-пара" : "загрузка" }}</span>
        </div>
        <div class="what">
          <div class="pair">
            <span class="side">до</span><span class="name">{{ files(item, "before") }}</span>
            <Icon name="arrow-right" class="icon-sm arrow" />
            <span class="side">после</span><span class="name">{{ files(item, "after") }}</span>
          </div>
          <div class="digest" :class="{ fail: item.status === 'failed' }">{{ digest(item) }}</div>
        </div>
        <div class="end">
          <span class="pill" :class="status(item).cls"><i />{{ status(item).label }}</span>
          <span v-if="duration(item)" class="dur">{{ duration(item) }}</span>
        </div>
        <Icon name="chevron-right" class="icon-sm chev" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row {
  width: 100%; display: grid; grid-template-columns: 150px 1fr auto 16px; align-items: center; gap: 20px;
  padding: 14px 18px; border: 1px solid var(--panel-line); border-radius: 14px; background: var(--panel);
  box-shadow: var(--sh-panel); font: inherit; color: var(--text); text-align: left; cursor: pointer;
}
.row:hover { border-color: var(--accent-soft); background: var(--panel-2); }
.row.active { border-color: var(--accent); }
.when { display: flex; flex-direction: column; gap: 4px; }
.time { font-size: 13px; font-weight: 700; color: var(--navy); white-space: nowrap; }
.source { font-size: 11px; font-weight: 600; color: var(--muted); }
.what { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pair { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; }
.side { flex: none; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 1px 6px; border-radius: 6px; background: var(--chip); }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.arrow { flex: none; color: var(--muted); }
.digest { font-size: 13px; line-height: 20px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.digest.fail { color: var(--c-loss-text); }
.end { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.pill i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pill.ok { background: var(--c-ok-bg); color: var(--c-ok-text); }
.pill.fail { background: var(--c-loss-bg); color: var(--c-loss-text); }
.pill.warn { background: var(--c-dup-bg); color: var(--c-dup-text); }
.pill.run { background: var(--chip-hover); color: var(--accent); }
.pill.run i { animation: pulse 1.2s ease-in-out infinite; }
.dur { font-size: 11px; color: var(--muted); }
.chev { color: var(--muted); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@media (max-width: 720px) {
  .row { grid-template-columns: 1fr auto; gap: 8px 12px; }
  .when { flex-direction: row; gap: 10px; grid-column: 1; }
  .end { flex-direction: row; grid-column: 2; grid-row: 1; }
  .what { grid-column: 1 / -1; }
  .chev { display: none; }
}
</style>
