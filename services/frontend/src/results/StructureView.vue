<script setup>
// «Структура»: how every unit of the «до» structure went into the «после» one,
// as in the design mock: two columns of unit cards joined by curves, a legend,
// and a side panel with the basis for the selected unit.
import { computed, ref, watch } from "vue";
import Icon from "../Icon.vue";
import { unitLabel } from "./text.js";

const props = defineProps({
  analysis: { type: Object, required: true },
  selected: { type: String, default: "" }, // unit label (abbr or name)
});
const emit = defineEmits(["select", "open-clause", "show-losses"]);

const ROW = 76; // card 60 + gap 16
const CARD = 60;
const GAP_W = 200;

const units = computed(() => props.analysis.units ?? []);
const byId = computed(() => new Map(units.value.map((u) => [u.unit_id, u])));
const changes = computed(() => props.analysis.unit_changes ?? []);

const model = computed(() => {
  const before = units.value.filter((u) => u.side === "before");
  const after = units.value.filter((u) => u.side === "after");
  const change = new Map();
  for (const c of changes.value) {
    if (c.before) change.set(c.before, c);
    if (c.after && !change.has(c.after)) change.set(c.after, c);
  }
  const rank = { kept: 0, reorganized: 1, removed: 2 };
  const beforeSorted = [...before].sort((a, b) => (rank[change.get(a.unit_id)?.status] ?? 0) - (rank[change.get(b.unit_id)?.status] ?? 0));
  // «после» follows the «до» order (kept, then successors), created units last.
  const placed = new Set();
  const afterSorted = [];
  const place = (id) => { const u = byId.value.get(id); if (u && u.side === "after" && !placed.has(id)) { placed.add(id); afterSorted.push(u); } };
  for (const u of beforeSorted) {
    const c = change.get(u.unit_id);
    if (c?.status === "kept") place(c.after);
    if (c?.status === "reorganized") c.successors.forEach(place);
  }
  after.forEach((u) => place(u.unit_id));
  const yb = new Map(beforeSorted.map((u, i) => [u.unit_id, i * ROW]));
  const ya = new Map(afterSorted.map((u, i) => [u.unit_id, i * ROW]));
  const links = [];
  for (const c of changes.value) {
    if (c.status === "kept" && yb.has(c.before) && ya.has(c.after)) links.push({ from: yb.get(c.before), to: ya.get(c.after), kind: "kept", ids: [c.before, c.after] });
    if (c.status === "reorganized") for (const s of c.successors) if (yb.has(c.before) && ya.has(s)) links.push({ from: yb.get(c.before), to: ya.get(s), kind: "reorg", ids: [c.before, s] });
  }
  const rows = Math.max(beforeSorted.length, afterSorted.length);
  const describe = (u) => {
    const c = change.get(u.unit_id);
    const names = (ids) => ids.map((id) => unitLabel(byId.value.get(id))).filter(Boolean).join(", ");
    if (!c) return { status: "kept", text: "Сохранено" };
    if (c.status === "kept") return { status: "kept", text: u.side === "before" ? `Сохранено → ${unitLabel(byId.value.get(c.after))}` : "Сохранено" };
    if (c.status === "reorganized") return u.side === "before" ? { status: "reorganized", text: `Реорганизовано → ${names(c.successors) || "?"}` } : { status: "reorganized", text: `Из ${unitLabel(byId.value.get(c.before))}` };
    if (c.status === "created") return { status: "created", text: `Создано · ${u.abbr || ""}`.replace(/ · $/, "") };
    if (c.status === "removed") return { status: "removed", text: "Упразднено · функции не переданы" };
    return { status: c.status, text: "" };
  };
  return {
    height: rows * ROW - 16,
    before: beforeSorted.map((u) => ({ u, y: yb.get(u.unit_id), ...describe(u), change: change.get(u.unit_id) })),
    after: afterSorted.map((u) => ({ u, y: ya.get(u.unit_id), ...describe(u), change: change.get(u.unit_id) })),
    links,
    removed: beforeSorted.filter((u) => change.get(u.unit_id)?.status === "removed").map((u) => ({ y: yb.get(u.unit_id) })),
  };
});
const path = (l) => `M0 ${l.from + CARD / 2} C ${GAP_W / 2} ${l.from + CARD / 2}, ${GAP_W / 2} ${l.to + CARD / 2}, ${GAP_W} ${l.to + CARD / 2}`;

