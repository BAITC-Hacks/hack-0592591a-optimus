<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AuthPanel from "./AuthPanel.vue";
import BrandMark from "./BrandMark.vue";
import Icon from "./Icon.vue";
import ClausePanel from "./components/ClausePanel.vue";
import Conclusion from "./components/Conclusion.vue";
import FindingRow from "./results/FindingRow.vue";
import HistoryList from "./components/HistoryList.vue";
import MatchTable from "./components/MatchTable.vue";
import ProgressBar from "./components/ProgressBar.vue";
import RegulatoryTab from "./components/RegulatoryTab.vue";
import UploadPanel from "./components/UploadPanel.vue";
import SummaryView from "./results/SummaryView.vue";
import UnitPage from "./results/UnitPage.vue";
import { listAnalyses, pollAnalysis, startAnalysis, startDemo } from "./api.js";
import { downloadDocx } from "./export.js";
import { SIDE } from "./domain.js";
import { recommendations, sortFindings } from "./results/text.js";

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
// Finished runs never change, so reopening one from the history or the logo needs no request.
const finished = new Map(); // analysis id → final API document

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
  ["summary", "Обзор"],
  ["units", "Структура"],
  ["losses", "Потеря функций"],
  ["dups", "Дублирование и конфликты"],
  ["conclusion", "Заключение"],
  ["recs", "Рекомендации"],
];
const sortedFindings = computed(() => sortFindings(analysis.value?.findings ?? []));
const lossFindings = computed(() => sortedFindings.value.filter((f) => f.type === "POTENTIAL_LOSS"));
const dupFindings = computed(() => sortedFindings.value.filter((f) => ["POTENTIAL_DUPLICATION", "POTENTIAL_CONFLICT", "OVERLAP"].includes(f.type)));
const recs = computed(() => recommendations(analysis.value?.conclusion_md));
const module = ref("recs"); // recs | regulatory (design: «Дополнительные проверки»)
const regulatoryCount = computed(() => (analysis.value?.regulatory ?? []).length);

// The open screen survives a reload: the hash holds the analysis id, sessionStorage the
// screen, unit and module inside it. Per tab and a convenience only, so failures are ignored.
const VIEW_KEY = "orgscope:view";
const SCREEN_KEYS = new Set([...SCREENS.map(([key]) => key), "matches"]);
watch([analysisId, screen, selectedUnit, module], ([id]) => {
  if (!id) return;
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ id, screen: screen.value, unit: selectedUnit.value, module: module.value }));
  } catch {}
});
function restoreView(id) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
    if (saved?.id !== id) return;
    if (SCREEN_KEYS.has(saved.screen)) screen.value = saved.screen;
    if (typeof saved.unit === "string") selectedUnit.value = saved.unit;
    if (saved.module === "recs" || saved.module === "regulatory") module.value = saved.module;
  } catch {}
}

// The logo leads to the newest finished report, or to a new analysis when there is none.
const lastDoneId = computed(() => historyItems.value.find((item) => item.status === "done")?._id || "");

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
        if (doc.status === "done" || doc.status === "failed") finished.set(id, doc);
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
  const cached = finished.get(id);
  if (cached) {
    location.hash = id;
    analysis.value = cached;
    return;
  }
  await follow(id);
}

