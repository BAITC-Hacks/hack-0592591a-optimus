<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import AuthPanel from "./AuthPanel.vue";
import BrandMark from "./BrandMark.vue";
import HealthStatus from "./HealthStatus.vue";
import Icon from "./Icon.vue";
import ClausePanel from "./components/ClausePanel.vue";
import Conclusion from "./components/Conclusion.vue";
import HistoryList from "./components/HistoryList.vue";
import MatchTable from "./components/MatchTable.vue";
import ProgressBar from "./components/ProgressBar.vue";
import RegulatoryTab from "./components/RegulatoryTab.vue";
import UploadPanel from "./components/UploadPanel.vue";
import SummaryView from "./results/SummaryView.vue";
import UnitPage from "./results/UnitPage.vue";
import { listAnalyses, pollAnalysis, startAnalysis, startDemo } from "./api.js";
import { SIDE } from "./domain.js";

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
const historyItems = ref([]); // the user's runs, newest first (GET /api/analyses)
const showHistory = ref(false);
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
const REJECTED = new Set(["irrelevant_document", "no_clauses", "incomplete_document", "no_functions"]);
const rejected = computed(() => REJECTED.has(analysis.value?.error?.code));
const analysisId = computed(() => analysis.value?._id || analysis.value?.analysis_id || "");
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
    if (user.value) loadHistory();
  } catch {
    user.value = null;
  } finally {
    sessionChecked.value = true;
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  user.value = null;
  historyItems.value = [];
  showHistory.value = false;
}

async function loadHistory() {
  if (!user.value) return;
  try {
    historyItems.value = (await listAnalyses()).items ?? [];
  } catch {
    // the list is a convenience; the current analysis does not depend on it
  }
}

function signedIn(u) {
  user.value = u;
  loadHistory();
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
  submitting.value = true; // progress card until the first snapshot arrives
  startClock();
  const controller = new AbortController();
  poller = controller;
  let first = true;
  try {
    await pollAnalysis(
      id,
      (doc) => {
        if (controller.signal.aborted) return; // another analysis was opened meanwhile
        if (first && doc.created_at) elapsed.value = Math.max(0, Math.round((Date.now() - new Date(doc.created_at)) / 1000));
        first = false;
        analysis.value = doc;
        submitting.value = false;
      },
      { signal: controller.signal },
    );
  } catch (err) {
    if (!controller.signal.aborted) error.value = err.message;
  } finally {
    if (!controller.signal.aborted) {
      submitting.value = false;
      stopClock();
      loadHistory();
    }
  }
}

