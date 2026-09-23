<script setup>
import { computed } from "vue";
import Icon from "../Icon.vue";
import { demo } from "./data.js";
import { state, analysisPct, goStep } from "./store.js";

const st = computed(() => state());
const pct = computed(() => analysisPct(st.value));

function stageState(i) {
  const a = st.value.analysis;
  if (a.finished || i < a.stage) return "done";
  if (i === a.stage && a.running) return "running";
  return "pending";
}
</script>

<template>
  <section class="an">
    <div class="card">
      <h3>{{ st.analysis.finished ? "Анализ завершён" : "Идёт анализ" }}</h3>
      <div class="progress an-progress"><i :style="{ width: pct + '%' }" /></div>

      <ol class="an-stages">
        <li v-for="(s, i) in demo.analysis_stages" :key="s.id" class="an-stage" :class="stageState(i)">
          <Icon v-if="stageState(i) === 'done'" name="check" class="icon-sm an-ic done" />
          <span v-else-if="stageState(i) === 'running'" class="spinner an-spin" />
          <span v-else class="an-ic pending" />
          <span>{{ s.label }}</span>
          <span v-if="stageState(i) === 'done'" class="muted small an-result">{{ s.result }}</span>
        </li>
      </ol>

      <div v-if="st.analysis.finished" class="an-done">
        <button class="btn btn-cta" @click="goStep(3)">Перейти к проверке<Icon name="arrow-right" class="icon-sm" /></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.an { max-width: 560px; margin: 0 auto; }
.an h3 { margin: 0; }
.an-progress { margin-top: var(--sp-3); }
.an-stages { list-style: none; margin: var(--sp-5) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.an-stage { display: flex; gap: var(--sp-3); align-items: baseline; font-size: 14px; }
.an-stage.pending { color: var(--ink-500); }
.an-ic { width: 16px; height: 16px; flex: none; align-self: center; }
.an-ic.done { color: var(--fx-ok); }
.an-ic.pending { border: 2px solid var(--line-strong); border-radius: 50%; width: 12px; height: 12px; margin: 0 2px; }
.an-spin { width: 14px; height: 14px; flex: none; align-self: center; border-color: var(--kt-blue-100); border-top-color: var(--kt-blue-600); }
.an-result { margin-left: auto; text-align: right; }
.an-done { margin-top: var(--sp-5); text-align: center; }
</style>
