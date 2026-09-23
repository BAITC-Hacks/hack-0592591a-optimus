<script setup>
import { computed, ref } from "vue";
import DistributionBar from "./DistributionBar.vue";
import FindingRow from "./FindingRow.vue";
import { distribution, plural, unitFindings, unitLabel } from "./text.js";

const props = defineProps({
  analysis: { type: Object, required: true },
  selected: { type: String, default: "" },
});
const emit = defineEmits(["select", "open-clause"]);

const showMoved = ref(false);
const units = computed(() => props.analysis.units ?? []);
const byId = computed(() => new Map(units.value.map((u) => [u.unit_id, u])));
const changeOf = computed(() => {
  const m = new Map();
  for (const c of props.analysis.unit_changes ?? []) {
    if (c.after) m.set(c.after, c);
    if (c.before && !c.after) m.set(c.before, c);
  }
  return m;
});
const rank = { created: 0, kept: 1, reorganized: 2, removed: 3 };
const afterUnits = computed(() => [...units.value.filter((u) => u.side === "after")].sort((a, b) => (rank[changeOf.value.get(a.unit_id)?.status] ?? 1) - (rank[changeOf.value.get(b.unit_id)?.status] ?? 1)));
const goneUnits = computed(() => units.value.filter((u) => u.side === "before" && ["reorganized", "removed"].includes(changeOf.value.get(u.unit_id)?.status)));
const current = computed(() => {
  const label = props.selected;
  return units.value.find((u) => u.side === "after" && unitLabel(u) === label) ?? units.value.find((u) => unitLabel(u) === label) ?? afterUnits.value[0] ?? null;
});
const label = computed(() => unitLabel(current.value));
const groups = computed(() => unitFindings(props.analysis.findings ?? [], label.value));
const countsOf = (u) => {
  const g = unitFindings(props.analysis.findings ?? [], unitLabel(u));
  const parts = [];
  if (g.lost.length) parts.push(`${g.lost.length} ${plural(g.lost.length, ["потеря", "потери", "потерь"])}`);
  if (g.conflicts.length) parts.push(`${g.conflicts.length} конфликт`);
  if (g.overlaps.length) parts.push(`${g.overlaps.length} ${plural(g.overlaps.length, ["совпадение", "совпадения", "совпадений"])}`);
  return parts;
};
const change = computed(() => (current.value ? changeOf.value.get(current.value.unit_id) : null));
const STATUS = { kept: "Сохранён", created: "Создан", reorganized: "Реорганизовано", removed: "Упразднено" };
const statusLine = computed(() => {
  const c = change.value;
  if (!c || !current.value) return "";
  const b = c.before ? byId.value.get(c.before) : null;
  const a = c.after ? byId.value.get(c.after) : null;
  if (c.status === "kept") return `Сохранён · до п. ${b?.source_clause} → после п. ${a?.source_clause}`;
  if (c.status === "created") return `Создан · после п. ${a?.source_clause}`;
  if (c.status === "reorganized") return `Реорганизовано → ${c.successors.map((id) => unitLabel(byId.value.get(id))).join(", ")} · до п. ${b?.source_clause}`;
  return `Упразднено · до п. ${b?.source_clause}`;
});
// Functions of this unit in «до» and how they fared; new duties in «после».
const beforeFns = computed(() => (props.analysis.functions?.before ?? []).filter((f) => f.owners.includes(label.value)));
const afterFns = computed(() => (props.analysis.functions?.after ?? []).filter((f) => f.owners.includes(label.value)));
const dist = computed(() => {
  const ids = new Set(beforeFns.value.map((f) => f.func_id));
  return distribution((props.analysis.matches ?? []).filter((m) => ids.has(m.before_id)));
});
const newCount = computed(() => {
  const matched = new Set((props.analysis.matches ?? []).map((m) => m.after_id).filter(Boolean));
  return afterFns.value.filter((f) => !matched.has(f.func_id)).length;
});
const summary = computed(() => {
  const n = beforeFns.value.length;
  if (!n) return `Новое подразделение: ${afterFns.value.length} ${plural(afterFns.value.length, ["функция", "функции", "функций"])} в редакции «после».`;
  const d = dist.value;
  const parts = [`${d.kept} сохранены`, d.moved ? `${d.moved} переданы другим` : "", d.partial ? `${d.partial} сохранены частично` : "", d.lost ? `${d.lost} возможно утрачены` : ""].filter(Boolean);
  return `${n} ${plural(n, ["функция", "функции", "функций"])} в редакции «до»: ${parts.join(", ")}.${newCount.value ? ` В редакции «после» добавлено ${newCount.value} ${plural(newCount.value, ["новая обязанность", "новые обязанности", "новых обязанностей"])}.` : ""}`;
});
</script>

