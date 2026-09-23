<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { fileTypeClass } from "../domain.js";

const props = defineProps({ busy: { type: Boolean, default: false } });
const emit = defineEmits(["submit", "demo"]);

const ACCEPT = ".pdf,.docx,.xlsx,.xlsm,.xls";
const SUPPORTED = /\.(pdf|docx|xlsx|xlsm|xls)$/i;
const MAX_FILES = 10;

const files = ref({ before: [], after: [] });
const over = ref({ before: false, after: false });
const warning = ref("");
const inputs = { before: ref(null), after: ref(null) };

const ready = computed(() => files.value.before.length > 0 && files.value.after.length > 0 && !props.busy);

function add(side, list) {
  warning.value = "";
  const accepted = [];
  for (const file of list) {
    if (!SUPPORTED.test(file.name)) {
      warning.value = `Файл «${file.name}» пропущен: поддерживаются PDF, Word (.docx) и Excel (.xlsx, .xls).`;
      continue;
    }
    if (files.value[side].some((f) => f.name === file.name && f.size === file.size)) continue;
    accepted.push(file);
  }
  const next = [...files.value[side], ...accepted];
  if (next.length > MAX_FILES) warning.value = `Не больше ${MAX_FILES} файлов на сторону.`;
  files.value[side] = next.slice(0, MAX_FILES);
}

function onDrop(side, event) {
  over.value[side] = false;
  add(side, event.dataTransfer?.files ?? []);
}

function onPick(side, event) {
  add(side, event.target.files ?? []);
  event.target.value = "";
}

function remove(side, index) {
  files.value[side].splice(index, 1);
}

const sizeOf = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`);
</script>

<template>
  <section class="card upload-card">
    <div class="card-header plain">
      <div>
        <h2>Новый анализ</h2>
        <p class="muted small">Загрузите комплекты документов «до» и «после» реорганизации: положения, приказы, оргструктуры. Один документ на сторону достаточно.</p>
      </div>
    </div>

    <div class="grid grid-2 zones">
      <div v-for="side in ['before', 'after']" :key="side" class="zone">
        <div class="eyebrow">{{ side === "before" ? "До реорганизации" : "После реорганизации" }}</div>
        <div
          class="dropzone"
          :class="{ 'is-over': over[side] }"
          @dragover.prevent="over[side] = true"
          @dragleave.prevent="over[side] = false"
          @drop.prevent="onDrop(side, $event)"
        >
          <div class="tile tile-soft"><Icon name="upload" /></div>
          <h3>Перетащите файлы сюда</h3>
          <p class="muted small">или</p>
          <button type="button" class="btn btn-outline btn-sm" @click="inputs[side].value.click()">Выбрать файлы</button>
          <input :ref="(el) => (inputs[side].value = el)" type="file" multiple :accept="ACCEPT" hidden @change="onPick(side, $event)" />
          <div class="row types">
            <span class="filetype ft-docx">DOCX</span>
            <span class="filetype ft-pdf">PDF</span>
            <span class="filetype ft-xlsx">XLSX</span>
          </div>
        </div>
        <ul v-if="files[side].length" class="file-list">
          <li v-for="(file, index) in files[side]" :key="file.name + file.size" class="file-item">
            <span class="filetype" :class="fileTypeClass(file.name).cls">{{ fileTypeClass(file.name).label }}</span>
            <span class="name" :title="file.name">{{ file.name }}</span>
            <span class="meta">{{ sizeOf(file.size) }}</span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Убрать файл" @click="remove(side, index)"><Icon name="x" class="icon-sm" /></button>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="warning" class="alert alert-warning" role="alert"><Icon name="info" /><div>{{ warning }}</div></div>

    <div class="actions">
      <button type="button" class="btn btn-cta btn-lg" :disabled="!ready" @click="emit('submit', { before: [...files.before], after: [...files.after] })">
        Анализировать <Icon name="arrow-right" />
      </button>
      <button type="button" class="btn btn-outline btn-lg" :disabled="busy" @click="emit('demo')">
        <Icon name="play" /> Запустить на контрольном комплекте
      </button>
      <span class="muted small hint">Контрольный комплект: «Положение о внутреннем аудите», редакции 8 и 9 (обезличенные PDF из репозитория).</span>
    </div>
  </section>
</template>

<style scoped>
.upload-card { display: grid; gap: var(--sp-5); }
.zones { align-items: start; }
.zone { display: grid; gap: var(--sp-3); }
.types { justify-content: center; gap: var(--sp-2); margin-top: var(--sp-2); }
.actions { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; padding-top: var(--sp-2); }
.hint { flex-basis: 100%; }
</style>
