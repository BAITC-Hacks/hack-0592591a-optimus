<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import Icon from "../Icon.vue";
import { SIDE } from "../domain.js";

const props = defineProps({
  documents: { type: Array, required: true },
  target: { type: Object, required: true }, // { doc_id, clause_id }
});
const emit = defineEmits(["close"]);

const doc = computed(() => props.documents.find((d) => d.doc_id === props.target.doc_id));
const clause = computed(() => doc.value?.clauses.find((c) => c.clause_id === props.target.clause_id));
const children = computed(() => (doc.value?.clauses ?? []).filter((c) => c.parent_id === props.target.clause_id));

const onKey = (event) => event.key === "Escape" && emit("close");
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-label="Пункт документа">
      <div class="panel-head">
        <div>
          <div class="eyebrow">{{ doc ? SIDE[doc.side] : "" }} · {{ doc?.filename }}</div>
          <h3>{{ clause ? clause.ref : "Пункт не найден" }}</h3>
        </div>
        <button type="button" class="btn btn-ghost btn-icon" aria-label="Закрыть" @click="emit('close')"><Icon name="x" /></button>
      </div>
      <div class="panel-body">
        <div v-if="clause" class="quote">
          <blockquote>{{ clause.text }}</blockquote>
          <footer>п. {{ clause.clause_id }}<template v-if="clause.parent_id"> · входит в п. {{ clause.parent_id }}</template></footer>
        </div>
        <p v-else class="muted">В документе нет пункта {{ target.clause_id }}.</p>
        <div v-if="children.length" class="children">
          <div class="eyebrow">Подпункты</div>
          <div v-for="child in children" :key="child.clause_id" class="quote child">
            <blockquote>{{ child.text }}</blockquote>
            <footer>{{ child.ref }}</footer>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(6, 46, 111, 0.45); display: grid; place-items: center; padding: var(--sp-6); z-index: 30; }
.panel { width: min(720px, 100%); max-height: 85vh; }
.children { display: grid; gap: var(--sp-3); margin-top: var(--sp-5); }
</style>
