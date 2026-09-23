<script setup>
import { ref, computed } from "vue";
import Icon from "../Icon.vue";
import { demo } from "./data.js";
import { store } from "./store.js";

const q = ref("");
const collections = [
  { name: "Законодательство РК", docs: 12, indexed: "10.09.2026" },
  { name: "Стандарты внутреннего аудита (IIA)", docs: 4, indexed: "02.08.2026" },
  { name: "Требования регулятора", docs: 6, indexed: "28.08.2026" },
  { name: "Внутренние нормативные документы", docs: 9, indexed: "15.09.2026" },
];
const filtered = computed(() => collections.filter((c) => c.name.toLowerCase().includes(q.value.toLowerCase())));
</script>

<template>
  <div class="modal-back" @click.self="store.kbOpen = false">
    <div class="card kb-card" role="dialog" aria-modal="true" aria-label="База знаний">
      <div class="row-between">
        <h3><Icon name="book-open" class="icon-sm" /> База знаний (только просмотр)</h3>
        <button class="btn btn-ghost btn-sm btn-icon" aria-label="Закрыть" @click="store.kbOpen = false"><Icon name="x" class="icon-sm" /></button>
      </div>
      <div class="input-icon">
        <Icon name="search" class="icon-sm" />
        <input v-model="q" class="input" type="search" placeholder="Поиск по коллекциям" />
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th scope="col">Коллекция</th><th scope="col" class="num">Документов</th><th scope="col">Индексация</th></tr></thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.name">
              <td class="cell-title">{{ c.name }}</td><td class="num">{{ c.docs }}</td><td>{{ c.indexed }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="label">Операторы для бенчмарка</div>
      <div class="chips">
        <span v-for="o in demo.benchmark_table.operators" :key="o" class="chip">{{ o }}</span>
      </div>
      <p class="muted small">Демо-режим: содержимое коллекций — заглушки до подключения реальной базы знаний.</p>
    </div>
  </div>
</template>

<style scoped>
.modal-back { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink-900) 45%, transparent); display: grid; place-items: center; z-index: 60; }
.kb-card { width: min(640px, 92vw); max-height: 84vh; overflow-y: auto; display: flex; flex-direction: column; gap: var(--sp-4); }
.kb-card h3 { display: flex; align-items: center; gap: var(--sp-2); }
</style>
