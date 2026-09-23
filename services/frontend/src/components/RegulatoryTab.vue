<script setup>
// O1 results (docs/TASK.md §12a): «после» functions next to the norms of the
// shipped adilet.zan.kz slice or uploaded regulations. Possible conflicts first;
// grounded functions are collapsed below (open when there are no conflicts).
import { computed } from "vue";
import Icon from "../Icon.vue";
import { adiletHref, ruDate } from "../adilet.js";
import { REGULATORY_TYPE, REVIEW_NOTE, SEVERITY, SIDE } from "../domain.js";

const props = defineProps({
  findings: { type: Array, default: () => [] },
  stats: { type: Object, default: () => ({}) },
  documents: { type: Array, default: () => [] },
});
const emit = defineEmits(["open-clause"]);

const conflicts = computed(() => props.findings.filter((f) => f.type === "POTENTIAL_REGULATORY_CONFLICT"));
const basis = computed(() => props.findings.filter((f) => f.type === "REGULATORY_BASIS"));
const status = computed(() => props.stats.regulatory_status ?? "absent");
const EMPTY = {
  absent: ["Сверка не выполнялась", "Этот анализ запущен до появления сверки с законодательством."],
  no_norms: ["Нормативная база не загружена", "В backend нет норм из data/regulatory и не загружены нормативные документы."],
  no_functions: ["Нет функций для сверки", "В документах «после» не найдено функций."],
  failed: ["Сверка не выполнена", "Во время сверки произошла ошибка; остальные результаты анализа не затронуты."],
};
const fileOf = (docId) => props.documents.find((d) => d.doc_id === docId)?.filename ?? docId;
</script>

<template>
  <div class="stack">
    <div class="note">
      <Icon name="scale" class="icon-sm" />
      <span class="small">
        Функции «после» сопоставлены с нормами законов РК (adilet.zan.kz, только действующие акты) и с загруженными нормативными документами.
        Норма — основание для проверки, а не юридический вывод.
        <template v-if="status === 'ok'">
          Функций с нормами-кандидатами: {{ stats.regulatory_judged }} · оснований: {{ stats.regulatory_basis }} · возможных расхождений:
          {{ stats.regulatory_conflicts }} · отбор кандидатов: {{ stats.regulatory_mode === "embeddings" ? "семантический" : "лексический" }}.
        </template>
      </span>
    </div>

    <div v-if="status !== 'ok' || !findings.length" class="empty">
      <div class="tile tile-lg tile-soft"><Icon name="scale" /></div>
      <h3>{{ status === "ok" ? "Связей с нормами не найдено" : EMPTY[status]?.[0] ?? EMPTY.failed[0] }}</h3>
      <p class="muted">{{ status === "ok" ? "Модель не нашла норм, которые явно регулируют функции «после»." : EMPTY[status]?.[1] ?? EMPTY.failed[1] }}</p>
    </div>

    <template v-for="group in [{ list: conflicts, open: true }, { list: basis, open: false }]" :key="group.open">
      <component :is="group.open ? 'div' : 'details'" v-if="group.list.length" :class="group.open ? 'stack' : 'finding-group'" :open="!group.open && !conflicts.length ? true : undefined">
        <summary v-if="!group.open">Нормативные основания функций ({{ group.list.length }})</summary>
        <div :class="group.open ? 'stack' : 'group-body'">
          <article v-for="f in group.list" :key="f.finding_id" class="finding" :class="REGULATORY_TYPE[f.type].card">
            <div class="row-between head">
              <span class="badge" :class="REGULATORY_TYPE[f.type].cls"><Icon :name="REGULATORY_TYPE[f.type].icon" /><span>{{ REGULATORY_TYPE[f.type].label }}</span></span>
              <span class="confidence" :class="SEVERITY[f.severity].cls" :title="SEVERITY[f.severity].label">
                <span class="bars"><i /><i /><i /></span>{{ SEVERITY[f.severity].label }}
              </span>
            </div>
            <h3>{{ f.title }}</h3>
            <p class="explain">{{ f.explanation }}</p>
            <div v-if="f.units?.length" class="units">
              <span class="muted small">Подразделения:</span>
              <span v-for="unit in f.units" :key="unit" class="u">{{ unit }}</span>
            </div>
            <div class="quotes">
              <div v-for="c in f.citations" :key="c.doc_id + c.clause_id" class="quote">
                <blockquote>{{ c.quote }}</blockquote>
                <footer>
                  <button type="button" class="src-chip" @click="emit('open-clause', { doc_id: c.doc_id, clause_id: c.clause_id })">
                    {{ SIDE[c.side] }} · <span class="clause">п. {{ c.clause_id }}</span>
                  </button>
                  <span>{{ fileOf(c.doc_id) }} · {{ c.ref }}</span>
                </footer>
              </div>
              <div class="quote norm">
                <p class="small muted crumb">{{ f.norm.breadcrumb }}</p>
                <blockquote>{{ f.norm.quote }}</blockquote>
                <footer>
                  <span class="clause">{{ f.norm.clause }}</span>
                  <span>{{ f.norm.doc_title }}<template v-if="f.norm.redaction_date"> · ред. от {{ ruDate(f.norm.redaction_date) }}</template><template v-if="f.norm.origin === 'uploaded'"> · загруженный документ, {{ f.norm.ref }}</template></span>
                  <a v-if="adiletHref(f.norm.source_url)" class="btn btn-ghost btn-sm" :href="adiletHref(f.norm.source_url)" target="_blank" rel="noopener noreferrer">
                    <Icon name="external-link" /><span>Открыть на adilet.zan.kz</span>
                  </a>
                </footer>
              </div>
            </div>
            <div class="foot">
              <Icon name="info" class="icon-sm muted" />
              <span class="small muted">{{ REVIEW_NOTE }} На сайте может действовать более новая редакция нормы.</span>
            </div>
          </article>
        </div>
      </component>
    </template>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding: var(--sp-10) var(--sp-6); }
.note { display: flex; gap: var(--sp-2); align-items: flex-start; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface-muted); }
.finding { min-width: 0; }
.head { align-items: flex-start; flex-wrap: wrap; gap: var(--sp-2); }
.quotes { display: grid; gap: var(--sp-3); margin-top: var(--sp-4); }
.quote footer { flex-wrap: wrap; align-items: center; }
.quote footer .src-chip { height: 24px; }
.norm { border-left-color: var(--kt-blue-600); }
.crumb { margin: 0 0 var(--sp-2); }
.clause { font-variant-numeric: tabular-nums; font-weight: 600; }
.btn-sm { margin-left: auto; }
</style>
