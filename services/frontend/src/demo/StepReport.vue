<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { demo, SEVERITY, fmtDate } from "./data.js";
import { state, session, isDone, tabFindings, generateReport } from "./store.js";

const emit = defineEmits(["open-finding"]);
const st = computed(() => state());
const rejectedOpen = ref(false);
const activeSection = ref("summary");

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
function jump(id) {
  activeSection.value = id;
  document.getElementById("rs-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function openCitation(f) {
  emit("open-finding", f.id);
}
function downloadPdf() {
  window.print();
}
</script>

<template>
  <section class="report">
    <div v-if="st.reportStale" class="alert alert-warning rp-stale no-print">
      <Icon name="alert-triangle" />
      <span><b>Отчёт устарел</b> — решения по замечаниям изменились после формирования.</span>
      <div class="alert-actions"><button class="btn btn-primary btn-sm" @click="generateReport()"><Icon name="rotate-cw" class="icon-sm" />Обновить</button></div>
    </div>

    <div class="rp-layout">
      <nav class="rp-toc no-print" aria-label="Содержание">
        <div class="label">Содержание</div>
        <button v-for="s in sections" :key="s.id" class="rp-toc-item" :class="{ active: activeSection === s.id }" @click="jump(s.id)">{{ s.title }}</button>
        <div class="rp-toc-actions">
          <button class="btn btn-cta btn-block" @click="downloadPdf"><Icon name="download" class="icon-sm" />Скачать PDF</button>
          <button class="btn btn-ghost btn-sm btn-block" disabled title="В демо-версии недоступно">XLSX · реестр замечаний</button>
          <button class="btn btn-ghost btn-sm btn-block" disabled title="В демо-версии недоступно">DOCX</button>
        </div>
      </nav>

      <div class="rp-page card" id="report-page">
        <header class="rp-head">
          <div class="eyebrow">Аналитическое заключение</div>
          <h1>{{ demo.report.title }}</h1>
          <p class="muted">{{ demo.report.subtitle }}</p>
          <p class="small muted">Проверил: {{ demo.report.reviewer }} · {{ fmtDate(new Date().toISOString()) }} · Сессия «{{ session()?.title }}»</p>
        </header>

        <div class="alert alert-advisory rp-advisory">
          <Icon name="info" />
          <span><b>Выводы носят рекомендательный характер.</b> Каждый вывод подтверждён фрагментом исходного документа и требует проверки ответственным сотрудником.</span>
        </div>

        <section v-for="s in sections" :key="s.id" :id="'rs-' + s.id" class="rp-section">
          <h2>{{ s.title }}</h2>

          <!-- Editable text sections -->
          <textarea
            v-if="s.text"
            class="textarea rp-edit"
            :value="textOf(s)"
            rows="4"
            @input="setText(s, $event.target.value)"
          />

          <!-- Findings-based sections -->
          <template v-else-if="TAB_SECTIONS[s.id]">
            <p v-if="!acceptedOf(TAB_SECTIONS[s.id]).length" class="muted small">Принятых замечаний в этом разделе нет.</p>
            <article v-for="f in acceptedOf(TAB_SECTIONS[s.id])" :key="f.id" class="rp-finding">
              <div class="row rp-f-head">
                <span class="badge" :class="{ 'badge-loss': f.severity === 'high', 'badge-dup': f.severity === 'medium', 'badge-kept': f.severity === 'low' }">
                  <Icon :name="SEVERITY[f.severity].icon" />{{ SEVERITY[f.severity].label }}
                </span>
                <b>{{ f.title }}</b>
              </div>
              <p class="small">{{ f.summary }}</p>
              <p class="small"><b>Рекомендация:</b> {{ st.findings[f.id].recommendation }}</p>
              <p v-if="st.findings[f.id].comment" class="small muted"><b>Комментарий проверяющего:</b> {{ st.findings[f.id].comment }}</p>
              <div class="rp-cits">
                <button v-for="(c, i) in f.citations" :key="i" class="src-chip" @click="openCitation(f)">
                  <Icon :name="c.type === 'internal' ? 'file-text' : 'book-open'" class="icon-sm" />
                  <template v-if="c.type === 'internal'">{{ c.doc === "before" ? "ДО" : "ПОСЛЕ" }} <span class="clause">{{ c.clause || "пункт не найден" }}</span></template>
                  <template v-else>{{ c.collection }} <span class="clause">{{ c.clause }}</span></template>
                </button>
              </div>
            </article>
          </template>

          <!-- Sources list -->
          <ul v-else-if="s.items" class="rp-sources">
            <li v-for="(it, i) in s.items" :key="i">{{ it }}</li>
          </ul>
        </section>

        <!-- Rejected appendix -->
        <section class="rp-section">
          <button class="rp-appendix-toggle no-print" @click="rejectedOpen = !rejectedOpen">
            <Icon :name="rejectedOpen ? 'chevron-down' : 'chevron-right'" class="icon-sm" />
            <h2>Приложение: отклонённые замечания ({{ rejected.length }})</h2>
          </button>
          <div v-if="rejectedOpen || false" class="stack">
            <div v-for="f in rejected" :key="f.id" class="rp-rejected small">
              <b>{{ f.title }}</b>
              <span class="muted"> — причина: {{ st.findings[f.id].reject_reason || "не указана" }}</span>
              <span v-if="st.findings[f.id].comment" class="muted"> · {{ st.findings[f.id].comment }}</span>
            </div>
            <p v-if="!rejected.length" class="muted small">Отклонённых замечаний нет.</p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.report { display: flex; flex-direction: column; gap: var(--sp-4); }
.rp-layout { display: grid; grid-template-columns: 240px 1fr; gap: var(--sp-5); align-items: start; }
.rp-toc { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3); }
.rp-toc .label { margin-bottom: var(--sp-1); }
.rp-toc-item { text-align: left; background: none; border: 0; font: inherit; font-size: 13px; color: var(--ink-600); padding: 6px 8px; border-radius: var(--r-sm); cursor: pointer; }
.rp-toc-item:hover { background: var(--kt-blue-50); color: var(--kt-blue-600); }
.rp-toc-item.active { background: var(--kt-blue-100); color: var(--kt-blue-700); font-weight: 700; }
.rp-toc-actions { margin-top: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); border-top: 1px solid var(--line); padding-top: var(--sp-3); }
.rp-page { max-width: 860px; padding: var(--sp-8); }
.rp-head h1 { font-size: 26px; line-height: 34px; margin: var(--sp-2) 0; }
.rp-advisory { margin: var(--sp-4) 0; }
.rp-section { margin-top: var(--sp-6); }
.rp-section h2 { font-size: 18px; line-height: 26px; margin-bottom: var(--sp-3); }
.rp-edit { font-size: 14px; line-height: 22px; }
.rp-finding { border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
.rp-f-head { flex-wrap: wrap; }
.rp-cits { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.rp-sources { margin: 0; padding-left: var(--sp-5); font-size: 14px; color: var(--ink-600); }
.rp-appendix-toggle { display: flex; align-items: center; gap: var(--sp-2); background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.rp-rejected { border-left: 3px solid var(--line-strong); padding-left: var(--sp-3); }

@media print {
  .no-print { display: none !important; }
  .rp-layout { grid-template-columns: 1fr; }
  .rp-page { box-shadow: none; padding: 0; max-width: none; }
  .rp-edit { border: 0; box-shadow: none; padding: 0; resize: none; }
}
</style>
