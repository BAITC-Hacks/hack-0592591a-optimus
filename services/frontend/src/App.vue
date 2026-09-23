<script setup>
import { computed, onMounted, ref } from "vue";
import AuthPanel from "./AuthPanel.vue";
import BrandMark from "./BrandMark.vue";
import HealthStatus from "./HealthStatus.vue";
import Icon from "./Icon.vue";

const health = ref({ state: "checking", text: "проверка…" });
const user = ref(null);
const sessionChecked = ref(false);

const initials = computed(() =>
  (user.value?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join(""),
);

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    health.value = res.ok
      ? { state: "ok", text: `${data.status}, БД: ${data.db}` }
      : { state: "down", text: `ошибка ${res.status}` };
  } catch {
    health.value = { state: "down", text: "недоступен" };
  }
}

async function loadSession() {
  try {
    const res = await fetch("/api/auth/me");
    user.value = res.ok ? (await res.json()).user : null;
  } catch {
    user.value = null;
  } finally {
    sessionChecked.value = true;
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  user.value = null;
}

onMounted(() => {
  loadHealth();
  loadSession();
});
</script>

<template>
  <template v-if="user">
    <header class="app-header">
      <div class="container">
        <BrandMark />
        <div class="header-spacer" />
        <div class="header-actions">
          <HealthStatus :health="health" />
          <span class="divider-v" />
          <div class="row">
            <div class="avatar">{{ initials }}</div>
            <div class="who">
              <b>{{ user.name }}</b>
              <span>{{ user.email }}</span>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="logout">
            <Icon name="log-out" class="icon-sm" />Выйти
          </button>
        </div>
      </div>
    </header>

    <main class="container page">
      <div class="page-head">
        <div class="eyebrow">Рабочее место аналитика</div>
        <h1>Анализ организационной структуры</h1>
      </div>

      <div class="card empty">
        <div class="tile tile-lg tile-soft"><Icon name="upload" /></div>
        <h2>Новый анализ</h2>
        <p class="muted">Загрузка документов «до» и «после» появится здесь.</p>
      </div>
    </main>
  </template>

  <AuthPanel v-else-if="sessionChecked" :health="health" @signed-in="user = $event" />

  <div v-else class="boot">
    <BrandMark />
    <p class="muted small">Проверка сессии…</p>
  </div>
</template>

<style scoped>
.header-spacer { flex: 1; }
.who { display: flex; flex-direction: column; line-height: 1.25; }
.who b { font-size: 14px; color: var(--ink-900); }
.who span { font-size: 12px; color: var(--ink-500); }
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding: var(--sp-12) var(--sp-6); }
.boot { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: var(--sp-4); }
@media (max-width: 720px) {
  .who, .header-actions .health, .header-actions .divider-v { display: none; }
}
</style>
