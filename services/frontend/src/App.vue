<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import AuthPanel from "./AuthPanel.vue";
import BrandMark from "./BrandMark.vue";
import HealthStatus from "./HealthStatus.vue";
import Icon from "./Icon.vue";
import ClausePanel from "./components/ClausePanel.vue";
import Conclusion from "./components/Conclusion.vue";
import MatchTable from "./components/MatchTable.vue";
import ProgressBar from "./components/ProgressBar.vue";
import RegulatoryTab from "./components/RegulatoryTab.vue";
import UploadPanel from "./components/UploadPanel.vue";
import SummaryView from "./results/SummaryView.vue";
import UnitPage from "./results/UnitPage.vue";
import { pollAnalysis, startAnalysis, startDemo } from "./api.js";

const health = ref({ state: "checking", text: "проверка…" });
const user = ref(null);
const sessionChecked = ref(false);

// Analysis flow: idle → running → done | failed
const analysis = ref(null); // the API document
const submitting = ref(false);
const error = ref("");
const screen = ref("summary"); // summary | units | regulatory | conclusion | matches
const selectedUnit = ref("");
const clauseTarget = ref(null);
const elapsed = ref(0);
let timer = null;
let poller = null;

const initials = computed(() =>
  (user.value?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join(""),
);
const view = computed(() => {
  if (!analysis.value) return submitting.value ? "running" : "idle";
  return analysis.value.status === "done" ? "done" : analysis.value.status === "failed" ? "failed" : "running";
});
const stats = computed(() => analysis.value?.stats ?? {});
const docPair = computed(() => {
  const docs = analysis.value?.documents ?? [];
  const name = (side) => docs.filter((d) => d.side === side).map((d) => d.filename).join(", ");
  return docs.length ? `${name("before")} → ${name("after")}` : "";
});
const SCREENS = [
  ["summary", "Итог"],
  ["units", "Подразделения"],
  ["regulatory", "Нормативные требования"],
  ["conclusion", "Заключение"],
];

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    health.value = res.ok
      ? { state: "ok", text: `${data.status}, БД: ${data.db}, модель: ${data.llm === "configured" ? "настроена" : "не настроена"}` }
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

function startClock() {
  stopClock();
  elapsed.value = 0;
  timer = setInterval(() => elapsed.value++, 1000);
}
function stopClock() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function follow(id) {
  location.hash = id;
  startClock();
  poller = new AbortController();
  try {
    await pollAnalysis(id, (doc) => (analysis.value = doc), { signal: poller.signal });
  } catch (err) {
    error.value = err.message;
  } finally {
    stopClock();
  }
}

async function run(starter) {
  error.value = "";
  submitting.value = true;
  analysis.value = null;
  screen.value = "summary";
  try {
    const { analysis_id } = await starter();
    submitting.value = false;
    await follow(analysis_id);
  } catch (err) {
    error.value = err.message;
    submitting.value = false;
  }
}

const onSubmit = (files) => run(() => startAnalysis(files));
const onDemo = () => run(startDemo);

function reset() {
  poller?.abort();
  stopClock();
  analysis.value = null;
  error.value = "";
  screen.value = "summary";
  history.replaceState(null, "", location.pathname);
}

function showUnits(label) {
  if (typeof label === "string") selectedUnit.value = label;
  screen.value = "units";
  window.scrollTo({ top: 0 });
}

function downloadConclusion() {
  const id = analysis.value?._id || analysis.value?.analysis_id || "analysis";
  const blob = new Blob([analysis.value?.conclusion_md ?? ""], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zaklyuchenie-${id}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadHealth();
  loadSession();
  const id = location.hash.slice(1);
  if (/^a_[0-9a-f]{12}$/.test(id)) follow(id);
});
onUnmounted(stopClock);
</script>

<template>
  <template v-if="user">
    <header class="topbar">
      <div class="wrap">
        <BrandMark inverse />
        <nav v-if="view === 'done'" class="segments" aria-label="Экраны результатов">
          <button v-for="[key, label] in SCREENS" :key="key" type="button" :class="{ active: screen === key }" @click="screen = key">{{ label }}</button>
        </nav>
        <div class="spacer" />
        <span v-if="view === 'done'" class="docs">{{ docPair }}</span>
        <HealthStatus v-else :health="health" inverse />
        <div class="user">
          <span class="avatar">{{ initials }}</span>
          <span class="name">{{ user.name }}</span>
        </div>
        <button v-if="view === 'done'" type="button" class="tb-btn" @click="reset">Новый анализ</button>
        <button type="button" class="tb-btn ghost" @click="logout"><Icon name="log-out" class="icon-sm" />Выйти</button>
      </div>
    </header>

    <main class="wrap page">
      <div v-if="error" class="alert alert-error" role="alert">
        <Icon name="alert-octagon" />
        <div><b>Не удалось выполнить анализ.</b> {{ error }}</div>
        <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />Повторить</button></div>
      </div>

      <template v-if="view === 'idle'">
        <div class="intro">
          <div class="eyebrow-s">Рабочее место аналитика</div>
          <h1>Анализ организационной структуры</h1>
          <p>Загрузите положения, приказы или оргструктуры «до» и «после» реорганизации. Агент определит созданные и реорганизованные подразделения, сопоставит функции и покажет возможные потери, дублирования и конфликты с цитатами из документов.</p>
        </div>
        <UploadPanel :busy="submitting" @submit="onSubmit" @demo="onDemo" />
      </template>

      <template v-else-if="view === 'running'">
        <ProgressBar :stage="analysis?.stage ?? 'queued'" :status="analysis?.status ?? 'running'" :elapsed="elapsed" />
      </template>

      <template v-else-if="view === 'failed'">
        <div class="alert alert-error" role="alert">
          <Icon name="alert-octagon" />
          <div><b>Анализ завершился с ошибкой.</b> {{ analysis.error?.message || "Причина не указана." }}</div>
          <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />Начать заново</button></div>
        </div>
      </template>

      <template v-else>
        <SummaryView
          v-if="screen === 'summary'"
          :analysis="analysis"
          @open-clause="clauseTarget = $event"
          @show-units="showUnits"
          @show-conclusion="screen = 'conclusion'"
          @show-matches="screen = 'matches'"
          @download="downloadConclusion"
        />
        <UnitPage v-else-if="screen === 'units'" :analysis="analysis" :selected="selectedUnit" @select="selectedUnit = $event" @open-clause="clauseTarget = $event" />
        <section v-else-if="screen === 'regulatory'" class="screen">
          <h2>Нормативные требования</h2>
          <div class="panel pad"><RegulatoryTab :findings="analysis.regulatory ?? []" :stats="stats" :documents="analysis.documents ?? []" @open-clause="clauseTarget = $event" /></div>
        </section>
        <section v-else-if="screen === 'matches'" class="screen">
          <div class="screen-head">
            <h2>Все сопоставления функций</h2>
            <button type="button" class="link" @click="screen = 'summary'">← К итогу</button>
          </div>
          <MatchTable :functions="analysis.functions" :matches="analysis.matches" @open-clause="clauseTarget = $event" />
        </section>
        <section v-else class="screen">
          <Conclusion :markdown="analysis.conclusion_md" :analysis-id="analysis._id || analysis.analysis_id || 'analysis'" />
        </section>
      </template>
    </main>

    <ClausePanel v-if="clauseTarget && analysis?.documents" :documents="analysis.documents" :target="clauseTarget" @close="clauseTarget = null" />
  </template>

  <AuthPanel v-else-if="sessionChecked" :health="health" @signed-in="user = $event" />

  <div v-else class="boot">
    <BrandMark />
    <p class="muted small">Проверка сессии…</p>
  </div>
</template>

<style scoped>
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.topbar { position: sticky; top: 0; z-index: 20; background: var(--navy); color: #fff; }
.topbar .wrap { height: 60px; display: flex; align-items: center; gap: 24px; }
.segments { display: flex; gap: 2px; padding: 3px; background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
.segments button { white-space: nowrap; padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.78); cursor: pointer; }
.segments button.active { background: #fff; color: var(--navy); }
.spacer { flex: 1; }
.docs { font-size: 13px; color: rgba(255, 255, 255, 0.66); max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.user .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, 0.14); color: #fff; font-weight: 700; font-size: 12px; }
.user .name { color: rgba(255, 255, 255, 0.86); font-weight: 600; }
.tb-btn { white-space: nowrap; height: 36px; padding: 0 14px; border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 9px; background: transparent; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.tb-btn.ghost { border-color: transparent; color: rgba(255, 255, 255, 0.78); }
.tb-btn:hover { background: rgba(255, 255, 255, 0.1); }
.page { padding-top: 0; padding-bottom: 48px; display: flex; flex-direction: column; gap: 24px; }
.page > .alert { margin-top: 24px; }
.intro { display: flex; flex-direction: column; gap: 10px; padding: 44px 0 4px; max-width: 760px; }
.intro h1 { margin: 0; font-family: var(--font-display); font-size: 40px; line-height: 48px; font-weight: 800; letter-spacing: -0.02em; color: var(--navy); }
.intro p { margin: 0; font-size: 16px; line-height: 26px; color: var(--text-2); }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.screen { display: flex; flex-direction: column; gap: 16px; padding: 32px 0 0; }
.screen h2 { margin: 0; font-family: var(--font-display); font-size: 24px; line-height: 32px; font-weight: 800; color: var(--navy); }
.screen-head { display: flex; align-items: baseline; justify-content: space-between; }
.panel { background: var(--panel); border: 1px solid var(--panel-line); border-radius: 16px; box-shadow: var(--sh-panel); }
.panel.pad { padding: 20px; }
.link { border: 0; background: transparent; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); cursor: pointer; }
.boot { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: var(--sp-4); }
main.page > :deep(.upload-card) { margin-top: 16px; }
main.page > :deep(.progress-card) { margin-top: 32px; }
@media (max-width: 900px) {
  .wrap { padding: 0 16px; }
  .topbar .wrap { gap: 12px; }
  .segments { order: 10; width: 100%; overflow-x: auto; }
  .topbar .wrap { flex-wrap: wrap; height: auto; padding-top: 10px; padding-bottom: 10px; }
  .docs, .user .name { display: none; }
  .intro h1 { font-size: 30px; line-height: 38px; }
}
</style>
