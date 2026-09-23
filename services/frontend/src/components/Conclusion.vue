<script setup>
import { computed } from "vue";
import { marked } from "marked";
import Icon from "../Icon.vue";
import { downloadDocx, downloadPdf } from "../export.js";

const props = defineProps({
  markdown: { type: String, required: true },
  analysisId: { type: String, required: true },
  subtitle: { type: String, default: "" },
});
const emit = defineEmits(["notice"]);

// The text comes from our own backend, but raw HTML in it is never rendered:
// angle brackets are escaped before Markdown parsing.
const html = computed(() => marked.parse(props.markdown.replace(/</g, "&lt;"), { async: false, gfm: true, breaks: false }));

const opts = () => ({ markdown: props.markdown, analysisId: props.analysisId, subtitle: props.subtitle });
const docx = () => downloadDocx(opts()).catch((err) => emit("notice", `Не удалось собрать DOCX: ${err.message}`));
const pdf = () => { if (!downloadPdf(opts())) emit("notice", "Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта и повторите."); };
</script>

<template>
  <section class="card conclusion">
    <div class="card-header">
      <h2>Аналитическое заключение</h2>
      <div class="exports">
        <button type="button" class="btn btn-primary" @click="docx"><Icon name="download" /> Скачать DOCX</button>
        <button type="button" class="btn btn-outline" @click="pdf"><Icon name="download" /> Скачать PDF</button>
      </div>
    </div>
    <div class="prose" v-html="html" />
  </section>
</template>

<style scoped>
.exports { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-primary { background: var(--accent); color: var(--white); border-color: var(--accent); }
.btn-primary:hover { opacity: 0.92; }
.prose :deep(h2) { font-size: var(--fs-h3); line-height: var(--lh-h3); margin: var(--sp-6) 0 var(--sp-3); }
.prose :deep(h2:first-child) { margin-top: 0; }
.prose :deep(p), .prose :deep(li) { margin-bottom: var(--sp-2); }
.prose :deep(ul), .prose :deep(ol) { padding-left: var(--sp-6); }
.prose :deep(hr) { border: 0; height: 1px; background: var(--line); margin: var(--sp-6) 0; }
.prose :deep(em) { color: var(--ink-600); }
</style>