function goHome() {
  if (!lastDoneId.value) return reset();
  showHistory.value = false;
  screen.value = "summary";
  window.scrollTo({ top: 0 });
  openAnalysis(lastDoneId.value);
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

const notice = ref("");
const exportSubtitle = computed(() => {
  const at = analysis.value?.finished_at ? new Date(analysis.value.finished_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return [docPair.value, at ? `сформировано ${at}` : ""].filter(Boolean).join(" · ");
});
// «Скачать заключение» on the overview: DOCX; PDF and Markdown are on the Заключение screen.
async function downloadConclusion() {
  notice.value = "";
  try {
    await downloadDocx({ markdown: analysis.value?.conclusion_md ?? "", analysisId: analysisId.value || "analysis", subtitle: exportSubtitle.value });
  } catch (err) {
    notice.value = `Не удалось подготовить файл: ${err.message}`;
  }
}

onMounted(() => {
  loadHealth();
  loadSession();
  const id = location.hash.slice(1);
  if (/^a_[0-9a-f]{12}$/.test(id)) {
    restoreView(id);
    follow(id);
  }
});
onUnmounted(stopClock);
</script>

<template>
  <template v-if="user">
    <header class="topbar">
      <div class="wrap">
        <button type="button" class="home" title="На главную" @click="reset"><BrandMark /></button>
        <div class="spacer" />
        <span v-if="view === 'done' && !showHistory" class="docs" :title="docPair">{{ docPair }}</span>
        <button type="button" class="tb-btn ghost" :class="{ on: showHistory }" @click="toggleHistory"><Icon name="file-text" class="icon-sm" />История<span v-if="historyItems.length" class="count">{{ historyItems.length }}</span></button>
        <button v-if="view !== 'idle' || showHistory" type="button" class="tb-btn primary" @click="reset">Новый анализ</button>
        <div class="user" :title="user.name"><span class="avatar">{{ initials }}</span></div>
        <button type="button" class="tb-btn ghost" @click="logout"><Icon name="log-out" class="icon-sm" />Выйти</button>
      </div>
      <nav v-if="view === 'done' && !showHistory" class="tabbar" aria-label="Экраны результатов">
        <div class="wrap tabs">
          <button v-for="[key, label] in SCREENS" :key="key" type="button" :class="{ active: screen === key }" @click="screen = key">{{ label }}</button>
        </div>
      </nav>
    </header>

    <main class="wrap page">
      <div v-if="notice" class="alert alert-error" role="alert">
        <Icon name="alert-octagon" />
        <div>{{ notice }}</div>
        <div class="alert-actions"><button type="button" class="btn btn-outline btn-sm" @click="notice = ''">Закрыть</button></div>
      </div>
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
          @show-losses="screen = 'losses'"
          @show-dups="screen = 'dups'"
          @download="downloadConclusion"
        />
        <UnitPage v-else-if="screen === 'units'" :analysis="analysis" :selected="selectedUnit" @select="selectedUnit = $event" @open-clause="clauseTarget = $event" />
        <section v-else-if="screen === 'losses'" class="screen">
          <div class="screen-head">
            <div><h2>Потеря функций</h2><p class="sub">Каждая функция из действующих положений сверена с новыми. Не найденные — вверху; строка раскрывается в цитаты «было» и «стало».</p></div>
            <button type="button" class="link" @click="screen = 'matches'">Все сопоставления · {{ (analysis.matches ?? []).length }}</button>
          </div>
          <div v-if="!lossFindings.length" class="panel pad empty">Все функции редакции «до» нашли эквивалент в новых документах.</div>
          <div v-else class="panel list"><FindingRow v-for="(f, i) in lossFindings" :key="f.finding_id" :finding="f" :documents="analysis.documents" :index="i + 1" :open="i === 0" @open-clause="clauseTarget = $event" /></div>
        </section>
        <section v-else-if="screen === 'dups'" class="screen">
          <div class="screen-head">
            <div><h2>Дублирование и конфликты</h2><p class="sub">Функции новой структуры с двумя владельцами, пересечения общей и частной нормы и сочетание исполнения с контролем в одном подразделении.</p></div>
          </div>
          <div v-if="!dupFindings.length" class="panel pad empty">Признаков дублирования и конфликта интересов не найдено.</div>
          <div v-else class="panel list"><FindingRow v-for="(f, i) in dupFindings" :key="f.finding_id" :finding="f" :documents="analysis.documents" :index="i + 1" :open="i === 0" @open-clause="clauseTarget = $event" /></div>
        </section>
        <section v-else-if="screen === 'recs'" class="screen">
          <div class="screen-head"><div><h2>Рекомендации и дополнительные проверки</h2><p class="sub">Каждый модуль работает на тех же выводах и тоже ссылается на источники.</p></div></div>
          <div class="modules">
            <button type="button" class="panel module" :class="{ active: module === 'recs' }" @click="module = 'recs'"><b>Рекомендации <span class="mtag">{{ recs.length }} предложений</span></b><span>Перераспределение функций и устранение пересечений</span></button>
            <button type="button" class="panel module" :class="{ active: module === 'regulatory' }" @click="module = 'regulatory'"><b>Соответствие законодательству <span class="mtag">{{ regulatoryCount ? `${regulatoryCount} выводов` : "нет отклонений" }}</span></b><span>Функции против законов, стандартов и требований регулятора</span></button>
          </div>
          <div v-if="module === 'recs'" class="panel pad">
            <ol v-if="recs.length" class="recs"><li v-for="(r, i) in recs" :key="i">{{ r }}</li></ol>
            <p v-else class="empty">Рекомендации приведены в заключении.</p>
            <button type="button" class="link" @click="screen = 'conclusion'">Заключение целиком →</button>
          </div>
          <div v-else class="panel pad"><RegulatoryTab :findings="analysis.regulatory ?? []" :stats="stats" :documents="analysis.documents ?? []" @open-clause="clauseTarget = $event" /></div>
        </section>
        <section v-else-if="screen === 'matches'" class="screen">
          <div class="screen-head">
            <h2>Все сопоставления функций</h2>
            <button type="button" class="link" @click="screen = 'summary'">← К итогу</button>
          </div>
          <MatchTable :functions="analysis.functions" :matches="analysis.matches" @open-clause="clauseTarget = $event" />
        </section>
        <section v-else class="screen">
          <Conclusion :markdown="analysis.conclusion_md" :analysis-id="analysis._id || analysis.analysis_id || 'analysis'" :subtitle="exportSubtitle" @notice="notice = $event" />
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
.topbar { position: sticky; top: 0; z-index: 20; background: var(--white); color: var(--text); border-bottom: 1px solid var(--panel-line); }
.topbar .wrap { height: 64px; display: flex; align-items: center; gap: 24px; }
.home { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 8px; }
.home:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.tabbar { border-top: 1px solid var(--panel-line); background: var(--white); }
.tabs { display: flex; gap: 4px; height: 48px; overflow-x: auto; }
.tabs button { white-space: nowrap; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; background: transparent; font: inherit; font-size: 14px; color: var(--text-2); cursor: pointer; }
.tabs button.active { color: var(--navy); font-weight: 600; border-bottom-color: var(--accent); }
.spacer { flex: 1; }
.docs { font-size: 13px; color: var(--muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user { display: flex; align-items: center; }
.user .avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--chip); color: var(--navy); font-weight: 700; font-size: 12px; }
.tb-btn { white-space: nowrap; height: 36px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--white); color: var(--navy); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.tb-btn.ghost { border-color: transparent; color: var(--text-2); background: transparent; }
.tb-btn:hover { background: var(--panel-2); }
.tb-btn.on { background: var(--chip); color: var(--navy); }
.tb-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--white); font-weight: 600; }
.tb-btn.primary:hover { background: var(--accent); opacity: 0.92; }
.tb-btn .count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--chip); font-size: 11px; line-height: 18px; text-align: center; }
.page { padding-top: 0; padding-bottom: 48px; display: flex; flex-direction: column; gap: 24px; }
.page > .alert { margin-top: 24px; }
.intro { display: flex; flex-direction: column; gap: 10px; padding: 44px 0 4px; max-width: 760px; }
.intro h1 { margin: 0; font-family: var(--font-display); font-size: 40px; line-height: 48px; font-weight: 800; letter-spacing: -0.02em; color: var(--navy); }
.intro p { margin: 0; font-size: 16px; line-height: 26px; color: var(--text-2); }
.eyebrow-s { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.screen { display: flex; flex-direction: column; gap: 16px; padding: 32px 0 0; }
.screen h2 { margin: 0; font-family: var(--font-display); font-size: 24px; line-height: 32px; font-weight: 800; color: var(--navy); }
.screen-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.screen-head .sub { margin: 6px 0 0; font-size: 14px; line-height: 22px; color: var(--text-2); max-width: 820px; }
.panel.list { overflow: hidden; }
.panel.empty { color: var(--text-2); font-size: 14px; }
.modules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.module { display: flex; flex-direction: column; gap: 6px; padding: 18px 22px; font: inherit; color: var(--text-2); font-size: 13px; text-align: left; cursor: pointer; }
.module b { font-size: 16px; color: var(--navy); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.module.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.mtag { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--chip-hover); color: var(--accent); }
.recs { margin: 0 0 16px; padding-left: 22px; display: flex; flex-direction: column; gap: 10px; font-size: 15px; line-height: 24px; }
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
@media (max-width: 1400px) {
  .docs { display: none; }
}
@media (max-width: 900px) {
  .wrap { padding: 0 16px; }
  .topbar .wrap { gap: 12px; }
  .docs { display: none; }
  .modules, :deep(.grid4), :deep(.grid3) { grid-template-columns: 1fr; }
  .intro h1 { font-size: 30px; line-height: 38px; }
}
</style>
