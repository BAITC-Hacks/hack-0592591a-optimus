<script setup>
import { computed } from "vue";
import Icon from "../Icon.vue";
import { STAGES } from "../domain.js";

const props = defineProps({
  stage: { type: String, default: "queued" },
  status: { type: String, default: "running" },
  elapsed: { type: Number, default: 0 },
});

const index = computed(() => STAGES.findIndex((s) => s.key === props.stage));
const percent = computed(() => (props.status === "done" ? 100 : Math.max(4, Math.round(((index.value + 0.5) / STAGES.length) * 100))));
const stateOf = (i) => (props.status === "done" || i < index.value ? "done" : i === index.value ? "running" : "pending");
const current = computed(() => STAGES[index.value]);
const minutes = computed(() => `${Math.floor(props.elapsed / 60)}:${String(props.elapsed % 60).padStart(2, "0")}`);
</script>

<template>
  <section class="card progress-card" aria-live="polite">
    <div class="row-between">
      <div>
        <div class="eyebrow">Анализ выполняется</div>
        <h2>{{ current ? current.hint : "Ставим задачу в очередь" }}…</h2>
      </div>
      <span class="badge badge-info tnum">{{ minutes }}</span>
    </div>
    <div class="progress"><i :style="{ width: percent + '%' }" /></div>
    <ol class="steps">
      <li v-for="(step, i) in STAGES" :key="step.key" class="step" :class="stateOf(i)">
        <span class="tile tile-sm" :class="{ 'tile-done': stateOf(i) === 'done', 'tile-pending': stateOf(i) === 'pending', pulse: stateOf(i) === 'running' }">
          <Icon v-if="stateOf(i) === 'done'" name="check" />
          <span v-else-if="stateOf(i) === 'running'" class="spinner" />
          <Icon v-else name="chevron-right" />
        </span>
        <div>
          <b>{{ step.label }}</b>
          <span class="small muted">{{ step.hint }}</span>
        </div>
      </li>
    </ol>
    <p class="muted small">Обычно анализ пары положений занимает 2–4 минуты: модель размечает каждый раздел, а код сопоставляет функции и проверяет цитаты.</p>
  </section>
</template>

<style scoped>
.progress-card { display: grid; gap: var(--sp-5); }
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-4); }
.step { display: flex; gap: var(--sp-3); align-items: flex-start; color: var(--ink-500); }
.step b { display: block; color: var(--ink-900); }
.step.pending b { color: var(--ink-500); }
.step .small { display: block; }
.spinner { border-color: rgba(255, 255, 255, 0.35); border-top-color: #fff; }
@media (max-width: 900px) { .steps { grid-template-columns: 1fr; } }
</style>
