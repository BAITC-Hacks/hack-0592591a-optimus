<script setup>
import { computed, onMounted, ref } from "vue";
import BrandMark from "../BrandMark.vue";
import HealthStatus from "../HealthStatus.vue";
import Icon from "../Icon.vue";
import Sidebar from "./Sidebar.vue";
import Stepper from "./Stepper.vue";
import StepUpload from "./StepUpload.vue";
import StepConfirm from "./StepConfirm.vue";
import StepAnalysis from "./StepAnalysis.vue";
import StepReview from "./StepReview.vue";
import StepReport from "./StepReport.vue";
import DocViewer from "./DocViewer.vue";
import KbModal from "./KbModal.vue";
import { store, state, newSession, goStep } from "./store.js";

const health = ref({ state: "checking", text: "проверка…" });
const previewSide = ref(null); // 'before' | 'after' — document drawer on steps 1–3
const introStep = ref(store.introSeen ? -1 : 0);

const st = computed(() => state());

const INTRO = [
  { icon: "upload", title: "Загрузите два документа", text: "«ДО» и «ПОСЛЕ» реорганизации — Word, PDF или Excel. Агент сам разберёт структуру и функции." },
  { icon: "file-search", title: "Проверьте замечания", text: "Каждое замечание показывает источник: документ, пункт и точную цитату. Примите, отклоните или отложите для обсуждения." },
  { icon: "clipboard", title: "Получите заключение", text: "Из принятых замечаний соберётся отчёт с рекомендациями. Его можно править и скачать в PDF." },
];

function closeIntro() {
  introStep.value = -1;
  store.introSeen = true;
  localStorage.setItem("orgscope-intro-seen", "1");
}

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    health.value = res.ok
      ? { state: "ok", text: `${data.status}, БД: ${data.db}` }
      : { state: "down", text: `ошибка ${res.status}` };
  } catch {
    health.value = { state: "down", text: "недоступен" };
  }
}
onMounted(loadHealth);

function openFindingFromReport(id) {
  goStep(5);
  // StepReview picks the finding up through its own openFinding on next tick
  requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("orgscope:open-finding", { detail: id })));
}
</script>

<template>
  <header class="app-header no-print">
    <div class="shell-header">
      <BrandMark />
      <div class="header-spacer" />
      <div class="header-actions">
        <span class="badge badge-info" title="Концепт интерфейса: работает целиком на демонстрационных данных, API анализа не вызывается">демо-данные</span>
        <a class="btn btn-ghost btn-sm" href="./" title="Открыть рабочую версию с реальным анализом"><Icon name="arrow-right" class="icon-sm" />Рабочая версия</a>
        <HealthStatus :health="health" />
        <span class="divider-v" />
        <button class="btn btn-primary" @click="newSession()"><Icon name="plus" class="icon-sm" />Новый анализ</button>
      </div>
    </div>
  </header>

  <div class="shell no-print-flex">
    <Sidebar class="no-print" />
    <main class="shell-main">
      <Stepper class="no-print" />
      <div class="shell-content" v-if="st">
        <StepUpload v-if="st.step === 1" side="before" @view="previewSide = $event || 'before'" />
        <StepUpload v-else-if="st.step === 2" side="after" @view="previewSide = $event || 'after'" />
        <StepConfirm v-else-if="st.step === 3" @view="previewSide = $event" />
        <StepAnalysis v-else-if="st.step === 4" />
        <StepReview v-else-if="st.step === 5" />
        <StepReport v-else @open-finding="openFindingFromReport" />
      </div>
    </main>
  </div>

  <!-- Document preview drawer (steps 1–3) -->
  <div v-if="previewSide" class="drawer-back" @click.self="previewSide = null">
    <div class="drawer" role="dialog" aria-modal="true" aria-label="Просмотр документа">
      <div class="row-between drawer-head">
        <b>{{ previewSide === "before" ? "Документ ДО" : "Документ ПОСЛЕ" }}</b>
        <button class="btn btn-ghost btn-sm btn-icon" aria-label="Закрыть" @click="previewSide = null"><Icon name="x" class="icon-sm" /></button>
      </div>
      <DocViewer :init-side="previewSide" class="drawer-viewer" />
    </div>
  </div>

  <KbModal v-if="store.kbOpen" />

  <!-- Intro (3 screens, skippable) -->
  <div v-if="introStep >= 0" class="modal-back">
    <div class="card intro-card" role="dialog" aria-modal="true">
      <div class="tile tile-lg"><Icon :name="INTRO[introStep].icon" /></div>
      <h2>{{ INTRO[introStep].title }}</h2>
      <p class="muted">{{ INTRO[introStep].text }}</p>
      <div class="row intro-dots"><i v-for="(s, i) in INTRO" :key="i" :class="{ on: i === introStep }" /></div>
      <div class="row intro-actions">
        <button class="btn btn-ghost" @click="closeIntro">Пропустить</button>
        <button v-if="introStep < INTRO.length - 1" class="btn btn-primary" @click="introStep++">Далее<Icon name="arrow-right" class="icon-sm" /></button>
        <button v-else class="btn btn-cta" @click="closeIntro">Начать работу</button>
      </div>
    </div>
  </div>

  <!-- Undo toast -->
  <div v-if="store.toast" class="toast no-print" role="status">
    <span>{{ store.toast.text }}</span>
    <button v-if="store.toast.undo" class="btn btn-white btn-sm" @click="store.toast.undo()"><Icon name="undo" class="icon-sm" />Отменить</button>
  </div>
</template>

<style scoped>
.shell-header { height: 100%; display: flex; align-items: center; gap: var(--sp-6); padding: 0 var(--sp-6); }
.header-spacer { flex: 1; }
.shell { display: flex; min-height: calc(100vh - var(--header-h)); align-items: stretch; }
.shell-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.shell-content { flex: 1; padding: var(--sp-6); min-height: 0; }
.drawer-back { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink-900) 35%, transparent); z-index: 50; display: flex; justify-content: flex-end; }
.drawer { width: min(680px, 92vw); background: var(--surface); box-shadow: var(--sh-3); display: flex; flex-direction: column; }
.drawer-head { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--line); }
.drawer-viewer { flex: 1; min-height: 0; border-radius: 0; box-shadow: none; }
.modal-back { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink-900) 45%, transparent); display: grid; place-items: center; z-index: 70; }
.intro-card { width: min(440px, 92vw); display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-4); padding: var(--sp-8); }
.intro-dots { gap: 6px; }
.intro-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--kt-blue-100); }
.intro-dots i.on { background: var(--kt-blue-600); }
.intro-actions { gap: var(--sp-3); }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink-900); color: #fff; border-radius: var(--r-md); padding: 10px var(--sp-4); display: flex; align-items: center; gap: var(--sp-4); font-size: 14px; box-shadow: var(--sh-3); z-index: 80; }
@media print {
  .no-print, .no-print-flex > .no-print { display: none !important; }
  .shell, .shell-main, .shell-content { display: block; padding: 0; min-height: 0; }
}
</style>
