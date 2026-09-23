<script setup>
import { ref } from "vue";
import BrandMark from "./BrandMark.vue";
import HealthStatus from "./HealthStatus.vue";
import Icon from "./Icon.vue";

defineProps({ health: { type: Object, required: true } });
const emit = defineEmits(["signed-in"]);

const mode = ref("login"); // "login" | "signup"
const name = ref("");
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const error = ref("");
const busy = ref(false);

function switchMode(next) {
  mode.value = next;
  error.value = "";
}

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
  <div class="auth-page">
    <section class="auth-hero">
      <BrandMark inverse />

      <div class="auth-hero-body">
        <div class="eyebrow">ИИ-агент · анализ оргструктуры</div>
        <h1>Сравните структуру до и&nbsp;после реорганизации</h1>
        <p class="lead">
          Агент сопоставляет положения, приказы и оргструктуры, находит потерю и дублирование функций
          и для каждого вывода указывает пункт исходного документа.
        </p>

        <ul class="features">
          <li>
            <span class="glass-tile"><Icon name="upload" /></span>
            <div><b>Комплекты «до» и «после»</b><span>Word, PDF и Excel</span></div>
          </li>
          <li>
            <span class="glass-tile"><Icon name="compare" /></span>
            <div><b>Сопоставление функций</b><span>Созданные, сохранённые и реорганизованные подразделения</span></div>
          </li>
          <li>
            <span class="glass-tile"><Icon name="file-search" /></span>
            <div><b>Выводы со ссылкой на источник</b><span>Документ, пункт и цитата</span></div>
          </li>
        </ul>
      </div>

      <div class="auth-hero-foot">
        <span>Выводы носят рекомендательный характер</span>
        <HealthStatus :health="health" inverse />
      </div>
    </section>

    <section class="auth-side">
      <div class="card auth-card">
        <h2>{{ mode === "signup" ? "Регистрация" : "Вход в систему" }}</h2>
        <p class="muted small subtitle">
          {{ mode === "signup" ? "Создайте учётную запись, чтобы запускать анализ." : "Войдите, чтобы продолжить работу с анализом." }}
        </p>

        <div class="segmented" role="tablist">
          <button type="button" role="tab" :aria-selected="mode === 'login'" :class="{ active: mode === 'login' }" @click="switchMode('login')">Вход</button>
          <button type="button" role="tab" :aria-selected="mode === 'signup'" :class="{ active: mode === 'signup' }" @click="switchMode('signup')">Регистрация</button>
        </div>

        <form class="auth-form" @submit.prevent="submit">
          <label v-if="mode === 'signup'" class="field">
            <span class="label">Имя</span>
            <span class="input-icon">
              <Icon name="user" class="icon-sm" />
              <input v-model="name" class="input input-lg" type="text" required maxlength="100" autocomplete="name" placeholder="Айгерим Сапарова" />
            </span>
          </label>
          <label class="field">
            <span class="label">Email</span>
            <span class="input-icon">
              <Icon name="mail" class="icon-sm" />
              <input v-model="email" class="input input-lg" type="email" required maxlength="254" autocomplete="email" placeholder="name@company.kz" />
            </span>
          </label>
          <label class="field">
            <span class="label">Пароль</span>
            <span class="input-icon">
              <Icon name="lock" class="icon-sm" />
              <input
                v-model="password"
                class="input input-lg password"
                :type="showPassword ? 'text' : 'password'"
                required
                :minlength="mode === 'signup' ? 8 : 1"
                maxlength="128"
                :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
              />
              <button
                type="button"
                class="btn btn-ghost btn-icon btn-sm reveal"
                :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
                @click="showPassword = !showPassword"
              >
                <Icon :name="showPassword ? 'eye-off' : 'eye'" class="icon-sm" />
              </button>
            </span>
            <span v-if="mode === 'signup'" class="help">Не короче 8 символов.</span>
          </label>

          <div v-if="error" class="alert alert-error" role="alert">
            <Icon name="alert-octagon" />
            <div>{{ error }}</div>
          </div>

          <button type="submit" class="btn btn-cta btn-lg btn-block" :disabled="busy">
            {{ busy ? "Подождите…" : mode === "signup" ? "Зарегистрироваться" : "Войти" }}
            <Icon v-if="!busy" name="arrow-right" />
          </button>
        </form>

        <p class="switch-hint small muted">
          <template v-if="mode === 'login'">Нет учётной записи? <a href="#" @click.prevent="switchMode('signup')">Зарегистрироваться</a></template>
          <template v-else>Уже есть учётная запись? <a href="#" @click.prevent="switchMode('login')">Войти</a></template>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(420px, 1fr); }

