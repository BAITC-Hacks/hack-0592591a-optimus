<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { TAB_LABELS } from "./data.js";
import { state, isDone, tabFindings, tabPendingCount, reviewStats, generateReport, REVIEW_TABS } from "./store.js";
import FindingCard from "./FindingCard.vue";

const st = computed(() => state());
const tab = ref(REVIEW_TABS[0]);

const stats = computed(() => reviewStats());
const tabs = computed(() =>
  REVIEW_TABS.map((t) => ({ id: t, label: TAB_LABELS[t], pending: tabPendingCount(t), total: tabFindings(t).length })),
);
const list = computed(() => {
  const l = tabFindings(tab.value);
  // pending first, original order preserved inside the groups
  return [...l.filter((f) => !isDone(st.value.findings[f.id])), ...l.filter((f) => isDone(st.value.findings[f.id]))];
});
</script>

<template>
  <section class="rv">
    <div class="rv-top">
      <div class="rv-progress">
        <span class="small muted tnum">Проверено {{ stats.done }} из {{ stats.total }}</span>
        <div class="progress"><i :style="{ width: (stats.done / stats.total) * 100 + '%' }" /></div>
      </div>
      <button class="btn" :class="stats.allDone ? 'btn-cta' : 'btn-outline'" :disabled="!stats.allDone" :title="stats.allDone ? '' : 'Сначала проверьте все замечания'" @click="generateReport()">
        Сформировать заключение
      </button>
    </div>
    <p class="muted small rv-note">Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.</p>

    <div class="rv-tabs" role="tablist">
      <button
        v-for="t in tabs" :key="t.id" class="rv-tab" role="tab"
        :class="{ active: tab === t.id }" :aria-selected="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
        <span v-if="t.pending" class="rv-count tnum">{{ t.pending }}</span>
        <Icon v-else name="check" class="icon-sm rv-done-ic" />
      </button>
    </div>

    <div class="rv-list">
      <FindingCard v-for="f in list" :key="f.id" :finding="f" />
      <p v-if="!list.length" class="muted rv-empty">В этой категории замечаний нет.</p>
    </div>
  </section>
</template>

<style scoped>
.rv { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-3); }
.rv-top { display: flex; align-items: center; gap: var(--sp-5); }
.rv-progress { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.rv-note { margin: 0; }
.rv-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.rv-tab { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; border-bottom: 2px solid transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-500); padding: 8px 10px; cursor: pointer; white-space: nowrap; }
.rv-tab.active { color: var(--kt-blue-600); border-bottom-color: var(--kt-blue-600); }
.rv-count { color: var(--ink-500); font-weight: 600; }
.rv-tab.active .rv-count { color: var(--kt-blue-600); }
.rv-done-ic { color: var(--fx-ok); }
.rv-list { display: flex; flex-direction: column; gap: var(--sp-3); padding-bottom: var(--sp-8); }
.rv-empty { text-align: center; padding: var(--sp-8); }
</style>
