<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { RELATION, STEP, CATEGORY } from "../domain.js";

const props = defineProps({
  functions: { type: Object, required: true }, // { before: [], after: [] }
  matches: { type: Array, required: true },
});
const emit = defineEmits(["open-clause"]);

const filter = ref("all");
const query = ref("");
const afterById = computed(() => new Map(props.functions.after.map((f) => [f.func_id, f])));
const beforeById = computed(() => new Map(props.functions.before.map((f) => [f.func_id, f])));

const counts = computed(() => {
  const c = { all: props.matches.length, same: 0, partial: 0, moved: 0, unmatched: 0 };
  for (const m of props.matches) c[m.relation]++;
  return c;
});

const rows = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.matches
    .map((m) => ({ m, before: beforeById.value.get(m.before_id), after: m.after_id ? afterById.value.get(m.after_id) : null }))
    .filter((r) => r.before && (filter.value === "all" || r.m.relation === filter.value))
    .filter((r) => !q || [r.before.clause_id, r.before.canonical, r.before.owners.join(" "), r.after?.clause_id, r.after?.canonical, r.after?.owners.join(" ")].join(" ").toLowerCase().includes(q));
});
const CHIPS = [
  ["all", "Все"],
  ["same", "Совпадают"],
  ["partial", "Частично"],
  ["moved", "Перераспределены"],
  ["unmatched", "Не найдены"],
];
</script>

<template>
  <div class="table-wrap">
    <div class="table-toolbar">
      <div class="chips">
        <button v-for="[key, label] in CHIPS" :key="key" type="button" class="chip" :class="{ active: filter === key }" @click="filter = key">
          {{ label }} <span class="count">{{ counts[key] }}</span>
        </button>
      </div>
      <label class="input-icon search">
        <Icon name="search" class="icon-sm" />
        <input v-model="query" class="input" type="search" placeholder="Пункт, функция, подразделение" />
      </label>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Функция «до»</th>
          <th scope="col">Функция «после»</th>
          <th scope="col">Результат</th>
          <th scope="col">Как сопоставлено</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.m.before_id" :class="{ 'row-loss': row.m.relation === 'unmatched' }">
          <td>
            <div class="cell-title">{{ row.before.canonical }}</div>
            <div class="cell-sub">
              <button type="button" class="src-chip" @click="emit('open-clause', { doc_id: row.before.doc_id, clause_id: row.before.clause_id })">до · <span class="clause">п. {{ row.before.clause_id }}</span></button>
              {{ row.before.owners.join(", ") || "исполнитель не указан" }} · {{ CATEGORY[row.before.category] }}
            </div>
          </td>
          <td>
            <template v-if="row.after">
              <div class="cell-title">{{ row.after.canonical }}</div>
              <div class="cell-sub">
                <button type="button" class="src-chip" @click="emit('open-clause', { doc_id: row.after.doc_id, clause_id: row.after.clause_id })">после · <span class="clause">п. {{ row.after.clause_id }}</span></button>
                {{ row.after.owners.join(", ") || "исполнитель не указан" }} · {{ CATEGORY[row.after.category] }}
              </div>
            </template>
            <span v-else class="muted">эквивалент не найден</span>
          </td>
          <td>
            <span class="badge" :class="RELATION[row.m.relation].cls"><Icon :name="RELATION[row.m.relation].icon" /><span>{{ RELATION[row.m.relation].label }}</span></span>
          </td>
          <td class="small muted how">{{ STEP[row.m.steps[row.m.steps.length - 1]] }} · {{ Math.round(row.m.confidence * 100) }} %</td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="4" class="muted">Ничего не найдено по этому фильтру.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-toolbar { justify-content: space-between; flex-wrap: wrap; }
.search { width: 280px; max-width: 100%; }
.cell-sub { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-1); }
.cell-sub .src-chip { height: 22px; font-size: 11px; }
.how { white-space: nowrap; }
</style>
