<script setup>
import { computed } from "vue";
import Icon from "../Icon.vue";
import { UNIT_STATUS, SIDE } from "../domain.js";

const props = defineProps({
  units: { type: Array, required: true },
  changes: { type: Array, required: true },
});
const emit = defineEmits(["open-clause"]);

const byId = computed(() => new Map(props.units.map((u) => [u.unit_id, u])));
const rows = computed(() =>
  props.changes.map((change) => {
    const unit = byId.value.get(change.after ?? change.before);
    const before = change.before ? byId.value.get(change.before) : null;
    const after = change.after ? byId.value.get(change.after) : null;
    return { change, unit, before, after, successors: change.successors.map((id) => byId.value.get(id)).filter(Boolean) };
  }),
);
const KIND = { block: "блок", department: "департамент", direction: "направление", position: "должность" };
</script>

<template>
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Подразделение</th>
          <th scope="col">Статус</th>
          <th scope="col">Преемники</th>
          <th scope="col">Источник</th>
          <th scope="col">Обоснование</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.change.before + ':' + row.change.after">
          <td>
            <div class="cell-title">{{ row.unit?.abbr || row.unit?.name }}</div>
            <div class="cell-sub">{{ row.unit?.abbr ? row.unit.name : KIND[row.unit?.kind] }}<template v-if="row.unit?.abbr"> · {{ KIND[row.unit.kind] }}</template></div>
          </td>
          <td>
            <span class="badge" :class="UNIT_STATUS[row.change.status].cls"><Icon :name="UNIT_STATUS[row.change.status].icon" /><span>{{ UNIT_STATUS[row.change.status].label }}</span></span>
          </td>
          <td>
            <template v-if="row.successors.length">{{ row.successors.map((u) => u.abbr || u.name).join(", ") }}</template>
            <span v-else class="arrow">—</span>
          </td>
          <td class="sources">
            <button v-if="row.before" type="button" class="src-chip" @click="emit('open-clause', { doc_id: row.before.doc_id, clause_id: row.before.source_clause })">
              {{ SIDE.before }} · <span class="clause">п. {{ row.before.source_clause }}</span>
            </button>
            <button v-if="row.after" type="button" class="src-chip" @click="emit('open-clause', { doc_id: row.after.doc_id, clause_id: row.after.source_clause })">
              {{ SIDE.after }} · <span class="clause">п. {{ row.after.source_clause }}</span>
            </button>
          </td>
          <td class="small reason">{{ row.change.reason }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sources { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
.reason { color: var(--ink-600); max-width: 360px; }
</style>
