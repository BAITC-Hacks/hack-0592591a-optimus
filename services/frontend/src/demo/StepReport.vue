<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { demo, fmtDate } from "./data.js";
import { state, isDone, tabFindings, generateReport } from "./store.js";

const st = computed(() => state());
const rejectedOpen = ref(false);

const TAB_SECTIONS = { structure: "structure", functions: "functions", duplication: "duplication", coi: "coi", compliance: "compliance", benchmark: "benchmark", recommendations: "recommendations" };

const sections = computed(() => demo.report.sections);
const acceptedOf = (tab) => tabFindings(tab).filter((f) => ["accepted", "accepted_edited"].includes(st.value.findings[f.id].status));
const rejected = computed(() => demo.findings.filter((f) => st.value.findings[f.id].status === "rejected"));

function textOf(s) {
  return st.value.reportEdits[s.id] ?? s.text ?? "";
}
function setText(s, v) {
  st.value.reportEdits[s.id] = v;
}
function citText(c) {
  if (c.type === "internal") return `${c.doc === "before" ? "ДО" : "ПОСЛЕ"} · ${c.clause || "пункт не найден"}`;
  return `${c.collection}${c.clause && c.clause !== "—" ? " · " + c.clause : ""}`;
}
function print() {
  window.print();
}
</script>

<template>
  <section class="report">
    <div v-if="st.reportStale" class="alert alert-warning no-print">
      <Icon name="alert-triangle" />
      <span>Решения изменились после формирования заключения.</span>
      <div class="alert-actions"><button class="btn btn-primary btn-sm" @click="generateReport()">Обновить</button></div>
    </div>

    <div class="rp-bar no-print">
      <button class="btn btn-primary" @click="print"><Icon name="printer" class="icon-sm" />Скачать PDF</button>
    </div>

    <div class="rp-page card" id="report-page">
      <header class="rp-head">
        <h1>{{ demo.report.title }}</h1>
        <p class="muted">{{ demo.report.subtitle }}</p>
        <p class="small muted">{{ demo.report.reviewer }} · {{ fmtDate(new Date().toISOString()) }}</p>
      </header>

      <p class="small muted rp-advisory">Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.</p>

      <section v-for="s in sections" :key="s.id" class="rp-section">
        <h2>{{ s.title }}</h2>

        <textarea
          v-if="s.text"
          class="textarea rp-edit"
          :value="textOf(s)"
          rows="4"
          @input="setText(s, $event.target.value)"
        />

        <template v-else-if="TAB_SECTIONS[s.id]">
          <p v-if="!acceptedOf(TAB_SECTIONS[s.id]).length" class="muted small">Принятых замечаний нет.</p>
          <article v-for="f in acceptedOf(TAB_SECTIONS[s.id])" :key="f.id" class="rp-finding">
            <div class="rp-f-head">
              <span class="rp-dot" :class="'dot-' + f.severity" />
              <b>{{ f.title }}</b>
            </div>
            <p class="small">{{ f.summary }}</p>
            <p class="small"><b>Рекомендация:</b> {{ st.findings[f.id].recommendation }}</p>
            <p v-if="st.findings[f.id].comment" class="small muted"><b>Комментарий:</b> {{ st.findings[f.id].comment }}</p>
            <p class="small muted rp-cits">{{ f.citations.map(citText).join(" · ") }}</p>
          </article>
        </template>

        <ul v-else-if="s.items" class="rp-sources">
          <li v-for="(it, i) in s.items" :key="i">{{ it }}</li>
        </ul>
      </section>

      <section class="rp-section">
        <button class="rp-appendix-toggle no-print" @click="rejectedOpen = !rejectedOpen">
          <Icon :name="rejectedOpen ? 'chevron-down' : 'chevron-right'" class="icon-sm" />
          <h2>Отклонённые замечания ({{ rejected.length }})</h2>
        </button>
        <div v-if="rejectedOpen" class="stack">
          <p v-for="f in rejected" :key="f.id" class="rp-rejected small">
            <b>{{ f.title }}</b>
            <span class="muted"> — {{ st.findings[f.id].reject_reason || "причина не указана" }}</span>
            <span v-if="st.findings[f.id].comment" class="muted"> · {{ st.findings[f.id].comment }}</span>
          </p>
          <p v-if="!rejected.length" class="muted small">Отклонённых замечаний нет.</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.report { display: flex; flex-direction: column; gap: var(--sp-3); max-width: 820px; margin: 0 auto; }
.rp-bar { display: flex; justify-content: flex-end; }
.rp-page { padding: var(--sp-8); }
.rp-head h1 { font-size: 24px; line-height: 32px; margin: 0 0 var(--sp-2); }
.rp-advisory { margin: var(--sp-3) 0; padding-top: var(--sp-3); border-top: 1px solid var(--line); }
.rp-section { margin-top: var(--sp-5); }
.rp-section h2 { font-size: 17px; line-height: 24px; margin-bottom: var(--sp-2); }
.rp-edit { font-size: 14px; line-height: 22px; width: 100%; }
.rp-finding { border-top: 1px solid var(--line); padding: var(--sp-3) 0; display: flex; flex-direction: column; gap: 6px; }
.rp-finding p { margin: 0; }
.rp-f-head { display: flex; align-items: center; gap: var(--sp-2); }
.rp-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.dot-high { background: var(--fx-loss); }
.dot-medium { background: var(--fx-dup); }
.dot-low { background: var(--line-strong); }
.rp-sources { margin: 0; padding-left: var(--sp-5); font-size: 14px; color: var(--ink-600); }
.rp-appendix-toggle { display: flex; align-items: center; gap: var(--sp-2); background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.rp-rejected { border-left: 3px solid var(--line-strong); padding-left: var(--sp-3); margin: 0; }

@media print {
  .no-print { display: none !important; }
  .rp-page { box-shadow: none; border: 0; padding: 0; }
  .rp-edit { border: 0; box-shadow: none; padding: 0; resize: none; }
}
</style>