async function run(starter) {
  poller?.abort();
  error.value = "";
  submitting.value = true;
  analysis.value = null;
  screen.value = "summary";
  showHistory.value = false;
  try {
    const { analysis_id } = await starter();
    loadHistory(); // the new run shows up in the list right away
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
  submitting.value = false;
  error.value = "";
  screen.value = "summary";
  selectedUnit.value = "";
  clauseTarget.value = null;
  showHistory.value = false;
  history.replaceState(null, "", location.pathname);
}

// A past run from the history list: done and failed ones load at once, a
// running one is followed like a fresh submission.
async function openAnalysis(id) {
  showHistory.value = false;
  if (analysisId.value === id && analysis.value) return;
  poller?.abort();
  stopClock();
  error.value = "";
  analysis.value = null;
  screen.value = "summary";
  selectedUnit.value = "";
  clauseTarget.value = null;
  window.scrollTo({ top: 0 });
  await follow(id);
}

function toggleHistory() {
  showHistory.value = !showHistory.value;
  if (showHistory.value) {
    loadHistory();
    window.scrollTo({ top: 0 });
  }
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
        <nav v-if="view === 'done' && !showHistory" class="segments" aria-label="Экраны результатов">
          <button v-for="[key, label] in SCREENS" :key="key" type="button" :class="{ active: screen === key }" @click="screen = key">{{ label }}</button>
        </nav>
        <div class="spacer" />
        <span v-if="view === 'done' && !showHistory" class="docs">{{ docPair }}</span>
        <HealthStatus v-else-if="!showHistory" :health="health" inverse />
        <div class="user">
          <span class="avatar">{{ initials }}</span>
          <span class="name">{{ user.name }}</span>
        </div>
        <button type="button" class="tb-btn ghost" :class="{ on: showHistory }" @click="toggleHistory"><Icon name="file-text" class="icon-sm" />История<span v-if="historyItems.length" class="count">{{ historyItems.length }}</span></button>
        <button v-if="view !== 'idle' || showHistory" type="button" class="tb-btn" @click="reset">Новый анализ</button>
        <button type="button" class="tb-btn ghost" @click="logout"><Icon name="log-out" class="icon-sm" />Выйти</button>
      </div>
    </header>

    <main class="wrap page">
      <div v-if="error" class="alert alert-error" role="alert">
        <Icon name="alert-octagon" />
        <div><b>Не удалось выполнить анализ.</b> {{ error }}</div>
        <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />Повторить</button></div>
      </div>

      <template v-if="showHistory">
        <section class="screen">
          <div class="screen-head">
            <h2>История анализов</h2>
            <span class="muted-s">{{ historyItems.length ? `${historyItems.length} ${historyItems.length === 1 ? "запуск" : historyItems.length < 5 ? "запуска" : "запусков"}` : "" }}</span>
          </div>
          <p v-if="!historyItems.length" class="empty">Пока нет ни одного анализа. Загрузите документы «до» и «после» реорганизации или запустите демо-пару.</p>
          <HistoryList v-else :items="historyItems" :active-id="analysisId" @open="openAnalysis" />
        </section>
      </template>

      <template v-else-if="view === 'idle'">
        <div class="intro">
          <div class="eyebrow-s">Рабочее место аналитика</div>
          <h1>Анализ организационной структуры</h1>
          <p>Загрузите положения, приказы или оргструктуры «до» и «после» реорганизации. Агент определит созданные и реорганизованные подразделения, сопоставит функции и покажет возможные потери, дублирования и конфликты с цитатами из документов.</p>
        </div>
        <UploadPanel :busy="submitting" @submit="onSubmit" @demo="onDemo" />
        <section v-if="historyItems.length" class="screen recent">
          <div class="screen-head">
            <h2>Недавние анализы</h2>
            <button v-if="historyItems.length > 5" type="button" class="link" @click="toggleHistory">Вся история →</button>
          </div>
          <HistoryList :items="historyItems" :limit="5" @open="openAnalysis" />
        </section>
      </template>

      <template v-else-if="view === 'running'">
        <ProgressBar :stage="analysis?.stage ?? 'queued'" :status="analysis?.status ?? 'running'" :elapsed="elapsed" />
      </template>

      <template v-else-if="view === 'failed'">
        <section class="fail panel" :class="{ soft: rejected }" role="alert">
          <div class="fail-icon"><Icon :name="rejected ? 'file-search' : 'alert-octagon'" /></div>
          <div class="fail-body">
            <div class="eyebrow-s">{{ rejected ? "Проверка входных документов" : "Анализ остановлен" }}</div>
            <h2>{{ rejected ? "Документы не подходят для анализа" : "Анализ завершился с ошибкой" }}</h2>
            <p>{{ analysis.error?.message || "Причина не указана." }}</p>
            <ul v-if="analysis.inputs?.length" class="fail-files">
              <li v-for="f in analysis.inputs" :key="f.side + f.filename" :class="{ bad: analysis.error?.filename?.includes(f.filename) }">
                <span class="side">{{ SIDE[f.side] || f.side }}</span>{{ f.filename }}
              </li>
            </ul>
            <div class="fail-actions">
              <button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />{{ rejected ? "Загрузить другие документы" : "Начать заново" }}</button>
            </div>
          </div>
        </section>
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

  <AuthPanel v-else-if="sessionChecked" :health="health" @signed-in="signedIn" />

  <div v-else class="boot">
    <BrandMark />
    <p class="muted small">Проверка сессии…</p>
  </div>
</template>

<style scoped>
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.topbar { position: sticky; top: 0; z-index: 20; background: var(--navy); color: var(--white); }
.topbar .wrap { height: 60px; display: flex; align-items: center; gap: 24px; }
.segments { display: flex; gap: 2px; padding: 3px; background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
.segments button { white-space: nowrap; padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.78); cursor: pointer; }
.segments button.active { background: var(--white); color: var(--navy); }
.spacer { flex: 1; }
.docs { font-size: 13px; color: rgba(255, 255, 255, 0.66); max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.user .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, 0.14); color: var(--white); font-weight: 700; font-size: 12px; }
.user .name { color: rgba(255, 255, 255, 0.86); font-weight: 600; }
.tb-btn { white-space: nowrap; height: 36px; padding: 0 14px; border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 9px; background: transparent; color: var(--white); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.tb-btn.ghost { border-color: transparent; color: rgba(255, 255, 255, 0.78); }
.tb-btn:hover { background: rgba(255, 255, 255, 0.1); }
.tb-btn.on { background: rgba(255, 255, 255, 0.14); color: var(--white); }
.tb-btn .count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: rgba(255, 255, 255, 0.18); font-size: 11px; line-height: 18px; text-align: center; }
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
.muted-s { font-size: 13px; color: var(--muted); }
.empty { margin: 0; padding: 32px; border: 1px dashed var(--line-2); border-radius: 16px; color: var(--text-2); font-size: 14px; line-height: 22px; text-align: center; }
.recent { padding-top: 40px; }
.fail { display: flex; gap: 20px; margin-top: 32px; padding: 28px 32px; border-left: 4px solid var(--c-loss); }
.fail.soft { border-left-color: var(--c-dup); }
.fail-icon { flex: none; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--c-loss-bg); color: var(--c-loss-text); }
.fail.soft .fail-icon { background: var(--c-dup-bg); color: var(--c-dup-text); }
.fail-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fail-body h2 { margin: 0; font-family: var(--font-display); font-size: 22px; line-height: 30px; font-weight: 800; color: var(--navy); }
.fail-body p { margin: 0; font-size: 15px; line-height: 24px; color: var(--text); max-width: 760px; }
.fail-files { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.fail-files li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; background: var(--chip); font-size: 13px; font-weight: 600; }
.fail-files li.bad { background: var(--c-dup-bg); color: var(--c-dup-text); }
.fail-files .side { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.fail-actions { margin-top: 6px; }
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
