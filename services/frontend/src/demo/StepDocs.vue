<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { state, simulateUpload, removeFile, startAnalysis, openDoc } from "./store.js";

const st = computed(() => state());
const over = ref({ before: false, after: false });
const inputs = {}; // side -> input element

const SIDES = [
  { id: "before", label: "До реорганизации" },
  { id: "after", label: "После реорганизации" },
];

const ready = computed(() => st.value.files.before && st.value.files.after);

function onDrop(side, e) {
  over.value[side] = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) simulateUpload(side, f.name);
}
function onPick(side, e) {
  const f = e.target.files?.[0];
  if (f) simulateUpload(side, f.name);
  e.target.value = "";
}
function retry(side) {
  st.value.upload[side] = { phase: "empty", pct: 0, error: null };
}
</script>

<template>
  <section class="docs">
    <h2>Загрузите две редакции документа</h2>
    <p class="muted">Word, PDF или Excel. Демо: содержимое файла не читается, используется встроенный пример.</p>

    <div class="docs-grid">
      <div v-for="s in SIDES" :key="s.id" class="docs-col">
        <div class="label">{{ s.label }}</div>

        <!-- Loaded file -->
        <div v-if="st.files[s.id]" class="filecard">
          <Icon name="file-text" />
          <div class="filebody">
            <div class="filename">{{ st.files[s.id].name }}</div>
            <div class="muted small">{{ st.files[s.id].edition }} · {{ st.files[s.id].size_kb }} КБ</div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="openDoc({ side: s.id })">Открыть</button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Удалить" aria-label="Удалить" @click="removeFile(s.id); retry(s.id)"><Icon name="trash" class="icon-sm" /></button>
        </div>

        <!-- Dropzone -->
        <div
          v-else
          class="dropzone dz"
          :class="{ 'is-over': over[s.id] }"
          @dragover.prevent="over[s.id] = true"
          @dragleave="over[s.id] = false"
          @drop.prevent="onDrop(s.id, $event)"
        >
          <template v-if="st.upload[s.id].phase === 'uploading'">
            <div class="progress dz-progress"><i :style="{ width: st.upload[s.id].pct + '%' }" /></div>
            <p class="muted small">Загрузка…</p>
          </template>
          <template v-else-if="st.upload[s.id].phase === 'checking'">
            <span class="spinner" />
            <p class="muted small">Проверяем файл…</p>
          </template>
          <template v-else>
            <Icon name="upload" class="dz-icon" />
            <p class="small">Перетащите файл сюда или</p>
            <button class="btn btn-outline btn-sm" @click="inputs[s.id]?.click()">Выберите файл</button>
            <p v-if="st.upload[s.id].error" class="dz-error small">{{ st.upload[s.id].error }}</p>
            <input :ref="(el) => (inputs[s.id] = el)" type="file" hidden @change="onPick(s.id, $event)" />
          </template>
        </div>
      </div>
    </div>

    <div class="docs-next">
      <button class="btn btn-cta btn-lg" :disabled="!ready" @click="startAnalysis()">
        Начать анализ<Icon name="arrow-right" class="icon-sm" />
      </button>
      <p v-if="!ready" class="muted small">Кнопка станет доступна после загрузки обоих документов.</p>
    </div>
  </section>
</template>

<style scoped>
.docs { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-3); }
.docs h2 { margin: 0; }
.docs > .muted { margin: 0 0 var(--sp-2); }
.docs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
.docs-col { display: flex; flex-direction: column; gap: var(--sp-2); }
.dz { min-height: 190px; justify-content: center; gap: var(--sp-2); }
.dz-icon { color: var(--ink-500); }
.dz-progress { width: 70%; }
.dz-error { color: var(--fx-loss); }
.filecard { display: flex; align-items: center; gap: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); background: var(--surface); min-height: 190px; flex-direction: column; justify-content: center; text-align: center; }
.filebody { min-width: 0; }
.filename { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.docs-next { margin-top: var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
@media (max-width: 720px) { .docs-grid { grid-template-columns: 1fr; } }
</style>
