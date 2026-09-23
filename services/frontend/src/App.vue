<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import AuthPanel from "./AuthPanel.vue";
import BrandMark from "./BrandMark.vue";
import HealthStatus from "./HealthStatus.vue";
import Icon from "./Icon.vue";
import ClausePanel from "./components/ClausePanel.vue";
import Conclusion from "./components/Conclusion.vue";
import FindingCard from "./components/FindingCard.vue";
import MatchTable from "./components/MatchTable.vue";
import ProgressBar from "./components/ProgressBar.vue";
import UnitsTable from "./components/UnitsTable.vue";
import UploadPanel from "./components/UploadPanel.vue";
import { pollAnalysis, startAnalysis, startDemo } from "./api.js";
import { FINDING_TYPE, PRIMARY_FINDINGS, SECONDARY_FINDINGS } from "./domain.js";

const health = ref({ state: "checking", text: "проверка…" });
const user = ref(null);
const sessionChecked = ref(false);

// Analysis flow: idle → running → done | failed
const analysis = ref(null); // the API document
const submitting = ref(false);
const error = ref("");
const tab = ref("findings");
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
const primary = computed(() => (analysis.value?.findings ?? []).filter((f) => PRIMARY_FINDINGS.includes(f.type)));
const secondary = computed(() => (analysis.value?.findings ?? []).filter((f) => SECONDARY_FINDINGS.includes(f.type)));
const counts = computed(() => {
  const c = {};
  for (const f of analysis.value?.findings ?? []) c[f.type] = (c[f.type] || 0) + 1;
  return c;
});
const TABS = [
  ["units", "Подразделения"],
  ["matches", "Сопоставление функций"],
  ["findings", "Отклонения"],
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
  tab.value = "findings";
  history.replaceState(null, "", location.pathname);
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
          <button type="button" class="btn btn-ghost btn-sm" @click="logout"><Icon name="log-out" class="icon-sm" />Выйти</button>
        </div>
      </div>
    </header>

    <main class="container page stack">
      <div class="page-head row-between">
        <div>
          <div class="eyebrow">Рабочее место аналитика</div>
          <h1>Анализ <span class="accent">организационной</span> структуры</h1>
        </div>
        <div class="stepper" aria-label="Этапы">
          <span class="s" :class="{ done: view !== 'idle', active: view === 'idle' }"><span class="n">1</span>Загрузка</span>
          <span class="line" :class="{ done: view !== 'idle' }" />
          <span class="s" :class="{ done: view === 'done', active: view === 'running' }"><span class="n">2</span>Анализ</span>
          <span class="line" :class="{ done: view === 'done' }" />
          <span class="s" :class="{ active: view === 'done' }"><span class="n">3</span>Результаты</span>
        </div>
      </div>

      <div v-if="error" class="alert alert-error" role="alert">
        <Icon name="alert-octagon" />
        <div><b>Не удалось выполнить анализ.</b> {{ error }}</div>
        <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />Повторить</button></div>
      </div>

      <UploadPanel v-if="view === 'idle'" :busy="submitting" @submit="onSubmit" @demo="onDemo" />

      <template v-else-if="view === 'running'">
        <ProgressBar :stage="analysis?.stage ?? 'queued'" :status="analysis?.status ?? 'running'" :elapsed="elapsed" />
        <div class="card skeletons" aria-hidden="true">
          <div class="skeleton" style="width: 40%" />
          <div class="skeleton" />
          <div class="skeleton" style="width: 85%" />
          <div class="skeleton" style="width: 60%" />
        </div>
      </template>

      <template v-else-if="view === 'failed'">
        <div class="alert alert-error" role="alert">
          <Icon name="alert-octagon" />
          <div><b>Анализ завершился с ошибкой.</b> {{ analysis.error?.message || "Причина не указана." }}</div>
          <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="reset"><Icon name="refresh-cw" class="icon-sm" />Начать заново</button></div>
        </div>
      </template>

      <template v-else>
        <div class="alert alert-advisory" role="note">
          <Icon name="info" />
          <div><b>Выводы носят рекомендательный характер.</b> Каждый вывод подтверждён фрагментом исходного документа и требует проверки ответственным сотрудником.</div>
        </div>

        <div class="grid grid-4 kpis">
          <div class="card kpi">
            <div class="tile tile-soft"><Icon name="layers" /></div>
            <div><div class="value tnum">{{ stats.units_before ?? 0 }} → {{ stats.units_after ?? 0 }}</div><div class="label-k">Подразделений до → после</div><div class="delta">создано {{ stats.created ?? 0 }}, реорганизовано {{ stats.reorganized ?? 0 }}</div></div>
          </div>
          <div class="card kpi">
            <div class="tile tile-loss"><Icon name="alert-octagon" /></div>
            <div><div class="value tnum">{{ counts.POTENTIAL_LOSS ?? 0 }}</div><div class="label-k">Возможные потери функций</div><div class="delta">из {{ stats.functions_before ?? 0 }} функций «до»</div></div>
          </div>
          <div class="card kpi">
            <div class="tile tile-dup"><Icon name="copy" /></div>
            <div><div class="value tnum">{{ counts.POTENTIAL_DUPLICATION ?? 0 }}</div><div class="label-k">Возможные дублирования</div><div class="delta">пересечений общей и частной нормы: {{ counts.OVERLAP ?? 0 }}</div></div>
          </div>
          <div class="card kpi">
            <div class="tile tile-conflict"><Icon name="scale" /></div>
            <div><div class="value tnum">{{ counts.POTENTIAL_CONFLICT ?? 0 }}</div><div class="label-k">Возможные конфликты</div><div class="delta">кандидатов отклонено моделью: {{ stats.conflict_candidates_rejected ?? 0 }}</div></div>
          </div>
        </div>

        <div class="info-bar">
          <div class="tile tile-sm"><Icon name="file-search" /></div>
          <div class="info-text">
            {{ analysis.documents.map((d) => d.filename).join(" · ") }}
            <span class="muted">· {{ stats.llm_calls }} обращений к модели · {{ Math.round((stats.duration_ms ?? 0) / 1000) }} с · цитат отклонено проверкой: {{ stats.dropped_unverified ?? 0 }}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="reset"><Icon name="upload" class="icon-sm" />Новый анализ</button>
        </div>

        <div class="card results">
          <nav class="tabs" role="tablist">
            <a v-for="[key, label] in TABS" :key="key" href="#" role="tab" :aria-selected="tab === key" :class="{ active: tab === key }" @click.prevent="tab = key">{{ label }}</a>
          </nav>
          <div class="tab-body">
            <UnitsTable v-if="tab === 'units'" :units="analysis.units" :changes="analysis.unit_changes" @open-clause="clauseTarget = $event" />
            <MatchTable v-else-if="tab === 'matches'" :functions="analysis.functions" :matches="analysis.matches" @open-clause="clauseTarget = $event" />
            <div v-else-if="tab === 'findings'" class="stack">
              <div v-if="!analysis.findings.length" class="empty">
                <div class="tile tile-lg tile-soft"><Icon name="check-circle" /></div>
                <h3>Отклонений не найдено</h3>
                <p class="muted">Все функции «до» нашли эквивалент в документах «после».</p>
              </div>
              <FindingCard v-for="finding in primary" :key="finding.finding_id" :finding="finding" :documents="analysis.documents" @open-clause="clauseTarget = $event" />
              <details v-if="secondary.length" class="finding-group">
                <summary><Icon name="chevron-down" class="icon-sm" /> Перераспределённые функции, пересечения общей и частной нормы, примечания ({{ secondary.length }}) — низкая важность</summary>
                <div class="group-body">
                  <FindingCard v-for="finding in secondary" :key="finding.finding_id" :finding="finding" :documents="analysis.documents" @open-clause="clauseTarget = $event" />
                </div>
              </details>
            </div>
            <Conclusion v-else :markdown="analysis.conclusion_md" :analysis-id="analysis._id || analysis.analysis_id || 'analysis'" />
          </div>
        </div>
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
.header-spacer { flex: 1; }
.who { display: flex; flex-direction: column; line-height: 1.25; }
.who b { font-size: 14px; color: var(--ink-900); }
.who span { font-size: 12px; color: var(--ink-500); }
.page-head { flex-wrap: wrap; }
.kpis .kpi { align-items: center; }
.kpis .value { font-size: 28px; line-height: 34px; }
.skeletons { display: grid; gap: var(--sp-3); }
.results { padding: 0; }
.results .tabs { padding: 0 var(--sp-5); }
.tab-body { padding: var(--sp-5); }
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding: var(--sp-10) var(--sp-6); }
.boot { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: var(--sp-4); }
@media (max-width: 720px) {
  .who, .header-actions .health, .header-actions .divider-v { display: none; }
  .page-head .stepper { display: none; }
}
</style>