const current = ref(null); // selected unit_id
watch(() => props.selected, (label) => { if (label) current.value = units.value.find((u) => u.side === "after" && unitLabel(u) === label)?.unit_id ?? current.value; }, { immediate: true });
const isLit = (id) => current.value && model.value.links.some((l) => l.ids.includes(current.value) && l.ids.includes(id));
const detail = computed(() => {
  const u = byId.value.get(current.value);
  if (!u) return null;
  const row = [...model.value.before, ...model.value.after].find((r) => r.u.unit_id === u.unit_id);
  const label = unitLabel(u);
  const fns = (props.analysis.functions?.[u.side] ?? []).filter((f) => f.owners?.includes(label)).length;
  const losses = (props.analysis.findings ?? []).filter((f) => f.type === "POTENTIAL_LOSS" && f.units.includes(label)).length;
  const conflicts = (props.analysis.findings ?? []).filter((f) => f.type === "POTENTIAL_CONFLICT" && f.units.includes(label)).length;
  const doc = (props.analysis.documents ?? []).find((d) => d.side === u.side && d.clauses?.some((c) => c.clause_id === u.source_clause));
  return { u, label, status: row?.status, text: row?.text, reason: row?.change?.reason ?? "", fns, losses, conflicts, source: u.source_clause ? { side: u.side, clause_id: u.source_clause, doc_id: doc?.doc_id } : null };
});
const STATUS_RU = { kept: "Сохранено", reorganized: "Реорганизовано", created: "Создано", removed: "Упразднено" };
function pick(u) { current.value = u.unit_id; if (u.side === "after") emit("select", unitLabel(u)); }
</script>

<template>
  <div class="structure">
    <div class="head">
      <div>
        <h2>Изменения структуры</h2>
        <p class="sub">Как каждое подразделение действующей структуры перешло в новую. Нажмите на подразделение, чтобы увидеть основание.</p>
      </div>
    </div>
    <div class="legend">
      <span><i class="dot kept" />Сохранено</span>
      <span><i class="dot reorganized" />Реорганизовано (слияние / разделение)</span>
      <span><i class="dot created" />Создано</span>
      <span><i class="dot removed" />Упразднено</span>
    </div>
    <div class="layout" :class="{ withPanel: detail }">
      <div class="diagram">
        <div class="cols">
          <div class="col-head">Было · {{ model.before.length }} {{ model.before.length === 1 ? "подразделение" : model.before.length < 5 ? "подразделения" : "подразделений" }}</div>
          <div />
          <div class="col-head">Стало · {{ model.after.length }} {{ model.after.length === 1 ? "подразделение" : model.after.length < 5 ? "подразделения" : "подразделений" }}</div>
        </div>
        <div class="cols body" :style="{ height: `${model.height}px` }">
          <div class="column">
            <button v-for="r in model.before" :key="r.u.unit_id" type="button" class="unit" :class="[r.status, { active: current === r.u.unit_id, lit: isLit(r.u.unit_id) }]" :style="{ top: `${r.y}px` }" @click="pick(r.u)">
              <span class="name">{{ r.u.name }}</span>
              <span class="state"><i class="dot" :class="r.status" />{{ r.text }}</span>
            </button>
          </div>
          <svg class="links" :width="GAP_W" :height="model.height" :viewBox="`0 0 ${GAP_W} ${model.height}`">
            <path v-for="(l, i) in model.links" :key="i" :d="path(l)" fill="none" stroke-width="2.5" :class="[l.kind, { lit: current && l.ids.includes(current) }]" />
            <g v-for="(r, i) in model.removed" :key="'x' + i" class="gone">
              <path :d="`M0 ${r.y + CARD / 2} H 90`" stroke-width="2" />
              <path :d="`M96 ${r.y + CARD / 2 - 7} l 14 14 M110 ${r.y + CARD / 2 - 7} l -14 14`" stroke-width="2.5" />
              <text x="118" :y="r.y + CARD / 2 + 4">функции не найдены</text>
            </g>
          </svg>
          <div class="column">
            <button v-for="r in model.after" :key="r.u.unit_id" type="button" class="unit" :class="[r.status, { active: current === r.u.unit_id, lit: isLit(r.u.unit_id) }]" :style="{ top: `${r.y}px` }" @click="pick(r.u)">
              <span class="name">{{ r.u.name }}</span>
              <span class="state"><i class="dot" :class="r.status" />{{ r.text }}</span>
            </button>
          </div>
        </div>
      </div>

      <aside v-if="detail" class="panel side">
        <div class="eyebrow-s">Выбрано</div>
        <span class="tag" :class="detail.status">{{ STATUS_RU[detail.status] ?? detail.status }}</span>
        <h3>{{ detail.u.name }}<template v-if="detail.u.abbr"> <span class="abbr">· {{ detail.u.abbr }}</span></template></h3>
        <p v-if="detail.text" class="state-line">{{ detail.text }}</p>
        <div class="basis">
          <div class="label">Основание</div>
          <button v-if="detail.source" type="button" class="chip" @click="emit('open-clause', detail.source)">{{ detail.source.side === "before" ? "до" : "после" }} · п. {{ detail.source.clause_id }} <Icon name="external-link" class="icon-sm" /></button>
          <p v-if="detail.reason" class="reason">{{ detail.reason }}</p>
        </div>
        <div class="facts">
          <div><b>{{ detail.fns }}</b><span>{{ detail.fns === 1 ? "функция" : detail.fns < 5 ? "функции" : "функций" }} в редакции «{{ detail.u.side === "before" ? "до" : "после" }}»</span></div>
          <div v-if="detail.losses"><b class="loss">{{ detail.losses }}</b><span>возможные потери</span></div>
          <div v-if="detail.conflicts"><b class="conflict">{{ detail.conflicts }}</b><span>конфликт интересов</span></div>
        </div>
        <button v-if="detail.losses" type="button" class="link" @click="emit('show-losses')">Посмотреть потери функций →</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.structure { display: flex; flex-direction: column; gap: 16px; padding: 32px 0 40px; }
