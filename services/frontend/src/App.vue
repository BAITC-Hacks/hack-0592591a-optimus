<script setup>
import { onMounted, ref } from "vue";
import AuthPanel from "./AuthPanel.vue";

const apiStatus = ref("проверка…");
const user = ref(null);
const sessionChecked = ref(false);

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    apiStatus.value = res.ok ? `${data.status}, БД: ${data.db}` : `ошибка ${res.status}`;
  } catch {
    apiStatus.value = "недоступен";
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
  <main>
    <h1>Анализ организационной структуры</h1>
    <p>API: {{ apiStatus }}</p>

    <section v-if="user" class="account">
      <p>Вы вошли как <strong>{{ user.name }}</strong> ({{ user.email }}).</p>
      <button type="button" @click="logout">Выйти</button>
      <p>Загрузка документов «до» и «после» появится здесь.</p>
    </section>
    <AuthPanel v-else-if="sessionChecked" @signed-in="user = $event" />
    <p v-else>Проверка сессии…</p>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 2rem; }
.account button { padding: 0.4rem 0.8rem; border: 1px solid #bbb; border-radius: 6px; background: #f3f3f3; font: inherit; cursor: pointer; }
</style>
