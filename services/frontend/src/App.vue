<script setup>
import { onMounted, ref } from "vue";

const apiStatus = ref("проверка…");

onMounted(async () => {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    apiStatus.value = res.ok ? data.status : `ошибка ${res.status}`;
  } catch {
    apiStatus.value = "недоступен";
  }
});
</script>

<template>
  <main>
    <h1>Анализ организационной структуры</h1>
    <p>Загрузка документов «до» и «после» появится здесь.</p>
    <p>API: {{ apiStatus }}</p>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 2rem; }
</style>
