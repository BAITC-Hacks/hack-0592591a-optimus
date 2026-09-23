<script setup>
// «Рекомендации»: one card per critical finding, in the design's shape: what it
// fixes, the clauses, a proposed wording, «сейчас» → «предлагается», the rule it
// rests on, and the expert's decision (include in the conclusion / reject). The
// decisions live in sessionStorage per analysis; included ones go to the export.
import { computed, reactive, watch } from "vue";
import Icon from "../Icon.vue";
import { rowTitle, sortFindings } from "./text.js";

const props = defineProps({ analysis: { type: Object, required: true }, fromConclusion: { type: Array, default: () => [] } });
const emit = defineEmits(["open-clause", "change"]);

const LIMITS = { POTENTIAL_LOSS: 4, POTENTIAL_CONFLICT: 2, POTENTIAL_DUPLICATION: 3 };
const KIND = {
  POTENTIAL_LOSS: { tag: "Устраняет: потерю функции", cls: "loss", basis: "функция не должна теряться при реорганизации" },
  POTENTIAL_CONFLICT: { tag: "Устраняет: конфликт интересов", cls: "conflict", basis: "принцип разделения исполнения и контроля" },
  POTENTIAL_DUPLICATION: { tag: "Устраняет: дублирование", cls: "dup", basis: "одна функция — один владелец" },
};

const units = computed(() => props.analysis.units ?? []);
const label = (u) => (u ? u.abbr || u.name : "");
function successorsOf(unitLabel) {
  const u = units.value.find((x) => x.side === "before" && label(x) === unitLabel);
  if (!u) return [];
  const byId = new Map(units.value.map((x) => [x.unit_id, x]));
  const c = (props.analysis.unit_changes ?? []).find((x) => x.before === u.unit_id);
  if (!c) return [];
  return (c.successors?.length ? c.successors : c.after ? [c.after] : []).map((id) => label(byId.get(id))).filter(Boolean);
}
const chips = (f) => {
  const by = { before: [], after: [] };
  for (const c of f.citations) if (!by[c.side].includes(c.clause_id)) by[c.side].push(c.clause_id);
  return ["before", "after"].filter((s) => by[s].length).map((s) => ({ side: s, text: `${s === "before" ? "до" : "после"} · п. ${by[s].join(" · ")}`, target: f.citations.find((c) => c.side === s) }));
};

const cards = computed(() => {
  const sorted = sortFindings(props.analysis.findings ?? []);
  const taken = { POTENTIAL_LOSS: 0, POTENTIAL_CONFLICT: 0, POTENTIAL_DUPLICATION: 0 };
  const out = [];
  for (const f of sorted) {
    if (!(f.type in LIMITS) || taken[f.type] >= LIMITS[f.type]) continue;
    if (f.type === "POTENTIAL_LOSS" && f.severity !== "high") continue;
    taken[f.type]++;
    const fn = rowTitle(f);
    const fnLower = fn.charAt(0).toLowerCase() + fn.slice(1);
    const us = f.units ?? [];
    let card;
    if (f.type === "POTENTIAL_LOSS") {
      const succ = successorsOf(us[0]);
      card = {
        title: `Закрепить функцию «${fnLower}» в новой редакции`,
        now: `${us[0] ? `${us[0]}: ` : ""}закреплена в редакции «до», в новой редакции эквивалент не найден`,
        proposed: `Внести отдельный пункт: «${fnLower}». Ответственный — ${succ.length ? succ.join(" / ") : "подразделение-преемник"}`,
      };
    } else if (f.type === "POTENTIAL_CONFLICT") {
      card = {
        title: `Разделить исполнение и контроль${us[0] ? ` в ${us[0]}` : ""}`,
        now: `${us[0] ? `${us[0]}: ` : ""}проверки и контроль их качества в одном подразделении`,
        proposed: "Передать контроль качества независимому подразделению или руководителю более высокого уровня",
      };
    } else {
      card = {
        title: `Назначить единого владельца: ${fnLower}`,
        now: `${us.length > 1 ? `${us.join(" и ")} оба закрепляют функцию` : "функция закреплена за двумя пунктами"}`,
        proposed: `${us[0] ? `${us[0]}: ` : ""}исполнение${us[1] ? ` · ${us[1]}: постановка задач и использование результатов` : ", второму подразделению — использование результатов"}`,
      };
    }
    out.push({ id: f.finding_id, kind: KIND[f.type], chips: chips(f), ...card, finding: f });
  }
  return out;
});

// Decisions per analysis, kept per tab; a convenience, so storage failures are ignored.
const key = computed(() => `orgscope:recs:${props.analysis._id || props.analysis.analysis_id || ""}`);
const decisions = reactive({});
function load() {
  for (const k of Object.keys(decisions)) delete decisions[k];
  try { Object.assign(decisions, JSON.parse(sessionStorage.getItem(key.value) || "{}")); } catch {}
}
watch(key, load, { immediate: true });
function decide(id, value) {
  if (decisions[id] === value) delete decisions[id];
  else decisions[id] = value;
  try { sessionStorage.setItem(key.value, JSON.stringify(decisions)); } catch {}
}
const included = computed(() => cards.value.filter((c) => decisions[c.id] === "included").map((c) => c.title));
watch(included, (v) => emit("change", v), { immediate: true });
const counts = computed(() => ({ included: included.value.length, rejected: cards.value.filter((c) => decisions[c.id] === "rejected").length }));
</script>

