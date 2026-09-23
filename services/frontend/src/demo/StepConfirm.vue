<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { demo } from "./data.js";
import { state, startAnalysis, goStep } from "./store.js";

const emit = defineEmits(["view"]);
const st = computed(() => state());

// Knowledge-base collections (demo placeholders until the RAG backend exists)
const collections = ref([
  { id: "law", name: "Законодательство РК", docs: 12, updated: "10.09.2026", checked: true },
  { id: "iia", name: "Стандарты внутреннего аудита (IIA)", docs: 4, updated: "02.08.2026", checked: true },
  { id: "reg", name: "Требования регулятора", docs: 6, updated: "28.08.2026", checked: true },
]);
const operators = ref(demo.benchmark_table.operators.map((name) => ({ name, on: true })));
const jurisdiction = ref("kz");
const extraDoc = ref(null);
const extraInput = ref(null);

function addExtra(e) {
  const f = e.target.files?.[0];
  if (f) extraDoc.value = f.name;
  e.target.value = "";
}
</script>

<template>
  <section class="confirm-step">
    <div class="card">
      <div class="card-header plain"><h3>Что будет проанализировано</h3><span class="badge badge-info"><Icon name="clock" />≈ 5 мин</span></div>
      <div class="stack">
        <div v-for="side in ['before', 'after']" :key="side" class="cf-file">
          <span class="badge" :class="side === 'before' ? 'badge-outline' : 'badge-created'">{{ side === "before" ? "ДО" : "ПОСЛЕ" }}</span>
          <div class="cf-name">
            <b>{{ st.files[side].name }}</b>
            <span class="muted small">{{ st.files[side].edition }} · {{ st.files[side].approved }}</span>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon" title="Просмотреть документ" aria-label="Просмотреть документ" @click="emit('view', side)"><Icon name="eye" class="icon-sm" /></button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header plain">
        <h3>Источники для сверки (база знаний)</h3>
      </div>
      <p class="muted small cf-hint">Проверки соответствия и бенчмарка выполняются по базе знаний — загружать документы для них не нужно.</p>

      <div class="cf-block">
        <div class="row-between">
          <b>Нормативная база</b>
          <label class="row cf-switch"><input type="checkbox" class="switch" v-model="st.checks.compliance" /> <span class="small">Проверка включена</span></label>
        </div>
        <div class="stack cf-list" :class="{ off: !st.checks.compliance }">
          <label v-for="c in collections" :key="c.id" class="check">
            <input type="checkbox" v-model="c.checked" :disabled="!st.checks.compliance" />
            <span>{{ c.name }} <span class="muted small">· {{ c.docs }} док. · обновлено {{ c.updated }}</span></span>
          </label>
          <div class="field">
            <label class="label" for="jur">Юрисдикция</label>
            <select id="jur" v-model="jurisdiction" class="select cf-jur" :disabled="!st.checks.compliance">
              <option value="kz">Казахстан</option>
              <option value="eaeu">ЕАЭС</option>
              <option value="intl">Международные стандарты</option>
            </select>
          </div>
        </div>
      </div>

      <div class="cf-block">
        <div class="row-between">
          <b>Операторы для бенчмарка</b>
          <label class="row cf-switch"><input type="checkbox" class="switch" v-model="st.checks.benchmark" /> <span class="small">Проверка включена</span></label>
        </div>
        <div class="chips cf-list" :class="{ off: !st.checks.benchmark }">
          <button
            v-for="o in operators" :key="o.name" class="chip" :class="{ active: o.on }"
            :disabled="!st.checks.benchmark" @click="o.on = !o.on"
          >
            {{ o.name }} <Icon v-if="o.on" name="x" class="icon-sm" />
          </button>
        </div>
      </div>

      <div class="cf-block">
        <button class="btn btn-ghost btn-sm" @click="extraInput.click()"><Icon name="plus" class="icon-sm" />Добавить свой документ</button>
        <span v-if="extraDoc" class="badge badge-outline">{{ extraDoc }} — только для этой сессии</span>
        <input ref="extraInput" type="file" hidden @change="addExtra" />
      </div>
      <p v-if="!st.checks.compliance || !st.checks.benchmark" class="alert alert-warning cf-warn">
        <Icon name="alert-triangle" />
        <span>Выключенная проверка отключит соответствующую вкладку в результатах. Её можно будет включить и перезапустить позже.</span>
      </p>
    </div>

    <div class="row cf-actions">
      <button class="btn btn-outline" @click="goStep(2)"><Icon name="chevron-left" class="icon-sm" />Назад</button>
      <button class="btn btn-cta btn-lg" @click="startAnalysis()"><Icon name="play" class="icon-sm" />Начать анализ</button>
    </div>
  </section>
</template>

<style scoped>
.confirm-step { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-5); }
.cf-file { display: flex; align-items: center; gap: var(--sp-3); }
.cf-name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cf-name b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cf-hint { margin-bottom: var(--sp-4); }
.cf-block { padding: var(--sp-4) 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: var(--sp-3); }
.cf-list.off { opacity: 0.45; }
.cf-jur { max-width: 280px; }
.cf-switch { gap: var(--sp-2); }
.cf-warn { margin-top: var(--sp-2); }
.cf-actions { justify-content: space-between; }
</style>
