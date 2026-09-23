<script setup>
import Icon from "../Icon.vue";
import { FINDING_TYPE, SEVERITY, SIDE, REVIEW_NOTE } from "../domain.js";

defineProps({
  finding: { type: Object, required: true },
  documents: { type: Array, default: () => [] },
});
const emit = defineEmits(["open-clause"]);

const fileOf = (documents, docId) => documents.find((d) => d.doc_id === docId)?.filename ?? docId;
</script>

<template>
  <article v-if="finding.citations?.length" class="finding" :class="FINDING_TYPE[finding.type].card">
    <div class="row-between head">
      <span class="badge" :class="FINDING_TYPE[finding.type].cls"><Icon :name="FINDING_TYPE[finding.type].icon" /><span>{{ FINDING_TYPE[finding.type].label }}</span></span>
      <span class="confidence" :class="SEVERITY[finding.severity].cls" :title="SEVERITY[finding.severity].label">
        <span class="bars"><i /><i /><i /></span>{{ SEVERITY[finding.severity].label }}
      </span>
    </div>
    <h3>{{ finding.title }}</h3>
    <p class="explain">{{ finding.explanation }}</p>
    <div v-if="finding.units?.length" class="units">
      <span class="muted small">Подразделения:</span>
      <span v-for="unit in finding.units" :key="unit" class="u">{{ unit }}</span>
    </div>
    <div class="quotes">
      <div v-for="citation in finding.citations" :key="citation.doc_id + citation.clause_id" class="quote" :class="[citation.side === 'before' ? 'q-before' : '', FINDING_TYPE[finding.type].quote]">
        <blockquote>{{ citation.quote }}</blockquote>
        <footer>
          <button type="button" class="src-chip" @click="emit('open-clause', { doc_id: citation.doc_id, clause_id: citation.clause_id })">
            {{ SIDE[citation.side] }} · <span class="clause">п. {{ citation.clause_id }}</span>
          </button>
          <span>{{ fileOf(documents, citation.doc_id) }} · {{ citation.ref }}</span>
        </footer>
      </div>
    </div>
    <div class="foot">
      <Icon name="info" class="icon-sm muted" />
      <span class="small muted">{{ REVIEW_NOTE }}</span>
      <span v-if="finding.review?.verdict === 'unreviewed'" class="badge badge-outline">без проверки моделью</span>
    </div>
  </article>
</template>

<style scoped>
.head { align-items: flex-start; }
.quotes { display: grid; gap: var(--sp-3); margin-top: var(--sp-4); }
.quote footer .src-chip { height: 24px; }
</style>
