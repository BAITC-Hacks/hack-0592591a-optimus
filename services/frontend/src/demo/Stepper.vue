<script setup>
import Icon from "../Icon.vue";
import { state, goStep } from "./store.js";

const STEPS = [
  { n: 1, label: "Документы" },
  { n: 2, label: "Анализ" },
  { n: 3, label: "Проверка" },
  { n: 4, label: "Заключение" },
];
</script>

<template>
  <div class="stepbar">
    <div class="stepper">
      <template v-for="(s, i) in STEPS" :key="s.n">
        <span v-if="i" class="line" :class="{ done: state().step > s.n - 1 }" />
        <button
          class="s step-btn"
          :class="{ done: s.n < state().step, active: s.n === state().step, locked: s.n > state().maxStep }"
          :disabled="s.n > state().maxStep"
          @click="goStep(s.n)"
        >
          <span class="n">
            <Icon v-if="s.n < state().step" name="check" class="icon-sm" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span class="step-label">{{ s.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stepbar { padding: var(--sp-4) var(--sp-6); background: var(--surface); border-bottom: 1px solid var(--line); }
.stepper { max-width: 640px; margin: 0 auto; }
.step-btn { background: none; border: 0; font: inherit; cursor: pointer; padding: 4px 6px; border-radius: var(--r-sm); }
.step-btn:disabled { cursor: default; }
.step-btn.locked { opacity: 0.45; }
.step-btn:not(:disabled):hover { background: var(--kt-blue-50); }
</style>
