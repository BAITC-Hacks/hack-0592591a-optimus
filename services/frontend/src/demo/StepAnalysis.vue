<script setup>
import { computed } from "vue";
import Icon from "../Icon.vue";
import { demo } from "./data.js";
import { state, analysisPct, goStep } from "./store.js";

const st = computed(() => state());
const pct = computed(() => analysisPct(st.value));
const remaining = computed(() => {
  const total = demo.analysis_stages.length;
  const left = Math.max(0, total - (st.value.analysis.stage + 1));
  return left <= 0 ? "меньше минуты" : `≈ ${Math.max(1, Math.round(left * 0.4))} мин`;
});

function stageState(i) {
  const a = st.value.analysis;
  if (a.finished || i < a.stage) return "done";
  if (i === a.stage && a.running) return "running";
  return "pending";
}
</script>

<template>
  <section class="an-step">
    <div class="card">
      <div class="card-header plain">
        <h3 v-if="!st.analysis.finished">Идёт анализ документов</h3>
        <h3 v-else>Анализ завершён</h3>
        <span v-if="!st.analysis.finished" class="muted small">Осталось {{ remaining }}</span>
      </div>

      <div class="progress an-progress"><i :style="{ width: pct + '%' }" /></div>
      <p class="muted small tnum an-pct">{{ pct }}%</p>

      <ol class="an-stages">
        <li v-for="(s, i) in demo.analysis_stages" :key="s.id" class="an-stage" :class="stageState(i)">
          <span class="tile tile-sm" :class="{ 'tile-done': stageState(i) === 'done', 'tile-pending': stageState(i) === 'pending' }">
            <Icon v-if="stageState(i) === 'done'" name="check" class="icon-sm" />
            <span v-else-if="stageState(i) === 'running'" class="spinner an-spin" />
            <Icon v-else name="clock" class="icon-sm" />
          </span>
          <div class="an-stage-body">
            <b>{{ s.label }}</b>
            <span v-if="stageState(i) === 'done'" class="muted small">{{ s.result }}</span>
            <span v-else-if="stageState(i) === 'running'" class="muted small">выполняется…</span>
          </div>
        </li>
      </ol>

      <div class="an-counters row">
        <span class="badge badge-info tnum">Подразделений: {{ st.analysis.counters.units }}</span>
        <span class="badge badge-info tnum">Функций: {{ st.analysis.counters.functions }}</span>
        <span class="badge badge-dup tnum">Замечаний: {{ st.analysis.counters.findings }}</span>
      </div>

      <div v-if="!st.analysis.finished" class="alert alert-advisory an-note">
        <Icon name="info" />
        <span>Можно уйти с этого экрана — анализ продолжится, прогресс виден в списке сессий слева.</span>
      </div>
      <div v-else class="row an-done-row">
        <button class="btn btn-cta btn-lg" @click="goStep(5)">Перейти к проверке<Icon name="arrow-right" class="icon-sm" /></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.an-step { max-width: 680px; margin: 0 auto; }
.an-progress { margin-top: var(--sp-2); }
.an-pct { margin-top: var(--sp-1); }
.an-stages { list-style: none; margin: var(--sp-5) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.an-stage { display: flex; gap: var(--sp-3); align-items: flex-start; }
.an-stage.pending { opacity: 0.55; }
.an-stage-body { display: flex; flex-direction: column; gap: 1px; font-size: 14px; }
.an-spin { border-color: rgba(255, 255, 255, 0.4); border-top-color: #fff; width: 16px; height: 16px; }
.an-counters { margin-top: var(--sp-5); flex-wrap: wrap; }
.an-note { margin-top: var(--sp-4); }
.an-done-row { margin-top: var(--sp-5); justify-content: center; }
</style>
