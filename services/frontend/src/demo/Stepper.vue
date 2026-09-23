<script setup>
import Icon from "../Icon.vue";
import { state, goStep } from "./store.js";

const STEPS = [
  { n: 1, label: "Документ ДО" },
  { n: 2, label: "Документ ПОСЛЕ" },
  { n: 3, label: "Запуск анализа" },
  { n: 4, label: "Анализ" },
  { n: 5, label: "Проверка результатов" },
  { n: 6, label: "Заключение" },
];

const HINTS = {
  1: "Шаг 1 из 6. Загрузите документ до реорганизации",
  2: "Шаг 2 из 6. Загрузите документ после реорганизации",
  3: "Шаг 3 из 6. Проверьте файлы и источники, затем запустите анализ",
  4: "Шаг 4 из 6. Идёт анализ — можно перейти к другим сессиям",
  5: "Шаг 5 из 6. Проверьте каждое замечание: примите или отклоните",
  6: "Шаг 6 из 6. Заключение готово — проверьте и скачайте",
};

function lockTitle(s) {
  const st = state();
  if (s.n <= st.maxStep) return null;
  if (s.n === 3) return "Сначала загрузите оба документа";
  if (s.n <= 5) return "Сначала запустите анализ";
  return "Сначала проверьте все замечания";
}
</script>

<template>
  <div class="stepbar" v-if="state()">
    <div class="stepper">
      <template v-for="(s, i) in STEPS" :key="s.n">
        <span v-if="i" class="line" :class="{ done: state().step > s.n - 1 }" />
        <button
          class="s step-btn"
          :class="{ done: s.n < state().step, active: s.n === state().step, locked: s.n > state().maxStep }"
          :disabled="s.n > state().maxStep"
          :title="lockTitle(s) || s.label"
          @click="goStep(s.n)"
        >
          <span class="n">
            <Icon v-if="s.n < state().step" name="check" class="icon-sm" />
            <Icon v-else-if="s.n > state().maxStep" name="lock" class="icon-sm" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span class="step-label">{{ s.label }}</span>
        </button>
      </template>
    </div>
    <p class="muted small hint">{{ HINTS[state().step] }}</p>
  </div>
</template>

<style scoped>
.stepbar { padding: var(--sp-4) var(--sp-6) var(--sp-3); background: var(--surface); border-bottom: 1px solid var(--line); }
.step-btn { background: none; border: 0; font: inherit; cursor: pointer; padding: 4px 6px; border-radius: var(--r-sm); }
.step-btn:disabled { cursor: not-allowed; }
.step-btn.locked { opacity: 0.55; }
.step-btn:not(:disabled):hover { background: var(--kt-blue-50); }
.hint { margin-top: var(--sp-2); }
@media (max-width: 1400px) { .step-label { font-size: 12px; } }
</style>
