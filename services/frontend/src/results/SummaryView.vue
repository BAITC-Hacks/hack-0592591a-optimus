<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import DistributionBar from "./DistributionBar.vue";
import FindingRow from "./FindingRow.vue";
import UnitFlow from "./UnitFlow.vue";
import { distribution, headline, isPrimary, lead, recommendations, sortFindings } from "./text.js";

const props = defineProps({ analysis: { type: Object, required: true } });
const emit = defineEmits(["open-clause", "show-units", "show-conclusion", "show-matches", "show-losses", "show-dups", "download"]);

const LIMIT = 7;
const showAllPrimary = ref(false);
const showSecondary = ref(false);

const sorted = computed(() => sortFindings(props.analysis.findings ?? []));
const primary = computed(() => sorted.value.filter(isPrimary));
const secondary = computed(() => sorted.value.filter((f) => !isPrimary(f)));
const visible = computed(() => (showAllPrimary.value ? primary.value : primary.value.slice(0, LIMIT)));
const dist = computed(() => distribution(props.analysis.matches ?? []));
const title = computed(() => headline(props.analysis));
const summary = computed(() => lead(props.analysis));
const recs = computed(() => recommendations(props.analysis.conclusion_md));
const finished = computed(() => {
  const at = props.analysis.finished_at ? new Date(props.analysis.finished_at) : null;
  return at ? at.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
});
const unitById = computed(() => new Map((props.analysis.units ?? []).map((u) => [u.unit_id, u])));
const uname = (id) => { const u = unitById.value.get(id); return u ? u.abbr || u.name : ""; };
const structureCards = computed(() => {
  const changes = props.analysis.unit_changes ?? [];
  const by = (status) => changes.filter((c) => c.status === status);
  const reorg = by("reorganized");
  const reorgAfter = new Set(reorg.flatMap((c) => (c.successors?.length ? c.successors : c.after ? [c.after] : [])));
  return [
    { key: "kept", label: "Сохранено", cls: "kept", value: String(by("kept").length), names: by("kept").map((c) => uname(c.after)).filter(Boolean) },
    { key: "reorganized", label: "Реорганизовано", cls: "reorg", value: reorg.length ? `${reorg.length} → ${reorgAfter.size || reorg.length}` : "0", names: reorg.map((c) => `${uname(c.before)} → ${(c.successors?.length ? c.successors : [c.after]).map(uname).filter(Boolean).join(" + ") || "?"}`) },
    { key: "created", label: "Создано", cls: "created", value: String(by("created").length), names: by("created").map((c) => uname(c.after)).filter(Boolean) },
    { key: "removed", label: "Упразднено", cls: "removed", value: String(by("removed").length), names: by("removed").map((c) => uname(c.before)).filter(Boolean) },
  ];
});
const riskCards = computed(() => {
  const f = props.analysis.findings ?? [];
  const n = (type) => f.filter((x) => x.type === type).length;
  const partial = f.filter((x) => x.type === "POTENTIAL_LOSS" && x.severity !== "high").length;
  return [
    { key: "loss", label: "Потеря функций", note: `${n("POTENTIAL_LOSS") - partial} не найдены · ${partial} частично`, value: n("POTENTIAL_LOSS"), cls: "loss", icon: "alert-octagon" },
    { key: "dup", label: "Дублирование", note: "одна функция — два владельца", value: n("POTENTIAL_DUPLICATION"), cls: "dup", icon: "file-text" },
    { key: "conflict", label: "Конфликт интересов", note: "исполнение и контроль вместе", value: n("POTENTIAL_CONFLICT"), cls: "conflict", icon: "minus-circle" },
  ];
});
const counts = computed(() => {
  const c = { MOVED: 0, OVERLAP: 0, NOTE: 0 };
  for (const f of secondary.value) c[f.type] = (c[f.type] || 0) + 1;
  return c;
});
</script>

