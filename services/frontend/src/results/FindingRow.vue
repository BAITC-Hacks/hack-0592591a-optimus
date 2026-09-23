<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { REVIEW_NOTE } from "../domain.js";
import { TYPE_COLOR, isPartialLoss, rowTitle, shortType } from "./text.js";

const props = defineProps({
  finding: { type: Object, required: true },
  documents: { type: Array, default: () => [] },
  index: { type: Number, default: 0 }, // 0 = no number
  open: { type: Boolean, default: false },
});
const emit = defineEmits(["open-clause"]);

const expanded = ref(props.open);
const color = computed(() => TYPE_COLOR[props.finding.type] ?? "info");
const sideRu = (side) => (side === "before" ? "до" : "после");
const fileOf = (docId) => props.documents.find((d) => d.doc_id === docId)?.filename ?? docId;

// «до · п. 5.6.2 → нет», «после · п. 5.4.3 ↔ п. 5.5.8», «до · п. 5.3.3 → после · п. 5.3.2»
const chips = computed(() => {
  const c = props.finding.citations;
  const first = { text: `${sideRu(c[0].side)} · п. ${c[0].clause_id}` };
  if (c.length === 1) return { first, arrow: "→", second: props.finding.type === "POTENTIAL_LOSS" ? { text: "нет", plain: true } : null };
  const sameSide = c[0].side === c[1].side;
  return { first, arrow: sameSide ? "↔" : "→", second: { text: sameSide ? `п. ${c[1].clause_id}` : `${sideRu(c[1].side)} · п. ${c[1].clause_id}` } };
});
const missing = computed(() => props.finding.type === "POTENTIAL_LOSS" && props.finding.citations.length === 1);
</script>

<template>
  <div class="frow" :class="[color, { expanded }]">
    <button type="button" class="head" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="num">{{ index || "" }}</span>
      <span class="type"><i class="dot" />{{ shortType(finding) }}</span>
      <span class="title">{{ rowTitle(finding) }}</span>
      <span class="units">{{ finding.units.join(" · ") || "—" }}</span>
      <span class="chips">
        <span class="chip">{{ chips.first.text }}</span>
        <template v-if="chips.second">
          <span class="arrow">{{ chips.arrow }}</span>
          <span class="chip" :class="{ plain: chips.second.plain }">{{ chips.second.text }}</span>
        </template>
      </span>
      <Icon :name="expanded ? 'chevron-up' : 'chevron-down'" class="icon-sm chev" />
    </button>

    <div v-if="expanded" class="detail">
      <div class="panels" :class="{ single: finding.citations.length === 1 && !missing }">
        <div v-for="c in finding.citations" :key="c.doc_id + c.clause_id" class="panel" :class="c.side">
          <div class="eyebrow-s">{{ sideRu(c.side) }} · {{ c.ref }}</div>
          <blockquote>«{{ c.quote }}»</blockquote>
          <div class="panel-foot">
            <span>{{ fileOf(c.doc_id) }}</span>
            <button type="button" class="link" @click="emit('open-clause', { doc_id: c.doc_id, clause_id: c.clause_id })">Открыть пункт</button>
          </div>
        </div>
        <div v-if="missing" class="panel dashed">
          <div class="eyebrow-s">после · эквивалент не найден</div>
          <p>{{ finding.explanation.replace(REVIEW_NOTE, "").trim() }}</p>
        </div>
      </div>
      <p v-if="!missing" class="explain">{{ finding.explanation.replace(REVIEW_NOTE, "").trim() }}</p>
      <p v-if="finding.review?.reason && finding.type === 'POTENTIAL_CONFLICT'" class="explain"><b>Оценка модели:</b> {{ finding.review.reason }}</p>
      <p v-if="isPartialLoss(finding)" class="explain muted-s">Найден только частичный эквивалент: часть обязанности могла быть утрачена.</p>
    </div>
  </div>
</template>

<style scoped>
.frow { border-bottom: 1px solid var(--panel-line); }
.frow:last-child { border-bottom: 0; }
.head {
  width: 100%; display: grid; grid-template-columns: 24px 128px minmax(0, 1fr) 120px 200px 16px; gap: 14px; align-items: center;
  padding: 15px 22px; background: transparent; border: 0; font: inherit; color: var(--text); text-align: left; cursor: pointer;
  transition: background var(--t-fast);
}
.frow:not(.expanded) .head:hover { background: var(--page); }
.expanded > .head { background: #F7F9FC; }
.num { font-family: var(--font-display); font-weight: 800; color: var(--navy); }
.num:empty::before { content: ""; }
.type { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; }
.loss .type { color: var(--c-loss-text); } .loss .dot { background: var(--c-loss); }
.conflict .type { color: var(--c-conflict-text); } .conflict .dot { background: var(--c-conflict); }
.dup .type { color: var(--c-dup-text); } .dup .dot { background: var(--c-dup); }
.info .type { color: var(--muted); } .info .dot { background: var(--accent-soft); }
.title { font-weight: 600; min-width: 0; line-height: 20px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.units { font-size: 13px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chips { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); white-space: nowrap; }
.chip { padding: 2px 8px; border-radius: 6px; background: var(--chip); font-weight: 600; color: var(--text-2); }
.chip.plain { background: transparent; padding: 0; }
.chev { color: var(--muted); }
.detail { padding: 18px 22px 22px 60px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--panel-line); }
.panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.panels.single { grid-template-columns: minmax(0, 1fr); }
.panel { padding: 16px 18px; border-radius: 12px; background: #F7F9FC; display: flex; flex-direction: column; gap: 8px; }
.panel.after { background: var(--panel); border: 1px solid var(--panel-line); }
.panel.dashed { background: transparent; border: 1px dashed #D5DBE6; }
.panel p { margin: 0; font-size: 14px; line-height: 22px; color: var(--text-2); }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
blockquote { margin: 0; font-family: var(--font-quote); font-size: 15px; line-height: 25px; color: var(--text); }
.panel-foot { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--muted); }
.link { border: 0; background: transparent; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: var(--accent); cursor: pointer; }
.explain { margin: 0; font-size: 13px; line-height: 20px; color: var(--text-2); }
.muted-s { color: var(--muted); }
@media (max-width: 900px) {
  .head { grid-template-columns: 24px minmax(0, 1fr) 16px; grid-template-areas: "n t c" "n h c" "n u u" "n p p"; row-gap: 6px; }
  .num { grid-area: n; } .type { grid-area: t; } .title { grid-area: h; } .units { grid-area: u; } .chips { grid-area: p; white-space: normal; } .chev { grid-area: c; }
  .detail { padding-left: 22px; }
  .panels { grid-template-columns: minmax(0, 1fr); }
}
</style>
