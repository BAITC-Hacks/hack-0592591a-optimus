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
      <BrandMark />

      <div class="auth-hero-body">
        <div class="eyebrow">ИИ-агент · анализ оргструктуры</div>
        <h1>Сравните структуру до и&nbsp;после реорганизации</h1>
        <p class="lead">
          Агент сопоставляет положения, приказы и оргструктуры, находит потерю и дублирование функций
          и для каждого вывода указывает пункт исходного документа.
        </p>

        <ul class="features">
          <li>
            <span class="paper-tile"><Icon name="upload" /></span>
            <div><b>Комплекты «до» и «после»</b><span>Word, PDF и Excel</span></div>
          </li>
          <li>
            <span class="paper-tile"><Icon name="compare" /></span>
            <div><b>Сопоставление функций</b><span>Созданные, сохранённые и реорганизованные подразделения</span></div>
          </li>
          <li>
            <span class="paper-tile"><Icon name="file-search" /></span>
            <div><b>Выводы со ссылкой на источник</b><span>Документ, пункт и цитата</span></div>
          </li>
        </ul>
      </div>

      <div class="auth-hero-foot">
        <span>Выводы носят рекомендательный характер</span>
        <HealthStatus :health="health" />
      </div>
    </section>

    <section class="auth-side">
      <div class="card auth-card">
        <h2>{{ mode === "signup" ? "Регистрация" : "Вход в систему" }}</h2>
        <p class="muted small subtitle">
          {{ mode === "signup" ? "Создайте учётную запись, чтобы запускать анализ." : "Войдите, чтобы продолжить работу с анализом." }}
        </p>

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

      </div>
    </section>
  </div>
</template>

<style scoped>
/* Paper / report style: cream page, white sheet with hairlines, serif display, teal accent. */
.auth-page {
  min-height: 100vh; background: var(--page);
  display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(360px, 1fr);
  gap: var(--sp-6); align-items: start;
  width: 100%; max-width: 1160px; margin: 0 auto;
  padding: var(--sp-10) var(--sp-6) var(--sp-16);
}

.auth-hero {
  color: var(--text); background: var(--panel);
  border: 1px solid var(--panel-line); border-radius: 6px; box-shadow: var(--sh-panel);
  display: flex; flex-direction: column; justify-content: space-between; gap: var(--sp-10);
  padding: var(--sp-12); min-height: calc(100vh - var(--sp-10) - var(--sp-16));
}
.auth-hero :deep(.brand) { color: var(--accent); }
.auth-hero :deep(.brand-sub) { color: var(--muted); }
.auth-hero :deep(.brand-mark circle:nth-of-type(1)) { fill: var(--accent); }
.auth-hero-body { max-width: 560px; }
.auth-hero .eyebrow { color: var(--muted); }
.auth-hero h1 {
  color: var(--navy); font-family: var(--font-display); font-weight: 700;
  font-size: 34px; line-height: 44px; margin-top: var(--sp-3);
}
.auth-hero .lead { color: var(--text-2); font-size: 16px; line-height: 26px; margin-top: var(--sp-4); }

.features { list-style: none; margin: var(--sp-8) 0 0; padding: 0; }
.features li { display: flex; gap: var(--sp-4); align-items: center; padding: var(--sp-4) 0; border-top: 1px solid var(--panel-line); }
.features b { display: block; font-size: 15px; color: var(--text); }
.features span:not(.paper-tile) { font-size: 13px; color: var(--muted); }
.paper-tile {
  width: 40px; height: 40px; border-radius: 8px; flex: none; display: grid; place-items: center;
  background: var(--chip); color: var(--accent);
}
.paper-tile .icon { width: 20px; height: 20px; }

.auth-hero-foot {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); flex-wrap: wrap;
  font-size: 13px; color: var(--muted); padding-top: var(--sp-4); border-top: 1px solid var(--panel-line);
}
.auth-hero-foot :deep(.health) { background: var(--chip); border-color: var(--panel-line); color: var(--muted); }

.auth-side { display: grid; align-content: start; }
.card.auth-card {
  width: 100%; max-width: none; padding: var(--sp-6);
  background: var(--panel); border: 1px solid var(--panel-line); border-radius: 10px; box-shadow: var(--sh-panel);
}
.auth-card h2 { font-size: 18px; line-height: 26px; font-weight: 800; color: var(--text); }
.auth-card .muted { color: var(--muted); }
.subtitle { margin: var(--sp-1) 0 var(--sp-6); }

.auth-form { display: grid; gap: var(--sp-4); }
.auth-form .label {
  font-size: 11px; line-height: 16px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
}
.auth-form .input {
  background: var(--white); border: 1px solid var(--line-2); border-radius: 8px;
  box-shadow: none; color: var(--text);
}
.auth-form .input::placeholder { color: var(--muted); }
.auth-form .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15, 92, 90, 0.18); }
.auth-form .help { color: var(--muted); }
.input-icon { display: block; }
.input-icon .icon { color: var(--muted); }
.password { padding-right: 48px; }
.reveal { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.reveal:hover { background: var(--chip); color: var(--accent); }
.reveal .icon { position: static; transform: none; }
.auth-form .alert-error { background: var(--c-loss-bg); border-color: #EFC7C2; color: var(--c-loss-text); border-radius: 8px; }
.auth-form .alert-error .icon { color: var(--c-loss); }
.auth-form .btn-cta { margin-top: var(--sp-2); background: var(--accent); color: #fff; box-shadow: none; border-radius: 8px; font-weight: 700; }
.auth-form .btn-cta:hover { background: #0C4B49; }
.auth-page :focus-visible { box-shadow: 0 0 0 3px rgba(15, 92, 90, 0.3); }

@media (max-width: 960px) {
  .auth-page { grid-template-columns: 1fr; padding: var(--sp-6) var(--sp-4) var(--sp-10); gap: var(--sp-4); }
  .auth-hero { padding: var(--sp-8) var(--sp-6); gap: var(--sp-6); min-height: 0; }
  .auth-hero h1 { font-size: 26px; line-height: 34px; }
  .features, .auth-hero-foot { display: none; }
}
</style>
