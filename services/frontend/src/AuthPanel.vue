<script setup>
import { ref } from "vue";

const emit = defineEmits(["signed-in"]);

const mode = ref("login"); // "login" | "signup"
const name = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    const isSignup = mode.value === "signup";
    const body = isSignup
      ? { name: name.value, email: email.value, password: password.value }
      : { email: email.value, password: password.value };
    const res = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.error?.message || `Ошибка ${res.status}`;
      return;
    }
    password.value = "";
    emit("signed-in", data.user);
  } catch {
    error.value = "Сервер недоступен. Повторите попытку.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth">
    <div class="tabs">
      <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'; error = ''">Вход</button>
      <button type="button" :class="{ active: mode === 'signup' }" @click="mode = 'signup'; error = ''">Регистрация</button>
    </div>

    <form @submit.prevent="submit">
      <label v-if="mode === 'signup'">
        Имя
        <input v-model="name" type="text" required maxlength="100" autocomplete="name" />
      </label>
      <label>
        Email
        <input v-model="email" type="email" required maxlength="254" autocomplete="email" />
      </label>
      <label>
        Пароль
        <input
          v-model="password"
          type="password"
          required
          :minlength="mode === 'signup' ? 8 : 1"
          maxlength="128"
          :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
        />
      </label>
      <p v-if="mode === 'signup'" class="hint">Не короче 8 символов.</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="busy">
        {{ busy ? "Подождите…" : mode === "signup" ? "Зарегистрироваться" : "Войти" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.auth { max-width: 22rem; border: 1px solid #ccc; border-radius: 8px; padding: 1rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.tabs button { flex: 1; padding: 0.4rem; background: #f3f3f3; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; }
.tabs button.active { background: #1f5fbf; color: #fff; border-color: #1f5fbf; }
form { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
input { padding: 0.45rem; border: 1px solid #bbb; border-radius: 6px; font: inherit; }
.hint { margin: -0.5rem 0 0; font-size: 0.8rem; color: #666; }
.error { margin: 0; color: #b00020; font-size: 0.9rem; }
button[type="submit"] { padding: 0.5rem; background: #1f5fbf; color: #fff; border: 0; border-radius: 6px; font: inherit; cursor: pointer; }
button[type="submit"]:disabled { opacity: 0.6; cursor: default; }
</style>
