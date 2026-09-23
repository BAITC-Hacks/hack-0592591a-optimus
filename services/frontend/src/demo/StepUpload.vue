<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import FileCard from "./FileCard.vue";
import { state, simulateUpload, goStep } from "./store.js";

const props = defineProps({ side: { type: String, required: true } }); // 'before' | 'after'
const emit = defineEmits(["view"]);

const over = ref(false);
const inputEl = ref(null);
const st = computed(() => state());
const up = computed(() => st.value.upload[props.side]);
const other = computed(() => (props.side === "before" ? "after" : "before"));

function onDrop(e) {
  over.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) simulateUpload(props.side, f.name);
}
function onPick(e) {
  const f = e.target.files?.[0];
  if (f) simulateUpload(props.side, f.name);
  e.target.value = "";
}
function retry() {
  st.value.upload[props.side] = { phase: "empty", pct: 0, error: null };
}
</script>

<template>
  <section class="upload-step">
    <!-- On step 2 the "before" card shrinks to a compact row on top -->
    <FileCard
      v-if="side === 'after' && st.files.before"
      :file="st.files.before"
      side="before"
      compact
      @view="emit('view', 'before')"
      @replace="goStep(1)"
    />

    <div v-if="st.files[side]" class="stack">
      <FileCard :file="st.files[side]" :side="side" @view="emit('view', side)" @replace="retry(); st.files[side] = null" />
      <div class="row next-row">
        <button v-if="side === 'before'" class="btn btn-primary" @click="goStep(2)">Далее: документ «ПОСЛЕ»<Icon name="arrow-right" class="icon-sm" /></button>
        <button v-else class="btn btn-cta btn-lg" :disabled="!st.files.before" @click="goStep(3)">Далее: запуск анализа<Icon name="arrow-right" class="icon-sm" /></button>
      </div>
    </div>

    <div
      v-else
      class="dropzone dz"
      :class="{ 'is-over': over, 'dz-after': side === 'after' }"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="onDrop"
    >
      <template v-if="up.phase === 'empty' || up.phase === 'error'">
        <div class="tile tile-lg" :class="side === 'after' ? 'tile-done' : ''"><Icon name="upload" /></div>
        <div class="dz-tag">{{ side === "before" ? "ДО" : "ПОСЛЕ" }}</div>
        <h3>Перетащите документ {{ side === "before" ? "до" : "после" }} реорганизации</h3>
        <p class="muted small">DOCX, PDF или XLSX, до 50 МБ</p>
        <div class="row">
          <span class="filetype ft-docx">DOCX</span><span class="filetype ft-pdf">PDF</span><span class="filetype ft-xlsx">XLSX</span>
        </div>
        <div v-if="up.phase === 'error'" class="alert alert-error dz-alert">
          <Icon name="alert-triangle" />
          <div>{{ up.error }}</div>
          <div class="alert-actions"><button class="btn btn-outline btn-sm" @click="retry">Загрузить другой</button></div>
        </div>
        <button class="btn btn-primary" @click="inputEl.click()"><Icon name="upload" class="icon-sm" />Выбрать файл</button>
        <p class="muted small">Демо-режим: вместо содержимого файла будет использован пример «{{ side === "before" ? "Редакция №8" : "Редакция №9" }}»</p>
        <input ref="inputEl" type="file" hidden @change="onPick" />
      </template>

      <template v-else-if="up.phase === 'uploading'">
        <div class="tile tile-lg tile-soft"><Icon name="upload" /></div>
        <h3>Загружаем файл…</h3>
        <div class="progress dz-progress"><i :style="{ width: up.pct + '%' }" /></div>
        <p class="muted small tnum">{{ Math.round(up.pct) }}%</p>
      </template>

      <template v-else-if="up.phase === 'checking'">
        <div class="tile tile-lg tile-soft pulse"><Icon name="file-search" /></div>
        <h3>Проверяем формат и читаемость…</h3>
        <p class="muted small">Обычно занимает несколько секунд</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.upload-step { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-4); }
.dz { min-height: 380px; justify-content: center; position: relative; }
.dz-after { border-color: color-mix(in srgb, var(--st-created) 45%, var(--line-strong)); }
.dz-after.is-over { border-color: var(--st-created); background: var(--st-created-bg); }
.dz-tag { font-size: var(--fs-xs); font-weight: 800; letter-spacing: 0.14em; color: var(--kt-blue-600); background: var(--kt-blue-100); border-radius: var(--r-pill); padding: 4px 14px; }
.dz-after .dz-tag { color: var(--st-created); background: var(--st-created-bg); }
.dz-progress { width: 60%; }
.dz-alert { width: 100%; text-align: left; }
.next-row { justify-content: flex-end; }
</style>