<template>
  <div class="recs">
    <div v-if="!cards.length" class="panel empty">Существенных отклонений нет — предложений по перераспределению функций не требуется.</div>
    <div v-else class="grid">
      <article v-for="c in cards" :key="c.id" class="panel card" :class="[c.kind.cls, decisions[c.id]]">
        <div class="tags">
          <span class="tag" :class="c.kind.cls">{{ c.kind.tag }}</span>
          <button v-for="ch in c.chips" :key="ch.side" type="button" class="chip" @click="emit('open-clause', ch.target)">{{ ch.text }}</button>
        </div>
        <h3>{{ c.title }}</h3>
        <div class="flow">
          <div class="box now" :class="c.kind.cls"><div class="lbl">Сейчас</div><p>{{ c.now }}</p></div>
          <Icon name="arrow-right" class="arrow" />
          <div class="box next"><div class="lbl">Предлагается</div><p>{{ c.proposed }}</p></div>
        </div>
        <p class="basis">Основание: {{ c.kind.basis }}</p>
        <div class="actions">
          <button type="button" class="btn primary" :class="{ on: decisions[c.id] === 'included' }" @click="decide(c.id, 'included')"><Icon v-if="decisions[c.id] === 'included'" name="check-circle" class="icon-sm" />{{ decisions[c.id] === "included" ? "Включено в заключение" : "Включить в заключение" }}</button>
          <button type="button" class="btn ghost" :class="{ on: decisions[c.id] === 'rejected' }" @click="decide(c.id, 'rejected')">{{ decisions[c.id] === "rejected" ? "Отклонено · вернуть" : "Отклонить" }}</button>
        </div>
      </article>
    </div>
    <p class="status muted-s">Принято {{ counts.included }} · отклонено {{ counts.rejected }} · принятые предложения добавляются в раздел «Принятые рекомендации» заключения и в экспорт.</p>
    <div v-if="fromConclusion.length" class="panel from">
      <div class="from-head">Рекомендации модели из заключения</div>
      <ol><li v-for="(r, i) in fromConclusion" :key="i">{{ r }}</li></ol>
    </div>
  </div>
</template>

<style scoped>
.recs { display: flex; flex-direction: column; gap: 16px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.panel { background: var(--white); border: 1px solid var(--panel-line); border-radius: 16px; box-shadow: var(--sh-panel); }
.panel.empty { padding: 24px; color: var(--text-2); font-size: 14px; }
.card { display: flex; flex-direction: column; gap: 14px; padding: 22px 24px; }
.card.rejected { opacity: 0.55; }
.tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tag { display: inline-flex; height: 26px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.tag.loss { background: var(--c-loss-bg); color: var(--c-loss-text); }
.tag.conflict { background: var(--c-conflict-bg); color: var(--c-conflict); }
.tag.dup { background: var(--c-dup-bg); color: var(--c-dup-text); }
.chip { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border: 1px solid var(--panel-line); border-radius: 6px; background: var(--panel-2); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--navy); cursor: pointer; }
.chip:hover { border-color: var(--accent-soft); }
h3 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 700; color: var(--navy); }
.flow { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); gap: 12px; align-items: center; }
.box { padding: 14px 16px; border-radius: 10px; min-height: 84px; }
.box .lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; }
.box p { margin: 0; font-size: 13px; line-height: 20px; color: var(--text); }
.now.loss { background: var(--c-loss-bg); } .now.loss .lbl { color: var(--c-loss-text); }
.now.conflict { background: var(--c-conflict-bg); } .now.conflict .lbl { color: var(--c-conflict); }
.now.dup { background: var(--c-dup-bg); } .now.dup .lbl { color: var(--c-dup-text); }
.next { background: var(--chip-hover); } .next .lbl { color: var(--accent); }
.arrow { color: var(--muted); }
.basis { margin: 0; font-size: 13px; color: var(--text-2); }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn { height: 40px; padding: 0 18px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--white); font: inherit; font-size: 14px; font-weight: 600; color: var(--navy); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--white); }
.btn.primary.on { background: var(--c-ok); border-color: var(--c-ok); }
.btn.ghost.on { border-color: var(--c-loss); color: var(--c-loss-text); }
.status { margin: 0; font-size: 13px; color: var(--muted); }
.from { padding: 18px 22px; }
.from-head { font-size: 13px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
.from ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 22px; color: var(--text-2); }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .flow { grid-template-columns: 1fr; } .arrow { transform: rotate(90deg); justify-self: center; } }
</style>
