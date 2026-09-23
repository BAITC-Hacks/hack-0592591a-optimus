<script setup>
import { computed, ref } from "vue";
import Icon from "../Icon.vue";
import { SESSION_STATUS, fmtDate } from "./data.js";
import { store, openSession, renameSession, duplicateSession, deleteSession } from "./store.js";

const q = ref("");
const filter = ref("all");
const menuFor = ref(null);
const renamingId = ref(null);
const renameText = ref("");
const confirmDeleteId = ref(null);

const filtered = computed(() =>
  store.sessions.filter((s) => {
    if (q.value && !s.title.toLowerCase().includes(q.value.toLowerCase())) return false;
    if (filter.value === "review") return s.status === "review";
    if (filter.value === "completed") return s.status === "completed";
    return true;
  }),
);

function badgeText(s) {
  if (s.status === "analyzing") return `Идёт анализ${s.progress_pct ? ` (${s.progress_pct}%)` : "…"}`;
  if (s.status === "review" && s.progress) return `На проверке ${s.progress.done}/${s.progress.total}`;
  return SESSION_STATUS[s.status].label;
}

function startRename(s) {
  renamingId.value = s.id;
  renameText.value = s.title;
  menuFor.value = null;
}
function applyRename() {
  renameSession(renamingId.value, renameText.value);
  renamingId.value = null;
}
</script>

<template>
  <aside class="sidebar">
    <div class="sb-search">
      <div class="input-icon">
        <Icon name="search" class="icon-sm" />
        <input v-model="q" class="input" type="search" placeholder="Поиск сессий" aria-label="Поиск сессий" />
      </div>
      <div class="chips sb-filter">
        <button class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">Все</button>
        <button class="chip" :class="{ active: filter === 'review' }" @click="filter = 'review'">На проверке</button>
        <button class="chip" :class="{ active: filter === 'completed' }" @click="filter = 'completed'">Завершено</button>
      </div>
    </div>

    <nav class="sb-list" aria-label="Предыдущие сессии">
      <div v-for="s in filtered" :key="s.id" class="sb-item" :class="{ active: s.id === store.currentId }">
        <template v-if="renamingId === s.id">
          <input v-model="renameText" class="input" @keydown.enter="applyRename" @blur="applyRename" />
        </template>
        <template v-else>
          <button class="sb-open" @click="openSession(s.id)">
            <span class="sb-title">{{ s.title }} <span v-if="s.is_sample" class="badge badge-info sb-sample">пример</span></span>
            <span class="sb-meta">
              <span class="muted small">{{ fmtDate(s.created_at) }}</span>
              <span class="badge" :class="SESSION_STATUS[s.status].cls">{{ badgeText(s) }}</span>
            </span>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon sb-menu-btn" aria-label="Меню сессии" @click.stop="menuFor = menuFor === s.id ? null : s.id">
            <Icon name="more-h" class="icon-sm" />
          </button>
          <div v-if="menuFor === s.id" class="sb-menu card card-flat">
            <button class="btn btn-ghost btn-sm" @click="startRename(s)"><Icon name="pencil" class="icon-sm" />Переименовать</button>
            <button class="btn btn-ghost btn-sm" @click="duplicateSession(s.id); menuFor = null"><Icon name="copy" class="icon-sm" />Проверить новую редакцию</button>
            <button class="btn btn-ghost btn-sm sb-danger" @click="confirmDeleteId = s.id; menuFor = null"><Icon name="trash" class="icon-sm" />Удалить</button>
          </div>
        </template>
      </div>
      <p v-if="!filtered.length" class="muted small sb-empty">Сессии не найдены. Измените поиск или фильтр.</p>
    </nav>

    <div class="sb-foot">
      <button class="btn btn-ghost btn-sm" @click="store.kbOpen = true"><Icon name="book-open" class="icon-sm" />База знаний</button>
    </div>

    <div v-if="confirmDeleteId" class="modal-back" @click.self="confirmDeleteId = null">
      <div class="card modal-card" role="dialog" aria-modal="true">
        <h3>Удалить сессию?</h3>
        <p class="muted small">«{{ store.sessions.find((x) => x.id === confirmDeleteId)?.title }}» будет удалена вместе с результатами. Это действие нельзя отменить.</p>
        <div class="row modal-actions">
          <button class="btn btn-outline" @click="confirmDeleteId = null">Отмена</button>
          <button class="btn btn-danger" @click="deleteSession(confirmDeleteId); confirmDeleteId = null"><Icon name="trash" class="icon-sm" />Удалить</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar { width: 260px; flex: none; display: flex; flex-direction: column; gap: var(--sp-3); background: var(--surface); border-right: 1px solid var(--line); padding: var(--sp-4) var(--sp-3); overflow-y: auto; }
.sb-search { display: flex; flex-direction: column; gap: var(--sp-2); }
.sb-filter .chip { height: 26px; font-size: 12px; padding: 0 10px; }
.sb-list { display: flex; flex-direction: column; gap: var(--sp-1); flex: 1; }
.sb-item { position: relative; display: flex; align-items: flex-start; border-radius: var(--r-md); }
.sb-item.active { background: var(--kt-blue-100); }
.sb-item:hover { background: var(--kt-blue-50); }
.sb-item.active:hover { background: var(--kt-blue-100); }
.sb-open { flex: 1; min-width: 0; text-align: left; background: none; border: 0; font: inherit; cursor: pointer; padding: var(--sp-2) var(--sp-2); display: flex; flex-direction: column; gap: 4px; }
.sb-title { font-weight: 700; font-size: 13px; color: var(--ink-900); line-height: 18px; }
.sb-sample { height: 18px; font-size: 10px; padding: 0 6px; }
.sb-meta { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.sb-meta .badge { height: 20px; font-size: 10px; padding: 0 8px; }
.sb-menu-btn { margin-top: 4px; }
.sb-menu { position: absolute; right: 4px; top: 36px; z-index: 30; display: flex; flex-direction: column; align-items: stretch; padding: var(--sp-2); gap: 2px; box-shadow: var(--sh-3); }
.sb-menu .btn { justify-content: flex-start; }
.sb-danger { color: var(--fx-loss); }
.sb-empty { padding: var(--sp-4); text-align: center; }
.sb-foot { border-top: 1px solid var(--line); padding-top: var(--sp-3); }
.modal-back { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink-900) 45%, transparent); display: grid; place-items: center; z-index: 60; }
.modal-card { width: min(420px, 90vw); display: flex; flex-direction: column; gap: var(--sp-3); }
.modal-actions { justify-content: flex-end; }
</style>
