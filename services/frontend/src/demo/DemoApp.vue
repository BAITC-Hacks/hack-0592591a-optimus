<script setup>
import { computed, nextTick, ref, watch } from "vue";
import BrandMark from "../BrandMark.vue";
import Icon from "../Icon.vue";
import Stepper from "./Stepper.vue";
import StepDocs from "./StepDocs.vue";
import StepAnalysis from "./StepAnalysis.vue";
import StepReview from "./StepReview.vue";
import StepReport from "./StepReport.vue";
import DocViewer from "./DocViewer.vue";
import { store, state, reset } from "./store.js";

const st = computed(() => state());
const dv = ref(null);

// When the document modal opens for a citation, jump to it after mount.
watch(
  () => store.doc,
  async (d) => {
    if (!d) return;
    await nextTick();
    if (d.kb) dv.value?.goToKb();
    else if (d.cit != null) dv.value?.goToCitation(d.cit);
  },
);

function restart() {
  if (window.confirm("Начать заново? Загруженные документы и решения будут сброшены.")) reset();
}
</script>

<template>
  <header class="app-header no-print">
    <div class="shell-header">
      <BrandMark />
      <div class="header-spacer" />
      <div class="header-actions">
        <span class="muted small" title="Интерфейс работает на демонстрационных данных, API анализа не вызывается">демо-данные</span>
        <a class="btn btn-ghost btn-sm" href="./" title="Версия с реальным анализом">Рабочая версия</a>
        <span class="divider-v" />
        <button class="btn btn-ghost btn-sm" @click="restart"><Icon name="rotate-cw" class="icon-sm" />Начать заново</button>
      </div>
    </div>
  </header>

  <main class="shell-main">
    <Stepper class="no-print" />
    <div class="shell-content">
      <StepDocs v-if="st.step === 1" />
      <StepAnalysis v-else-if="st.step === 2" />
      <StepReview v-else-if="st.step === 3" />
      <StepReport v-else />
    </div>
  </main>

  <!-- Document modal -->
  <div v-if="store.doc" class="modal-back" @click.self="store.doc = null">
    <div class="doc-modal" role="dialog" aria-modal="true" aria-label="Документ">
      <button class="btn btn-ghost btn-sm btn-icon doc-close" aria-label="Закрыть" @click="store.doc = null"><Icon name="x" class="icon-sm" /></button>
      <DocViewer ref="dv" :finding="store.doc.finding || null" :init-side="store.doc.side || null" class="doc-viewer" />
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
.header-actions { display: flex; align-items: center; gap: var(--sp-3); }
.shell-main { min-height: calc(100vh - var(--header-h)); display: flex; flex-direction: column; }
.shell-content { flex: 1; padding: var(--sp-6); min-height: 0; }
.modal-back { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink-900) 40%, transparent); display: grid; place-items: center; z-index: 60; padding: var(--sp-5); }
.doc-modal { position: relative; width: min(960px, 96vw); height: min(86vh, 900px); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--sh-3); display: flex; flex-direction: column; overflow: hidden; }
.doc-close { position: absolute; top: 8px; right: 8px; z-index: 2; }
.doc-viewer { flex: 1; min-height: 0; border-radius: 0; box-shadow: none; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink-900); color: #fff; border-radius: var(--r-md); padding: 10px var(--sp-4); display: flex; align-items: center; gap: var(--sp-4); font-size: 14px; box-shadow: var(--sh-3); z-index: 80; }
@media print {
  .no-print { display: none !important; }
  .shell-main, .shell-content { display: block; padding: 0; min-height: 0; }
}
</style>
