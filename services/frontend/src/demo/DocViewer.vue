<script setup>
import { computed, nextTick, ref, watch } from "vue";
import Icon from "../Icon.vue";
import { demo, paraFindingIndex, findingById, SEVERITY } from "./data.js";

const props = defineProps({
  finding: { type: Object, default: null }, // active finding (its citations get highlighted)
  initSide: { type: String, default: null }, // open on a specific document (steps 1–3 preview)
});
const emit = defineEmits(["open-finding", "back"]);

const tab = ref(props.initSide || "after"); // 'before' | 'after' | 'compare' | 'kb'
watch(() => props.initSide, (v) => { if (v) tab.value = v; });
const fontSize = ref(15);
const query = ref("");
const searchHits = ref([]);
const searchPos = ref(-1);
const outlineOpen = ref(false);
const flashId = ref(null);
const activeCit = ref(0);

const scroller = ref(null);
const scrollerB = ref(null); // compare mode, before pane
let syncing = false;

const internalCits = computed(() =>
  props.finding ? props.finding.citations.filter((c) => c.type === "internal") : [],
);
const kbCits = computed(() =>
  props.finding ? props.finding.citations.filter((c) => c.type === "kb") : [],
);
const missingCits = computed(() => internalCits.value.filter((c) => !c.anchor && c.note));

// para_id -> [{start,end,marker,active}] for a side
function highlightMap(side) {
  const map = {};
  internalCits.value.forEach((c, i) => {
    if (c.doc === side && c.anchor?.para_id) {
      (map[c.anchor.para_id] ||= []).push({ ...c.anchor, marker: i + 1, active: i === activeCit.value });
    }
  });
  return map;
}
const hlBefore = computed(() => highlightMap("before"));
const hlAfter = computed(() => highlightMap("after"));

function segments(p, side) {
  const hls = (side === "before" ? hlBefore.value : hlAfter.value)[p.id];
  if (!hls) return [{ t: p.text }];
  const sorted = [...hls].sort((a, b) => a.start - b.start);
  const out = [];
  let pos = 0;
  for (const h of sorted) {
    const s = Math.max(0, Math.min(h.start, p.text.length));
    const e = Math.max(s, Math.min(h.end, p.text.length));
    if (s > pos) out.push({ t: p.text.slice(pos, s) });
    out.push({ t: p.text.slice(s, e), mark: true, marker: h.marker, active: h.active });
    pos = e;
  }
  if (pos < p.text.length) out.push({ t: p.text.slice(pos) });
  return out;
}

function paras(side) {
  return demo.documents[side].paragraphs;
}
function marginFindings(side, pid) {
  return (paraFindingIndex[side][pid] || []).map((id) => findingById[id]);
}

function outline(side) {
  return paras(side)
    .filter((p) => (p.clause && /^п\.\d+$/.test(p.clause)) || (!p.clause && /^\d+\.\s*[А-ЯЁ]{2,}/.test(p.text)))
    .map((p) => ({ id: p.id, label: p.clause ? `${p.clause} ${p.text.slice(0, 60)}` : p.text.slice(0, 64) }));
}