.auth-hero {
  position: relative; overflow: hidden; color: #fff; background: var(--grad-hero);
  display: flex; flex-direction: column; justify-content: space-between; gap: var(--sp-10);
  padding: var(--sp-10) var(--sp-12);
}
.auth-hero::before, .auth-hero::after { content: ""; position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.07); pointer-events: none; }
.auth-hero::before { width: 560px; height: 560px; right: -200px; top: -220px; }
.auth-hero::after { width: 380px; height: 380px; left: -140px; bottom: -200px; }
.auth-hero > * { position: relative; }
.auth-hero-body { max-width: 560px; }
.auth-hero .eyebrow { color: rgba(255, 255, 255, 0.8); }
.auth-hero h1 { color: #fff; font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 900; margin-top: var(--sp-3); }
.auth-hero .lead { color: rgba(255, 255, 255, 0.85); font-size: 17px; line-height: 27px; margin-top: var(--sp-4); }

.features { list-style: none; margin: var(--sp-8) 0 0; padding: 0; display: grid; gap: var(--sp-4); }
.features li { display: flex; gap: var(--sp-4); align-items: center; }
.features b { display: block; font-size: 15px; }
.features span:not(.glass-tile) { font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.glass-tile {
  width: 44px; height: 44px; border-radius: var(--r-md); flex: none; display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.22); color: #fff;
}
.glass-tile .icon { width: 22px; height: 22px; }

.auth-hero-foot {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); flex-wrap: wrap;
  font-size: 13px; color: rgba(255, 255, 255, 0.75); padding-top: var(--sp-4); border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.auth-side { display: grid; place-items: center; padding: var(--sp-10) var(--sp-6); background: var(--bg); }
.auth-card { width: 100%; max-width: 420px; padding: var(--sp-8); }
.subtitle { margin: var(--sp-1) 0 var(--sp-6); }

.segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; background: var(--surface-muted); border: 1px solid var(--line); border-radius: var(--r-md); margin-bottom: var(--sp-6); }
.segmented button {
  height: 36px; border: 0; border-radius: var(--r-sm); background: transparent; font: inherit; font-size: 14px; font-weight: 800;
  color: var(--ink-500); cursor: pointer; transition: background var(--t-fast), color var(--t-fast);
}
.segmented button:hover { color: var(--kt-blue-600); }
.segmented button.active { background: var(--surface); color: var(--kt-blue-600); box-shadow: var(--sh-1); }

.auth-form { display: grid; gap: var(--sp-4); }
.input-icon { display: block; }
.password { padding-right: 48px; }
.reveal { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--ink-500); }
.reveal .icon { position: static; transform: none; }
.auth-form .btn-cta { margin-top: var(--sp-2); }
.switch-hint { text-align: center; margin-top: var(--sp-5); }
.switch-hint a { font-weight: 700; }

@media (max-width: 960px) {
  .auth-page { grid-template-columns: 1fr; }
  .auth-hero { padding: var(--sp-8) var(--sp-6); gap: var(--sp-6); }
  .auth-hero h1 { font-size: 28px; line-height: 36px; }
  .features, .auth-hero-foot { display: none; }
  .auth-side { padding: var(--sp-6) var(--sp-4) var(--sp-10); }
}
</style>