h2 { margin: 0; font-family: var(--font-display); font-size: 28px; line-height: 36px; font-weight: 700; color: var(--navy); }
.sub { margin: 6px 0 0; font-size: 14px; line-height: 22px; color: var(--text-2); max-width: 820px; }
.legend { display: flex; flex-wrap: wrap; gap: 22px; font-size: 13px; color: var(--text-2); }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
.dot.reorganized { background: var(--c-dup); }
.dot.created { background: var(--c-ok); }
.dot.removed { background: var(--c-loss); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
.layout.withPanel { grid-template-columns: minmax(0, 1fr) 340px; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 200px minmax(0, 1fr); }
.col-head { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); padding-bottom: 12px; }
.body { position: relative; }
.column { position: relative; }
.unit { position: absolute; left: 0; right: 0; height: 60px; overflow: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 0 16px; border: 1px solid var(--panel-line); border-radius: 10px; background: var(--white); font: inherit; text-align: left; cursor: pointer; color: var(--text); box-shadow: var(--sh-panel); }
.unit:hover { border-color: var(--accent-soft); }
.unit.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.unit.lit { border-color: var(--accent-soft); }
.unit .name { font-size: 14px; font-weight: 600; color: var(--navy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unit .state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unit.reorganized .state { color: var(--c-dup-text); }
.unit.created .state { color: var(--c-ok-text); }
.unit.removed .state { color: var(--c-loss-text); }
.links { display: block; }
.links path.kept { stroke: var(--flow-line); }
.links path.reorg { stroke: var(--c-dup); stroke-opacity: 0.75; }
.links path.lit { stroke: var(--accent); stroke-opacity: 1; stroke-width: 3; }
.gone path { stroke: var(--c-loss); fill: none; }
.gone text { font-size: 12px; fill: var(--c-loss-text); }
.panel { background: var(--white); border: 1px solid var(--panel-line); border-radius: 16px; box-shadow: var(--sh-panel); }
.side { position: sticky; top: 130px; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.tag { align-self: flex-start; display: inline-flex; height: 24px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--chip); color: var(--text-2); }
.tag.reorganized { background: var(--c-dup-bg); color: var(--c-dup-text); }
.tag.created { background: var(--c-ok-bg); color: var(--c-ok-text); }
.tag.removed { background: var(--c-loss-bg); color: var(--c-loss-text); }
h3 { margin: 0; font-family: var(--font-display); font-size: 20px; line-height: 28px; font-weight: 700; color: var(--navy); }
.abbr { color: var(--muted); font-weight: 400; }
.state-line { margin: 0; font-size: 13px; color: var(--text-2); }
.basis { display: flex; flex-direction: column; gap: 8px; }
.label { font-size: 13px; font-weight: 700; color: var(--navy); }
.chip { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--panel-line); border-radius: 6px; background: var(--panel-2); font: inherit; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--navy); cursor: pointer; }
.reason { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--c-dup-bg); font-family: var(--font-quote); font-size: 14px; line-height: 22px; color: var(--text); }
.facts { display: flex; flex-direction: column; gap: 8px; padding-top: 6px; border-top: 1px solid var(--panel-line); }
.facts div { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: var(--text-2); }
.facts b { font-family: var(--font-display); font-size: 20px; color: var(--navy); }
.facts b.loss { color: var(--c-loss-text); }
.facts b.conflict { color: var(--c-conflict); }
.link { align-self: flex-start; border: 0; background: transparent; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); cursor: pointer; }
@media (max-width: 900px) {
  .layout.withPanel { grid-template-columns: 1fr; }
  .cols { grid-template-columns: minmax(0, 1fr) 60px minmax(0, 1fr); }
  .links { width: 60px; }
  .gone text { display: none; }
}
</style>
