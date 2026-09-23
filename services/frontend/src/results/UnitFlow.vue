<script setup>
import { computed } from "vue";

const props = defineProps({
  units: { type: Array, required: true },
  changes: { type: Array, required: true },
  findings: { type: Array, default: () => [] },
});
const emit = defineEmits(["select"]);

const ROW = 36;
const H = 28;
const label = (u) => (u.abbr ? u.abbr : u.name.length > 16 ? `${u.name.slice(0, 15)}…` : u.name);

const model = computed(() => {
  const before = props.units.filter((u) => u.side === "before");
  const after = props.units.filter((u) => u.side === "after");
  const byId = new Map(props.units.map((u) => [u.unit_id, u]));
  // Order «после» first by change status: created, then kept; «до» keeps document order with reorganized/removed last.
  const status = new Map();
  for (const c of props.changes) {
    if (c.after) status.set(c.after, c.status);
    if (c.before) status.set(c.before, c.status);
  }
  const rank = { created: 0, kept: 1, reorganized: 2, removed: 3 };
  const afterSorted = [...after].sort((a, b) => (rank[status.get(a.unit_id)] ?? 1) - (rank[status.get(b.unit_id)] ?? 1));
  const beforeSorted = [...before].sort((a, b) => (rank[status.get(a.unit_id)] ?? 1) - (rank[status.get(b.unit_id)] ?? 1));
  const yOf = (list) => new Map(list.map((u, i) => [u.unit_id, 26 + i * ROW]));
  const yb = yOf(beforeSorted);
  const ya = yOf(afterSorted);
  const links = [];
  for (const c of props.changes) {
    if (c.status === "kept") links.push({ from: yb.get(c.before), to: ya.get(c.after), kind: "kept" });
    if (c.status === "reorganized") for (const s of c.successors) links.push({ from: yb.get(c.before), to: ya.get(s), kind: "reorg" });
  }
  const marks = (u) => {
    const l = label(u);
    const mine = props.findings.filter((f) => f.units.includes(u.abbr || u.name) || f.units.includes(l));
    return {
      loss: mine.some((f) => f.type === "POTENTIAL_LOSS"),
      conflict: mine.some((f) => f.type === "POTENTIAL_CONFLICT"),
    };
  };
  const rows = Math.max(beforeSorted.length, afterSorted.length);
  return {
    height: 26 + rows * ROW + 6,
    before: beforeSorted.map((u) => ({ u, y: yb.get(u.unit_id), status: status.get(u.unit_id) })),
    after: afterSorted.map((u) => ({ u, y: ya.get(u.unit_id), status: status.get(u.unit_id), ...marks(u) })),
    links: links.filter((l) => l.from !== undefined && l.to !== undefined),
  };
});
const path = (l) => `M112 ${l.from + H / 2} C 168 ${l.from + H / 2}, 168 ${l.to + H / 2}, 224 ${l.to + H / 2}`;
</script>

<template>
  <svg class="flow" :viewBox="`0 0 336 ${model.height}`" :aria-label="'Подразделения до и после реорганизации'">
    <text x="0" y="12" class="col">ДО</text>
    <text x="336" y="12" class="col" text-anchor="end">ПОСЛЕ</text>
    <path v-for="(l, i) in model.links" :key="i" :d="path(l)" fill="none" stroke-width="2" :stroke="l.kind === 'reorg' ? 'var(--c-reorg)' : '#C7CEDB'" :stroke-opacity="l.kind === 'reorg' ? 0.6 : 1" />
    <g v-for="r in model.before" :key="r.u.unit_id" class="node" :class="r.status">
      <rect x="0" :y="r.y" width="112" :height="H" rx="8" />
      <text x="10" :y="r.y + 18">{{ label(r.u) }}</text>
    </g>
    <g v-for="r in model.after" :key="r.u.unit_id" class="node clickable" :class="r.status" @click="emit('select', r.u.abbr || r.u.name)">
      <rect x="224" :y="r.y" width="112" :height="H" rx="8" />
      <text x="234" :y="r.y + 18">{{ label(r.u) }}</text>
      <text v-if="r.status === 'created'" x="330" :y="r.y + 18" class="new" text-anchor="end">нов.</text>
      <circle v-if="r.loss" :cx="r.conflict ? 314 : 326" :cy="r.y + H / 2" r="4" fill="var(--c-loss)" />
      <circle v-if="r.conflict" cx="326" :cy="r.y + H / 2" r="4" fill="var(--c-conflict)" />
    </g>
  </svg>
</template>

<style scoped>
.flow { width: 100%; height: auto; font-family: var(--font-sans); }
.col { font-size: 11px; font-weight: 700; fill: var(--muted); letter-spacing: 1.2px; }
.node rect { fill: var(--chip); }
.node text { font-size: 12px; font-weight: 600; fill: var(--text-2); }
.node.created rect { fill: #E3F5EC; }
.node.created text { fill: var(--c-ok-text); font-weight: 700; }
.node.reorganized rect, .node.removed rect { fill: #E6F3F6; }
.node.reorganized text, .node.removed text { fill: var(--c-reorg-text); }
.node .new { font-size: 10px; fill: var(--c-ok); }
.clickable { cursor: pointer; }
.clickable:hover rect { fill: #DDE7F8; }
</style>