<template>
  <div class="summary">
    <section class="verdict">
      <div class="verdict-text">
        <div class="status"><i class="dot" />Анализ завершён<template v-if="finished"> · {{ finished }}</template></div>
        <h1>{{ title }}</h1>
        <p class="lead">{{ summary }}</p>
      </div>
      <div class="verdict-dist">
        <div class="dist-head">
          <span>{{ dist.total }} функций редакции «до»</span>
          <button type="button" class="link" @click="emit('show-matches')">Все сопоставления</button>
        </div>
        <DistributionBar :d="dist" />
      </div>
    </section>

    <section class="cards">
      <div class="eyebrow-s">1 · Изменения структуры</div>
      <div class="grid4">
        <button v-for="c in structureCards" :key="c.key" type="button" class="panel card" @click="emit('show-units')">
          <span class="tag" :class="c.cls">{{ c.label }}</span>
          <span class="num">{{ c.value }}</span>
          <span class="names">{{ c.names.length ? c.names.join(", ") : "—" }}</span>
        </button>
      </div>
      <div class="eyebrow-s">2–3 · Выявленные риски</div>
      <div class="grid3">
        <button v-for="r in riskCards" :key="r.key" type="button" class="panel risk" @click="emit(r.key === 'loss' ? 'show-losses' : 'show-dups')">
          <span class="risk-icon" :class="r.cls"><Icon :name="r.icon" /></span>
          <span class="risk-text"><b>{{ r.label }}</b><span>{{ r.note }}</span></span>
          <span class="risk-num">{{ r.value }}</span>
        </button>
      </div>
    </section>

    <section class="body">
      <div class="main">
        <div class="sec-head">
          <h2>Ключевые выводы</h2>
          <span class="muted-s">{{ Math.min(visible.length, primary.length) }} из {{ (analysis.findings ?? []).length }} · высокая и средняя важность</span>
        </div>
        <div v-if="!primary.length" class="panel empty">
          <div class="eyebrow-s">Существенных отклонений не найдено</div>
          <p>Все функции редакции «до» нашли эквивалент, признаков дублирования и конфликта нет.</p>
        </div>
        <div v-else class="panel list">
          <FindingRow v-for="(f, i) in visible" :key="f.finding_id" :finding="f" :documents="analysis.documents" :index="i + 1" :open="i === 0" @open-clause="emit('open-clause', $event)" />
        </div>
        <div class="more">
          <button v-if="primary.length > LIMIT" type="button" class="link" @click="showAllPrimary = !showAllPrimary">
            {{ showAllPrimary ? "Свернуть до семи" : `Показать ещё ${primary.length - LIMIT} важных выводов` }}
          </button>
          <span v-if="primary.length > LIMIT && secondary.length" class="sep" />
          <button v-if="secondary.length" type="button" class="link" @click="showSecondary = !showSecondary">
            {{ showSecondary ? "Скрыть выводы низкой важности" : `Показать ${secondary.length} выводов низкой важности` }}
          </button>
          <span class="muted-s">перераспределено {{ counts.MOVED }} · пересечения общей и частной нормы {{ counts.OVERLAP }} · примечания {{ counts.NOTE }}</span>
        </div>
        <div v-if="showSecondary" class="panel list">
          <FindingRow v-for="f in secondary" :key="f.finding_id" :finding="f" :documents="analysis.documents" @open-clause="emit('open-clause', $event)" />
        </div>
      </div>

      <aside class="side">
        <div class="panel units">
          <div class="sec-head"><h2 class="h-sm">Подразделения</h2><button type="button" class="link" @click="emit('show-units')">Подробно</button></div>
          <UnitFlow :units="analysis.units" :changes="analysis.unit_changes" :findings="analysis.findings" @select="emit('show-units', $event)" />
          <div class="legend">
            <span><i class="sw" style="background: var(--c-ok)" />создано</span>
            <span><i class="ln" />реорганизовано</span>
            <span><i class="sw" style="background: var(--c-loss)" />возможная потеря</span>
            <span><i class="sw" style="background: var(--c-conflict)" />конфликт</span>
          </div>
        </div>

        <div class="panel navy">
          <div class="sec-head"><h2 class="h-sm">Рекомендации</h2><button type="button" class="link light" @click="emit('show-conclusion')">Заключение целиком</button></div>
          <ol v-if="recs.length"><li v-for="(r, i) in recs" :key="i">{{ r }}</li></ol>
          <p v-else class="light-p">Рекомендации приведены в заключении.</p>
          <button type="button" class="btn-white" @click="emit('download')"><Icon name="download" class="icon-sm" />Скачать заключение</button>
        </div>

        <p class="disclaimer">Выводы носят рекомендательный характер: каждый подтверждён цитатой из документа и требует проверки ответственным сотрудником.</p>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.summary { display: flex; flex-direction: column; }
