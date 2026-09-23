<script setup>
import Icon from "../Icon.vue";
import { removeFile } from "./store.js";

const props = defineProps({
  file: { type: Object, required: true },
  side: { type: String, required: true },
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(["view", "replace"]);

function ext(name) {
  return (name.split(".").pop() || "").toUpperCase();
}
function confirmDelete() {
  if (window.confirm("Удалить файл? Шаг вернётся к загрузке.")) removeFile(props.side);
}
</script>

<template>
  <div class="filecard" :class="{ compact }">
    <span class="filetype" :class="'ft-' + ext(file.name).toLowerCase()">{{ ext(file.name) }}</span>
    <div class="fc-body">
      <div class="fc-name">{{ file.name }}</div>
      <div class="fc-meta muted small">
        {{ file.size_kb }} КБ · {{ file.doc_type }} · {{ file.edition }}<template v-if="!compact"> · {{ file.approved }}</template>
      </div>
    </div>
    <span class="badge badge-ok"><Icon name="check" />Загружено</span>
    <div class="row fc-actions">
      <button class="btn btn-ghost btn-sm btn-icon" title="Просмотреть документ" aria-label="Просмотреть документ" @click="emit('view')"><Icon name="eye" class="icon-sm" /></button>
      <button class="btn btn-ghost btn-sm btn-icon" title="Заменить файл" aria-label="Заменить файл" @click="emit('replace')"><Icon name="rotate-cw" class="icon-sm" /></button>
      <button class="btn btn-ghost btn-sm btn-icon fc-del" title="Удалить файл" aria-label="Удалить файл" @click="confirmDelete"><Icon name="trash" class="icon-sm" /></button>
    </div>
  </div>
</template>

<style scoped>
.filecard { display: flex; align-items: center; gap: var(--sp-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); box-shadow: var(--sh-1); }
.filecard.compact { padding: var(--sp-2) var(--sp-3); }
.fc-body { flex: 1; min-width: 0; }
.fc-name { font-weight: 700; font-size: 14px; color: var(--ink-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-actions { gap: 2px; }
.fc-del { color: var(--fx-loss); }
</style>