<template>
  <div class="unitpage">
    <nav class="rail panel" aria-label="Подразделения">
      <div class="rail-head">Редакция «после»</div>
      <button v-for="u in afterUnits" :key="u.unit_id" type="button" class="rail-item" :class="{ active: unitLabel(u) === label }" @click="emit('select', unitLabel(u))">
        <span class="ri-text">
          <b>{{ unitLabel(u) }}</b>
          <span class="ri-sub" :class="{ ok: changeOf.get(u.unit_id)?.status === 'created', warn: countsOf(u).length }">
            <template v-if="changeOf.get(u.unit_id)?.status === 'created'">создан</template>
            <template v-else-if="countsOf(u).length">{{ countsOf(u).join(" · ") }}</template>
            <template v-else>без существенных изменений</template>
          </span>
        </span>
        <span class="marks">
          <i v-if="unitFindings(analysis.findings, unitLabel(u)).lost.length" class="m loss" />
          <i v-if="unitFindings(analysis.findings, unitLabel(u)).conflicts.length" class="m conflict" />
        </span>
      </button>
      <template v-if="goneUnits.length">
        <div class="rail-head gone">Только в редакции «до»</div>
        <button v-for="u in goneUnits" :key="u.unit_id" type="button" class="rail-item" :class="{ active: unitLabel(u) === label }" @click="emit('select', unitLabel(u))">
          <span class="ri-text">
            <b>{{ unitLabel(u) }}</b>
            <span class="ri-sub reorg">{{ changeOf.get(u.unit_id)?.status === "reorganized" ? `реорганизовано → ${changeOf.get(u.unit_id).successors.map((id) => unitLabel(byId.get(id))).join(", ")}` : "упразднено" }}</span>
          </span>
        </button>
      </template>
    </nav>

    <div v-if="current" class="content">
      <header class="panel head">
        <div class="head-text">
          <div class="eyebrow-s">{{ statusLine }}</div>
          <h1>{{ current.abbr || current.name }}<span v-if="current.abbr" class="h-sub"> · {{ current.name }}</span></h1>
          <p>{{ summary }}</p>
        </div>
        <DistributionBar v-if="beforeFns.length" :d="dist" compact />
      </header>

      <section v-if="groups.lost.length" class="group">
        <h2><i class="m loss" />Возможно утрачено <span>{{ groups.lost.length }}</span></h2>
        <div class="panel list"><FindingRow v-for="(f, i) in groups.lost" :key="f.finding_id" :finding="f" :documents="analysis.documents" :open="i === 0" @open-clause="emit('open-clause', $event)" /></div>
      </section>
      <section v-if="groups.conflicts.length" class="group">
        <h2><i class="m conflict" />Конфликт независимости <span>{{ groups.conflicts.length }}</span></h2>
        <div class="panel list"><FindingRow v-for="f in groups.conflicts" :key="f.finding_id" :finding="f" :documents="analysis.documents" @open-clause="emit('open-clause', $event)" /></div>
      </section>
      <section v-if="groups.overlaps.length" class="group">
        <h2><i class="m dup" />Совпадения и пересечения с другими подразделениями <span>{{ groups.overlaps.length }}</span></h2>
        <div class="panel list"><FindingRow v-for="f in groups.overlaps" :key="f.finding_id" :finding="f" :documents="analysis.documents" @open-clause="emit('open-clause', $event)" /></div>
      </section>
      <section v-if="groups.notes.length" class="group">
        <h2><i class="m info" />Примечания <span>{{ groups.notes.length }}</span></h2>
        <div class="panel list"><FindingRow v-for="f in groups.notes" :key="f.finding_id" :finding="f" :documents="analysis.documents" @open-clause="emit('open-clause', $event)" /></div>
      </section>
      <div v-if="!groups.lost.length && !groups.conflicts.length && !groups.overlaps.length" class="panel empty">
        <div class="eyebrow-s">Отклонений не найдено</div>
        <p>По этому подразделению нет возможных потерь, конфликтов и дублирований.</p>
      </div>

      <div class="pills">
        <button v-if="groups.moved.length" type="button" class="pill" :class="{ on: showMoved }" @click="showMoved = !showMoved">Передано другим · {{ groups.moved.length }}</button>
        <span v-if="beforeFns.length" class="pill static">Сохранено без изменений · {{ dist.kept }}</span>
        <span v-if="newCount" class="pill static">Новое в редакции «после» · {{ newCount }}</span>
      </div>
      <div v-if="showMoved && groups.moved.length" class="panel list"><FindingRow v-for="f in groups.moved" :key="f.finding_id" :finding="f" :documents="analysis.documents" @open-clause="emit('open-clause', $event)" /></div>
    </div>
  </div>