.verdict { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 48px; align-items: end; padding: 40px 0 32px; border-bottom: 1px solid var(--panel-line); }
.verdict-text { display: flex; flex-direction: column; gap: 14px; }
.status { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.status .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-ok); }
h1 { margin: 0; font-family: var(--font-display); font-size: 40px; line-height: 48px; font-weight: 800; letter-spacing: -0.02em; color: var(--navy); max-width: 760px; }
.verdict .lead { margin: 0; max-width: 700px; font-size: 16px; line-height: 26px; color: var(--text-2); }
.verdict-dist { display: flex; flex-direction: column; gap: 12px; }
.dist-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--muted); }
.cards { display: flex; flex-direction: column; gap: 12px; padding-top: 28px; }
.cards .eyebrow-s { margin-top: 12px; }
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.card { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px 22px; font: inherit; color: var(--text); text-align: left; cursor: pointer; }
.card:hover, .risk:hover { border-color: var(--accent-soft); }
.tag { display: inline-flex; height: 24px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--chip); color: var(--text-2); }
.tag.reorg { background: var(--c-dup-bg); color: var(--c-dup-text); }
.tag.created { background: var(--c-ok-bg); color: var(--c-ok-text); }
.tag.removed { background: var(--c-loss-bg); color: var(--c-loss-text); }
.num { font-family: var(--font-display); font-size: 36px; line-height: 40px; font-weight: 600; color: var(--navy); }
.names { font-size: 13px; line-height: 19px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.risk { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 16px; padding: 18px 22px; font: inherit; color: var(--text); text-align: left; cursor: pointer; }
.risk-icon { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; }
.risk-icon.loss { background: var(--c-loss-bg); color: var(--c-loss-text); }
.risk-icon.dup { background: var(--c-dup-bg); color: var(--c-dup-text); }
.risk-icon.conflict { background: var(--c-conflict-bg); color: var(--c-conflict); }
.risk-text { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--muted); }
.risk-text b { font-size: 15px; color: var(--navy); }
.risk-num { font-family: var(--font-display); font-size: 32px; font-weight: 600; color: var(--navy); }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 32px; align-items: start; padding: 32px 0 40px; }
.main, .side { display: flex; flex-direction: column; gap: 12px; }
.side { gap: 20px; }
.sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-family: var(--font-display); font-size: 20px; line-height: 28px; font-weight: 800; color: var(--navy); }
h2.h-sm { font-size: 17px; line-height: 24px; }
.panel { background: var(--panel); border: 1px solid var(--panel-line); border-radius: 16px; box-shadow: var(--sh-panel); }
.panel.list { overflow: hidden; }
.panel.empty { padding: 28px 24px; display: flex; flex-direction: column; gap: 6px; }
.panel.empty p { margin: 0; color: var(--text-2); }
.panel.units { padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 14px; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.ln { width: 14px; height: 2px; background: var(--c-reorg); display: inline-block; }
.panel.navy { background: var(--navy); border-color: var(--navy); color: var(--white); padding: 22px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 32px rgba(14, 31, 69, 0.18); }
.panel.navy h2 { color: var(--white); }
.panel.navy ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 21px; color: rgba(255, 255, 255, 0.86); }
.light-p { margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 14px; }
.btn-white { align-self: flex-start; margin-top: 4px; height: 38px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--white); color: var(--navy); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.link { border: 0; background: transparent; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); cursor: pointer; }
.link.light { color: var(--accent-soft); }
.more { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding: 2px 6px; font-size: 13px; color: var(--muted); }
.sep { width: 4px; height: 4px; border-radius: 50%; background: var(--flow-line); }
.muted-s { font-size: 13px; color: var(--muted); }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.disclaimer { margin: 0; padding: 0 4px; font-size: 12px; line-height: 18px; color: var(--muted); }
@media (max-width: 1000px) {
  .verdict, .body { grid-template-columns: minmax(0, 1fr); }
  h1 { font-size: 30px; line-height: 38px; }
}
</style>
