<script setup>
import { computed } from "vue";
import { marked } from "marked";
import Icon from "../Icon.vue";

const props = defineProps({
  markdown: { type: String, required: true },
  analysisId: { type: String, required: true },
});

// The text comes from our own backend, but raw HTML in it is never rendered:
// angle brackets are escaped before Markdown parsing.
const html = computed(() => marked.parse(props.markdown.replace(/</g, "&lt;"), { async: false, gfm: true, breaks: false }));

function download() {
  const blob = new Blob([props.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zaklyuchenie-${props.analysisId}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section class="card conclusion">
    <div class="card-header">
      <h2>Аналитическое заключение</h2>
      <button type="button" class="btn btn-cta" @click="download"><Icon name="download" /> Скачать .md</button>
    </div>
    <div class="prose" v-html="html" />
  </section>
</template>

<style scoped>
.prose :deep(h2) { font-size: var(--fs-h3); line-height: var(--lh-h3); margin: var(--sp-6) 0 var(--sp-3); }
.prose :deep(h2:first-child) { margin-top: 0; }
.prose :deep(p), .prose :deep(li) { margin-bottom: var(--sp-2); }
.prose :deep(ul), .prose :deep(ol) { padding-left: var(--sp-6); }
.prose :deep(hr) { border: 0; height: 1px; background: var(--line); margin: var(--sp-6) 0; }
.prose :deep(em) { color: var(--ink-600); }
</style>