</template>

<style scoped>
.unitpage { display: grid; grid-template-columns: 296px minmax(0, 1fr); gap: 32px; align-items: start; padding: 32px 0 40px; }
.panel { background: var(--panel); border: 1px solid var(--panel-line); border-radius: 16px; box-shadow: var(--sh-panel); }
.panel.list { overflow: hidden; border-radius: 14px; }
.rail { padding: 10px 0; display: flex; flex-direction: column; }
.rail-head { padding: 8px 22px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.rail-head.gone { margin: 8px 22px 0; padding: 12px 0 4px; border-top: 1px solid var(--panel-line); }
.rail-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 22px; border: 0; background: transparent; font: inherit; text-align: left; color: var(--text); cursor: pointer; }
.rail-item:hover { background: var(--page); }
.rail-item.active { background: var(--chip); box-shadow: inset 3px 0 0 var(--accent); }
.rail-item.active b { color: var(--navy); }
.ri-text { display: flex; flex-direction: column; min-width: 0; }
.ri-text b { font-weight: 600; }
.ri-sub { font-size: 12px; color: var(--muted); }
.ri-sub.ok { color: var(--c-ok-text); }
.ri-sub.reorg { color: var(--c-reorg-text); }
.marks { display: inline-flex; gap: 4px; }
.m { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--accent-soft); }
.m.loss { background: var(--c-loss); } .m.conflict { background: var(--c-conflict); } .m.dup { background: var(--c-dup); } .m.info { background: var(--accent-soft); }
.content { display: flex; flex-direction: column; gap: 24px; }
.head { padding: 26px 28px; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; align-items: end; }
.head-text { display: flex; flex-direction: column; gap: 8px; }
.head p { margin: 0; font-size: 15px; line-height: 23px; color: var(--text-2); }
h1 { margin: 0; font-family: var(--font-display); font-size: 30px; line-height: 38px; font-weight: 800; letter-spacing: -0.02em; color: var(--navy); }
.h-sub { font-weight: 600; color: var(--muted); font-size: 22px; }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.group { display: flex; flex-direction: column; gap: 10px; }
h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 17px; line-height: 24px; font-weight: 800; color: var(--navy); }
h2 .m { width: 10px; height: 10px; }
h2 span { font-weight: 600; color: var(--muted); }
.panel.empty { padding: 28px 24px; display: flex; flex-direction: column; gap: 6px; }
.panel.empty p { margin: 0; color: var(--text-2); }
.pills { display: flex; flex-wrap: wrap; gap: 10px; }
.pill { padding: 8px 14px; border: 1px solid #D5DBE6; border-radius: 9px; background: var(--panel); font: inherit; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; }
.pill.on { border-color: var(--accent); color: var(--accent); }
.pill.static { cursor: default; }
@media (max-width: 1000px) {
  .unitpage { grid-template-columns: minmax(0, 1fr); }
  .head { grid-template-columns: minmax(0, 1fr); }
}
</style>