function scrollToPara(pid, pane) {
  nextTick(() => {
    const root = pane === "before" && tab.value === "compare" ? scrollerB.value : scroller.value;
    const el = root?.querySelector(`[data-pid="${pid}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      flashId.value = pid;
      setTimeout(() => (flashId.value = null), 1600);
    }
  });
}

// Public: jump to a citation (called by parent via defineExpose)
function goToCitation(i) {
  const c = internalCits.value[i];
  if (!c) return;
  activeCit.value = i;
  if (c.anchor) {
    if (tab.value !== "compare") tab.value = c.doc;
    scrollToPara(c.anchor.para_id, c.doc);
  } else if (c.note) {
    tab.value = c.doc;
  }
}
function goToKb() {
  tab.value = "kb";
}
defineExpose({ goToCitation, goToKb });

watch(
  () => props.finding?.id,
  () => {
    activeCit.value = 0;
    query.value = "";
    searchHits.value = [];
    if (props.finding) {
      const first = internalCits.value.find((c) => c.anchor);
      if (first) {
        if (tab.value === "kb" || tab.value === "compare") tab.value = first.doc;
        goToCitation(internalCits.value.indexOf(first));
      } else if (kbCits.value.length) {
        tab.value = "kb";
      }
    }
  },
);

function runSearch() {
  const side = tab.value === "before" ? "before" : "after";
  const q = query.value.trim().toLowerCase();
  if (!q) { searchHits.value = []; searchPos.value = -1; return; }
  searchHits.value = paras(side).filter((p) => p.text.toLowerCase().includes(q)).map((p) => p.id);
  searchPos.value = searchHits.value.length ? 0 : -1;
  if (searchPos.value >= 0) scrollToPara(searchHits.value[0]);
}
function searchStep(d) {
  if (!searchHits.value.length) return;
  searchPos.value = (searchPos.value + d + searchHits.value.length) % searchHits.value.length;
  scrollToPara(searchHits.value[searchPos.value]);
}

function syncScroll(from) {
  if (syncing) return;
  syncing = true;
  const a = from === "after" ? scroller.value : scrollerB.value;
  const b = from === "after" ? scrollerB.value : scroller.value;
  if (a && b) {
    const f = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    b.scrollTop = f * (b.scrollHeight - b.clientHeight);
  }
  requestAnimationFrame(() => (syncing = false));
}

const citCount = computed(() => internalCits.value.length);
</script>

<template>
  <div class="viewer panel">
    <div class="v-head">
      <div class="tabs v-tabs">
        <a :class="{ active: tab === 'before' }" href="#" @click.prevent="tab = 'before'">ДО</a>
        <a :class="{ active: tab === 'after' }" href="#" @click.prevent="tab = 'after'">ПОСЛЕ</a>
        <a :class="{ active: tab === 'compare' }" href="#" @click.prevent="tab = 'compare'" title="ДО и ПОСЛЕ рядом">
          <Icon name="compare" class="icon-sm" />Сравнить
        </a>
        <a :class="{ active: tab === 'kb' }" href="#" @click.prevent="tab = 'kb'">База знаний</a>
      </div>
      <div class="row v-tools">
        <button class="btn btn-ghost btn-sm btn-icon" title="Уменьшить шрифт" aria-label="Уменьшить шрифт" @click="fontSize = Math.max(13, fontSize - 1)">А−</button>
        <button class="btn btn-ghost btn-sm btn-icon" title="Увеличить шрифт" aria-label="Увеличить шрифт" @click="fontSize = Math.min(20, fontSize + 1)">А+</button>
        <button class="btn btn-ghost btn-sm" :class="{ 'v-on': outlineOpen }" @click="outlineOpen = !outlineOpen"><Icon name="layers" class="icon-sm" />Оглавление</button>
      </div>
    </div>

    <div v-if="tab !== 'kb'" class="v-search row">
      <div class="input-icon v-q">
        <Icon name="search" class="icon-sm" />
        <input v-model="query" class="input" type="search" placeholder="Поиск по документу" @keydown.enter="runSearch" />
      </div>
      <template v-if="searchHits.length">
        <span class="muted small tnum">{{ searchPos + 1 }}/{{ searchHits.length }}</span>
        <button class="btn btn-ghost btn-sm btn-icon" aria-label="Предыдущее совпадение" @click="searchStep(-1)"><Icon name="chevron-left" class="icon-sm" /></button>
        <button class="btn btn-ghost btn-sm btn-icon" aria-label="Следующее совпадение" @click="searchStep(1)"><Icon name="chevron-right" class="icon-sm" /></button>
      </template>
      <template v-if="finding && citCount > 1">
        <span class="v-cit-nav row">
          <button class="btn btn-ghost btn-sm btn-icon" aria-label="Предыдущая цитата" @click="goToCitation((activeCit - 1 + citCount) % citCount)"><Icon name="chevron-left" class="icon-sm" /></button>
          <span class="small muted tnum">{{ activeCit + 1 }} из {{ citCount }}</span>
          <button class="btn btn-ghost btn-sm btn-icon" aria-label="Следующая цитата" @click="goToCitation((activeCit + 1) % citCount)"><Icon name="chevron-right" class="icon-sm" /></button>
        </span>
      </template>
      <button v-if="finding" class="btn btn-ghost btn-sm v-back" @click="emit('back')"><Icon name="undo" class="icon-sm" />К замечанию</button>
    </div>

    <div v-if="outlineOpen && tab !== 'kb'" class="v-outline">
      <button v-for="o in outline(tab === 'before' ? 'before' : 'after')" :key="o.id" class="v-outline-item" @click="scrollToPara(o.id); outlineOpen = false">
        {{ o.label }}
      </button>
    </div>

    <!-- Single-document view -->
    <div v-if="tab === 'before' || tab === 'after'" ref="scroller" class="v-body" :style="{ fontSize: fontSize + 'px' }">
      <div v-if="tab === 'after' && missingCits.length" class="v-missing">
        <div v-for="(m, i) in missingCits" :key="i" class="v-missing-card">
          <Icon name="search" class="icon-sm" />
          <span><b>{{ m.clause || "Пункт" }}:</b> {{ m.note }}</span>
        </div>
      </div>
      <p
        v-for="p in paras(tab)" :key="p.id" :data-pid="p.id"
        class="v-para" :class="{ flash: flashId === p.id, cited: (tab === 'before' ? hlBefore : hlAfter)[p.id] }"
      >
        <span class="v-margin">
          <button
            v-for="f in marginFindings(tab, p.id).slice(0, 3)" :key="f.id"
            class="v-dot" :class="'dot-' + f.severity" :title="`${SEVERITY[f.severity].label}: ${f.title}`"
            :aria-label="`Открыть замечание: ${f.title}`" @click="emit('open-finding', f.id)"
          />
        </span>
        <b v-if="p.clause" class="v-clause">{{ p.clause }}</b>
        <template v-for="(s, i) in segments(p, tab)" :key="i">
          <mark v-if="s.mark" :class="{ 'v-active': s.active }"><sup class="v-marker">{{ s.marker }}</sup>{{ s.t }}</mark>
          <template v-else>{{ s.t }}</template>
        </template>
      </p>
    </div>

    <!-- Compare view -->
    <div v-else-if="tab === 'compare'" class="v-compare">
      <div class="v-pane">
        <div class="v-pane-head">ДО · {{ demo.files.before.edition }}</div>
        <div ref="scrollerB" class="v-body" :style="{ fontSize: fontSize + 'px' }" @scroll="syncScroll('before')">
          <p v-for="p in paras('before')" :key="p.id" :data-pid="p.id" class="v-para" :class="{ flash: flashId === p.id, cited: hlBefore[p.id] }">
            <b v-if="p.clause" class="v-clause">{{ p.clause }}</b>
            <template v-for="(s, i) in segments(p, 'before')" :key="i">
              <mark v-if="s.mark" :class="{ 'v-active': s.active }"><sup class="v-marker">{{ s.marker }}</sup>{{ s.t }}</mark>
              <template v-else>{{ s.t }}</template>
            </template>
          </p>
        </div>
      </div>
      <div class="v-pane">
        <div class="v-pane-head">ПОСЛЕ · {{ demo.files.after.edition }}</div>
        <div ref="scroller" class="v-body" :style="{ fontSize: fontSize + 'px' }" @scroll="syncScroll('after')">
          <div v-if="missingCits.length" class="v-missing">
            <div v-for="(m, i) in missingCits" :key="i" class="v-missing-card">
              <Icon name="search" class="icon-sm" />
              <span><b>{{ m.clause || "Пункт" }}:</b> {{ m.note }}</span>
            </div>
          </div>
          <p v-for="p in paras('after')" :key="p.id" :data-pid="p.id" class="v-para" :class="{ flash: flashId === p.id, cited: hlAfter[p.id] }">
            <b v-if="p.clause" class="v-clause">{{ p.clause }}</b>
            <template v-for="(s, i) in segments(p, 'after')" :key="i">
              <mark v-if="s.mark" :class="{ 'v-active': s.active }"><sup class="v-marker">{{ s.marker }}</sup>{{ s.t }}</mark>
              <template v-else>{{ s.t }}</template>
            </template>
          </p>
        </div>
      </div>
    </div>

    <!-- Knowledge base view -->
    <div v-else class="v-body v-kb">
      <template v-if="kbCits.length">
        <div v-for="(c, i) in kbCits" :key="i" class="stack v-kb-item">
          <div class="row-between">
            <b class="small">{{ c.doc_title }}</b>
            <span class="badge badge-info">релевантность {{ Math.round(c.score * 100) }}%</span>
          </div>
          <div class="quote">
            <blockquote>{{ c.quote }}</blockquote>
            <footer>
              <span class="src-chip"><Icon name="book-open" class="icon-sm" />{{ c.collection }}<span v-if="c.clause !== '—'" class="clause">{{ c.clause }}</span></span>
              <span>ред. от {{ c.edition_date }}</span>
              <button class="btn btn-ghost btn-sm" disabled title="В демо-версии документ недоступен"><Icon name="external-link" class="icon-sm" />Открыть документ полностью</button>
            </footer>
          </div>
          <p v-if="c.demo_placeholder" class="muted small">Демо-заглушка: реальный фрагмент появится после подключения базы знаний.</p>
        </div>
      </template>
      <div v-else class="v-kb-empty">
        <div class="tile tile-lg tile-soft"><Icon name="book-open" /></div>
        <h3>Норма не найдена в базе знаний</h3>
        <p class="muted small">Агент не отвечает по памяти: если база знаний ничего не вернула, ссылок нет.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer { height: 100%; min-height: 0; }
.v-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); border-bottom: 1px solid var(--line); padding-right: var(--sp-2); }
.v-tabs { border-bottom: 0; padding: 0 var(--sp-3); flex-wrap: wrap; }
.v-tabs a { display: inline-flex; align-items: center; gap: 4px; padding: 10px 8px; font-size: 13px; }
.v-tools { gap: 2px; flex: none; }
.v-on { background: var(--kt-blue-100); }
.v-search { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--line); gap: var(--sp-1); flex-wrap: wrap; }
.v-q { flex: 1; min-width: 140px; }
.v-q .input { height: 32px; font-size: 13px; }
.v-cit-nav { gap: 2px; background: var(--kt-blue-50); border-radius: var(--r-pill); padding: 0 6px; }
.v-back { margin-left: auto; }
.v-outline { max-height: 200px; overflow: auto; border-bottom: 1px solid var(--line); background: var(--surface-muted); display: flex; flex-direction: column; }
.v-outline-item { text-align: left; background: none; border: 0; font: inherit; font-size: 13px; padding: 6px var(--sp-4); cursor: pointer; color: var(--ink-600); }
.v-outline-item:hover { background: var(--kt-blue-50); color: var(--kt-blue-600); }
.v-body { flex: 1; overflow-y: auto; padding: var(--sp-4) var(--sp-5) var(--sp-8) var(--sp-6); line-height: 1.65; }
.v-para { position: relative; margin: 0 0 10px; color: var(--ink-800); }
.v-para.cited { background: var(--surface-muted); border-radius: var(--r-sm); padding: 4px 6px; box-shadow: inset 2px 0 0 var(--kt-blue-500); }
.v-para.flash { animation: vflash 1.5s var(--ease); }
@keyframes vflash { 0%, 40% { background: var(--mark); } 100% { background: transparent; } }
.v-para.cited.flash { animation: none; background: var(--mark); }
.v-clause { color: var(--ink-900); margin-right: 6px; }
.v-margin { position: absolute; left: -18px; top: 4px; display: flex; flex-direction: column; gap: 3px; }
.v-dot { width: 10px; height: 10px; border-radius: 50%; border: 0; cursor: pointer; padding: 0; }
.dot-high { background: var(--fx-loss); }
.dot-medium { background: var(--fx-dup); }
.dot-low { background: var(--st-abolished); }
mark { background: var(--mark); border-radius: 3px; padding: 0 2px; outline: 1px solid color-mix(in srgb, var(--fx-dup) 45%, transparent); }
mark.v-active { outline: 2px solid var(--fx-dup); }
.v-marker { font-size: 10px; font-weight: 800; color: var(--kt-blue-700); margin-right: 2px; }
.v-missing { padding-bottom: var(--sp-3); }
.v-missing-card { display: flex; gap: var(--sp-2); align-items: flex-start; border: 2px dashed var(--line-strong); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); color: var(--ink-600); font-size: 13px; background: var(--surface-muted); }
.v-compare { display: grid; grid-template-columns: 1fr 1fr; flex: 1; min-height: 0; }
.v-pane { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); }
.v-pane:last-child { border-right: 0; }
.v-pane-head { padding: 6px var(--sp-4); font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-500); background: var(--surface-muted); border-bottom: 1px solid var(--line); }
.v-kb { display: flex; flex-direction: column; gap: var(--sp-5); }
.v-kb-item { border-bottom: 1px solid var(--line); padding-bottom: var(--sp-4); }
.v-kb-empty { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-10) var(--sp-4); }
</style>
