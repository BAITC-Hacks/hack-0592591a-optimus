<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import Icon from "../Icon.vue";
import { demo, SEVERITY, STATUS, TAB_LABELS, COMPLIANCE_STATUS, findingById } from "./data.js";
import { state, isDone, setDecision, tabFindings, tabPendingCount, reviewStats, generateReport, REVIEW_TABS, showToast } from "./store.js";
import FindingCard from "./FindingCard.vue";
import DocViewer from "./DocViewer.vue";
import OrgTree from "./OrgTree.vue";

const st = computed(() => state());
const tab = ref("overview");
const activeId = ref(null);
const sevFilter = ref(null);
const statusFilter = ref(null);
const unitFilter = ref(null);
const lossesOnly = ref(false);
const complianceChanged = ref(false);
const viewOpen = ref(true);
const editorialOpen = ref(false);
const viewer = ref(null);
const cardEl = ref(null);

const stats = computed(() => reviewStats());
const activeFinding = computed(() => (activeId.value ? findingById[activeId.value] : null));
const CAT_VIEW_TABS = ["structure", "functions", "compliance", "benchmark"];

const tabList = computed(() =>
  ["overview", ...REVIEW_TABS].map((t) => {
    if (t === "overview") return { id: t, label: TAB_LABELS[t], badge: null };
    const disabled = (t === "compliance" && !st.value.checks.compliance) || (t === "benchmark" && !st.value.checks.benchmark);
    const total = tabFindings(t).length;
    const pending = tabPendingCount(t);
    return { id: t, label: TAB_LABELS[t], disabled, total, pending, done: !disabled && pending === 0 };
  }),
);

const listFindings = computed(() => {
  if (tab.value === "overview") return [];
  let list = tabFindings(tab.value);
  if (sevFilter.value) list = list.filter((f) => f.severity === sevFilter.value);
  if (statusFilter.value) list = list.filter((f) => st.value.findings[f.id].status === statusFilter.value);
  if (unitFilter.value) list = list.filter((f) => f.units.some((u) => u.includes(unitFilter.value) || unitFilter.value.includes(u)));
  if (tab.value === "functions" && lossesOnly.value) list = list.filter((f) => f.kind.includes("loss") || f.title.toLowerCase().includes("потер"));
  const rank = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => {
    const da = isDone(st.value.findings[a.id]) ? 1 : 0;
    const db = isDone(st.value.findings[b.id]) ? 1 : 0;
    if (da !== db) return da - db;
    return rank[a.severity] - rank[b.severity];
  });
});

const tabDone = computed(() => tab.value !== "overview" && tabPendingCount(tab.value) === 0);
const nextTab = computed(() => {
  const order = ["overview", ...REVIEW_TABS];
  const i = order.indexOf(tab.value);
  return order.slice(i + 1).find((t) => {
    if (t === "overview") return false;
    const d = (t === "compliance" && !st.value.checks.compliance) || (t === "benchmark" && !st.value.checks.benchmark);
    return !d && tabPendingCount(t) > 0;
  });
});

function openTab(t) {
  tab.value = t;
  unitFilter.value = null;
  const first = t !== "overview" ? tabFindings(t).find((f) => !isDone(st.value.findings[f.id])) || tabFindings(t)[0] : null;
  activeId.value = first ? first.id : null;
}

function openFinding(id) {
  const f = findingById[id];
  if (!f) return;
  if (f.tab !== tab.value) tab.value = f.tab;
  activeId.value = id;
  nextTick(() => cardEl.value?.$el?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

function onDecided() {
  const next = listFindings.value.find((f) => !isDone(st.value.findings[f.id]) && f.id !== activeId.value);
  if (next) {
    activeId.value = next.id;
    showToast("Переходим к следующему замечанию");
  } else if (tabDone.value) {
    showToast(`Вкладка «${TAB_LABELS[tab.value]}» завершена ✓`);
  }
}

function acceptAllLow() {
  const low = listFindings.value.filter((f) => f.severity === "low" && !isDone(st.value.findings[f.id]));
  if (!low.length) return;
  if (!window.confirm(`Принять все замечания с низкой важностью (${low.length})?`)) return;
  for (const f of low) setDecision(f.id, { status: "accepted" }, "Приняты все Low");
  showToast(`Принято замечаний: ${low.length}`);
}

function moveActive(d) {
  const list = listFindings.value;
  if (!list.length) return;
  const i = Math.max(0, list.findIndex((f) => f.id === activeId.value));
  activeId.value = list[(i + d + list.length) % list.length].id;
}

function onKey(e) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === "j") moveActive(1);
  else if (k === "k") moveActive(-1);
  else if (!activeFinding.value || isDone(st.value.findings[activeFinding.value.id])) return;
  else if (k === "a") cardEl.value?.accept();
  else if (k === "r") cardEl.value?.startReject();
  if (["j", "k", "a", "r"].includes(k)) e.preventDefault();
}
function onOpenEvent(e) { openFinding(e.detail); }
onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("orgscope:open-finding", onOpenEvent);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("orgscope:open-finding", onOpenEvent);
});

// --- category view data ---
function unitStatus(name) {
  const row = demo.unit_register.find((r) => name.includes(r.unit) || r.unit.includes(name) || name.includes(r.unit.split(" (")[0]));
  if (!row) return null;
  const map = {
    created: { cls: "badge-created", icon: "plus-circle" },
    kept: { cls: "badge-kept", icon: "check-circle" },
    transformed: { cls: "badge-reorg", icon: "shuffle" },
    changed: { cls: "badge-reorg", icon: "shuffle" },
    abolished: { cls: "badge-abolished", icon: "minus-circle" },
  };
  const m = map[row.status] || { cls: "badge-kept", icon: "check-circle" };
  return { label: row.status_label, ...m };
}
function pickUnit(node) {
  const short = node.name.match(/\(([^)]+)\)/)?.[1] || node.name;
  unitFilter.value = unitFilter.value === short ? null : short;
}
const complianceRows = computed(() =>
  demo.compliance_table.filter((r) => (complianceChanged.value ? r.changed_by_reorg : true)),
);

function reportTooltip() {
  const left = stats.value.total - stats.value.done;
  if (!left) return "Все замечания проверены";
  return `Осталось ${left} замечаний в ${stats.value.tabsLeft.length} вкладках`;
}

function enableCheck(which) {
  st.value.checks[which] = true;
  showToast(`Проверка «${TAB_LABELS[which]}» включена — перезапускаем только этот этап (демо)`);
}

watch(tab, () => { sevFilter.value = null; statusFilter.value = null; lossesOnly.value = false; });
onMounted(() => { if (!activeId.value) openTab("overview"); });
</script>

<template>
  <section class="review">
    <!-- Header -->
    <div class="rv-head">
      <div class="row rv-counters">
        <span class="badge badge-loss"><Icon name="alert-octagon" />Высокая: {{ stats.bySeverity.high }}</span>
        <span class="badge badge-dup"><Icon name="alert-triangle" />Средняя: {{ stats.bySeverity.medium }}</span>
        <span class="badge badge-kept"><Icon name="info" />Низкая: {{ stats.bySeverity.low }}</span>
      </div>
      <div class="rv-progress">
        <span class="small muted tnum">Проверено {{ stats.done }} из {{ stats.total }}</span>
        <div class="progress"><i :style="{ width: (stats.done / stats.total) * 100 + '%' }" /></div>
      </div>
      <span :title="reportTooltip()">
        <button class="btn" :class="stats.allDone ? 'btn-cta' : 'btn-outline'" :disabled="!stats.allDone" @click="generateReport()">
          <Icon name="clipboard" class="icon-sm" />Сформировать отчёт
        </button>
      </span>
    </div>

    <div v-if="stats.allDone" class="alert alert-success rv-alldone"><Icon name="check-circle" /><span><b>Все замечания проверены.</b> Можно формировать заключение.</span></div>

    <div class="alert alert-advisory rv-advisory">
      <Icon name="info" />
      <span><b>Выводы носят рекомендательный характер.</b> Каждый вывод подтверждён фрагментом исходного документа и требует проверки ответственным сотрудником.</span>
    </div>

    <!-- Tabs -->
    <div class="rv-tabs" role="tablist">
      <button
        v-for="t in tabList" :key="t.id" class="rv-tab" role="tab"
        :class="{ active: tab === t.id, disabled: t.disabled }" :aria-selected="tab === t.id"
        :title="t.disabled ? 'Проверка выключена на шаге 3' : ''"
        @click="!t.disabled && openTab(t.id)"
      >
        {{ t.label }}
        <template v-if="t.id !== 'overview' && !t.disabled">
          <span v-if="t.total === 0" class="badge badge-ok"><Icon name="check" />нет</span>
          <span v-else-if="t.pending > 0" class="rv-count">{{ t.pending }}</span>
          <span v-else class="badge badge-ok"><Icon name="check" />Готово</span>
        </template>
        <Icon v-if="t.disabled" name="eye-off" class="icon-sm" />
      </button>
    </div>

    <!-- Overview tab -->
    <div v-if="tab === 'overview'" class="rv-overview stack">
      <div class="card">
        <h3>{{ demo.overview.headline }}</h3>
        <div class="row rv-ov-tabs">
          <button v-for="t in tabList.filter((x) => x.id !== 'overview' && !x.disabled && x.pending > 0)" :key="t.id" class="chip" @click="openTab(t.id)">
            {{ t.label }} <span class="count">{{ t.pending }}</span>
          </button>
          <span v-if="stats.allDone" class="badge badge-ok"><Icon name="check-circle" />Все вкладки проверены</span>
        </div>
      </div>
      <div class="card">
        <div class="label">Ключевые замечания</div>
        <div class="stack rv-key">
          <button v-for="id in demo.overview.key_points" :key="id" class="rv-key-item" @click="openFinding(id)">
            <span class="badge" :class="{ 'badge-loss': findingById[id].severity === 'high', 'badge-dup': findingById[id].severity === 'medium' }">
              <Icon :name="SEVERITY[findingById[id].severity].icon" />{{ SEVERITY[findingById[id].severity].label }}
            </span>
            <span>{{ findingById[id].title }}</span>
            <Icon name="chevron-right" class="icon-sm" />
          </button>
        </div>
      </div>
      <div class="card">
        <div class="label">Ограничения анализа</div>
        <ul class="rv-limits">
          <li v-for="l in demo.overview.limitations" :key="l">{{ l }}</li>
        </ul>
      </div>
    </div>

    <!-- Disabled tab notice -->
    <div v-else-if="tabList.find((t) => t.id === tab)?.disabled" class="card rv-disabled">
      <div class="tile tile-lg tile-soft"><Icon name="eye-off" /></div>
      <h3>Проверка «{{ TAB_LABELS[tab] }}» была выключена на шаге 3</h3>
      <p class="muted">Результатов нет, потому что этот этап анализа не выполнялся.</p>
      <button class="btn btn-primary" @click="enableCheck(tab)"><Icon name="rotate-cw" class="icon-sm" />Включить и перезапустить эту проверку</button>
    </div>

    <!-- Review tab -->
    <template v-else>
      <!-- Category view -->
      <div class="rv-catview card" v-if="CAT_VIEW_TABS.includes(tab)">
        <button class="rv-cat-toggle" @click="viewOpen = !viewOpen">
          <Icon :name="viewOpen ? 'chevron-down' : 'chevron-right'" class="icon-sm" />
          <b v-if="tab === 'structure'">Структура: до и после</b>
          <b v-else-if="tab === 'functions'">Таблица функций</b>
          <b v-else-if="tab === 'compliance'">Требования из базы знаний</b>
          <b v-else>Сравнение с операторами</b>
        </button>

        <div v-if="viewOpen" class="rv-cat-body">
          <!-- Structure: two org trees -->
          <div v-if="tab === 'structure'" class="rv-org">
            <div>
              <div class="label">ДО · {{ demo.files.before.edition }}</div>
              <OrgTree :node="demo.org.before" :status-of="unitStatus" :selected="unitFilter" @pick="pickUnit" />
            </div>
            <div>
              <div class="label">ПОСЛЕ · {{ demo.files.after.edition }}</div>
              <OrgTree :node="demo.org.after" :status-of="unitStatus" :selected="unitFilter" @pick="pickUnit" />
            </div>
            <p class="muted small rv-org-hint">Нажмите на подразделение, чтобы отфильтровать замечания.<template v-if="unitFilter"> Фильтр: <b>{{ unitFilter }}</b> <button class="btn btn-ghost btn-sm" @click="unitFilter = null">Сбросить</button></template></p>
          </div>

          <!-- Functions table -->
          <div v-else-if="tab === 'functions'">
            <label class="check rv-toggle"><input type="checkbox" v-model="lossesOnly" /> Показывать только потери</label>
            <div class="table-wrap rv-table">
              <table class="table">
                <thead><tr><th scope="col">Функция</th><th scope="col">Владелец ДО</th><th scope="col">Владелец ПОСЛЕ</th><th scope="col">Статус</th></tr></thead>
                <tbody>
                  <tr
                    v-for="(r, i) in demo.function_matrix.filter((r) => !lossesOnly || r.status === 'lost' || r.status === 'narrowed')" :key="i"
                    :class="{ 'row-loss': r.status === 'lost', 'row-dup': r.status === 'narrowed', selected: r.finding_id && r.finding_id === activeId }"
                    @click="r.finding_id && openFinding(r.finding_id)"
                    :style="r.finding_id ? 'cursor:pointer' : ''"
                  >
                    <td class="cell-title">{{ r.function }}</td>
                    <td>{{ r.owner_before }}</td>
                    <td>{{ r.owner_after }}</td>
                    <td>
                      <span class="badge" :class="{ 'badge-loss': r.status === 'lost', 'badge-dup': ['narrowed', 'moved'].includes(r.status), 'badge-ok': r.status === 'kept', 'badge-created': r.status === 'new' }">{{ r.status_label }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Compliance table -->
          <div v-else-if="tab === 'compliance'">
            <label class="check rv-toggle"><input type="checkbox" v-model="complianceChanged" /> Только изменившиеся после реорганизации</label>
            <div class="table-wrap rv-table">
              <table class="table">
                <thead><tr><th scope="col">Требование</th><th scope="col">Внутренняя норма</th><th scope="col">Статус</th></tr></thead>
                <tbody>
                  <tr v-for="(r, i) in complianceRows" :key="i" :style="r.finding_id ? 'cursor:pointer' : ''" @click="r.finding_id && openFinding(r.finding_id)">
                    <td class="cell-title">{{ r.requirement }}</td>
                    <td>{{ r.internal_clause || "—" }}</td>
                    <td><span class="rv-cstat" :class="COMPLIANCE_STATUS[r.status].cls"><Icon :name="COMPLIANCE_STATUS[r.status].icon" class="icon-sm" />{{ COMPLIANCE_STATUS[r.status].label }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Benchmark matrix -->
          <div v-else>
            <div class="table-wrap rv-table">
              <table class="table">
                <thead><tr><th scope="col">Подразделение</th><th scope="col">У нас</th><th v-for="o in demo.benchmark_table.operators" :key="o" scope="col">{{ o }}</th></tr></thead>
                <tbody>
                  <tr v-for="r in demo.benchmark_table.rows" :key="r.unit">
                    <td class="cell-title">{{ r.unit }}</td>
                    <td><span v-if="r.ours === true" class="badge badge-ok"><Icon name="check" />есть</span><span v-else-if="r.ours === false" class="badge badge-outline">нет</span><template v-else>{{ r.ours }}</template></td>
                    <td v-for="(v, i) in r.values" :key="i">
                      <span v-if="v === true" class="badge badge-ok"><Icon name="check" />есть</span>
                      <span v-else-if="v === false" class="badge badge-outline">нет</span>
                      <span v-else-if="v === null" class="muted small">нет данных</span>
                      <template v-else>{{ v }}</template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="muted small rv-bench-note">{{ demo.benchmark_table.note }}</p>
          </div>
        </div>
      </div>

      <!-- Tab complete banner -->
      <div v-if="tabDone" class="alert alert-success rv-tabdone">
        <Icon name="check-circle" />
        <span>Вкладка «{{ TAB_LABELS[tab] }}» завершена ✓</span>
        <div class="alert-actions" v-if="nextTab">
          <button class="btn btn-primary btn-sm" @click="openTab(nextTab)">Следующая вкладка: {{ TAB_LABELS[nextTab] }}<Icon name="arrow-right" class="icon-sm" /></button>
        </div>
      </div>

      <!-- Three columns -->
      <div class="rv-cols">
        <!-- Findings list -->
        <div class="rv-list panel">
          <div class="rv-list-filters">
            <select v-model="sevFilter" class="select" aria-label="Фильтр по важности">
              <option :value="null">Важность: все</option>
              <option value="high">Высокая</option><option value="medium">Средняя</option><option value="low">Низкая</option>
            </select>
            <select v-model="statusFilter" class="select" aria-label="Фильтр по статусу">
              <option :value="null">Статус: все</option>
              <option v-for="(v, k) in STATUS" :key="k" :value="k">{{ v.label }}</option>
            </select>
            <button v-if="listFindings.some((f) => f.severity === 'low' && !isDone(st.findings[f.id]))" class="btn btn-ghost btn-sm" @click="acceptAllLow">Принять все Low</button>
          </div>
          <div class="rv-list-body">
            <button
              v-for="f in listFindings" :key="f.id" class="rv-item"
              :class="{ active: f.id === activeId, done: isDone(st.findings[f.id]) }"
              @click="activeId = f.id"
            >
              <span class="rv-item-sev" :class="'dot-' + f.severity" />
              <span class="rv-item-title">{{ f.title }}</span>
              <Icon :name="STATUS[st.findings[f.id].status].icon" class="icon-sm rv-item-st" />
            </button>
            <div v-if="!listFindings.length" class="rv-empty">
              <Icon name="check-circle" class="icon-lg" />
              <p class="muted small">По выбранным фильтрам замечаний нет.</p>
            </div>

            <!-- Editorial changes, collapsed, functions tab -->
            <div v-if="tab === 'functions' && demo.editorial_changes.length" class="rv-editorial">
              <button class="rv-cat-toggle" @click="editorialOpen = !editorialOpen">
                <Icon :name="editorialOpen ? 'chevron-down' : 'chevron-right'" class="icon-sm" />
                <span class="small">Редакционные изменения ({{ demo.editorial_changes.length }}) — приняты автоматически</span>
              </button>
              <div v-if="editorialOpen" class="stack rv-ed-list">
                <div v-for="(e, i) in demo.editorial_changes" :key="i" class="rv-ed-item small">
                  <div class="muted">{{ e.before }}</div>
                  <div>{{ e.after }}</div>
                  <span class="badge badge-kept">{{ e.why_ignored }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="rv-hotkeys muted">A — принять · R — отклонить · J/K — след./пред.</div>
        </div>

        <!-- Finding card -->
        <div class="rv-card">
          <FindingCard
            v-if="activeFinding" ref="cardEl" :finding="activeFinding"
            @cite="(i) => viewer?.goToCitation(i)" @kb-cite="() => viewer?.goToKb()" @decided="onDecided"
          />
          <div v-else class="card rv-empty">
            <div class="tile tile-lg tile-soft"><Icon name="file-search" /></div>
            <h3>Выберите замечание</h3>
            <p class="muted small">Список слева. Клавиши J и K листают замечания.</p>
          </div>
        </div>

        <!-- Document viewer -->
        <div class="rv-viewer">
          <DocViewer ref="viewer" :finding="activeFinding" @open-finding="openFinding" @back="cardEl?.$el?.scrollIntoView({ behavior: 'smooth' })" />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.review { display: flex; flex-direction: column; gap: var(--sp-3); height: 100%; min-height: 0; }
.rv-head { display: flex; align-items: center; gap: var(--sp-5); flex-wrap: wrap; }
.rv-counters { gap: var(--sp-2); }
.rv-progress { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 4px; }
.rv-advisory, .rv-alldone, .rv-tabdone { padding: 8px var(--sp-4); font-size: 13px; }
.rv-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.rv-tab { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; border-bottom: 2px solid transparent; font: inherit; font-size: 13px; font-weight: 700; color: var(--ink-500); padding: 8px 10px; cursor: pointer; white-space: nowrap; }
.rv-tab.active { color: var(--kt-blue-600); border-bottom-color: var(--kt-blue-600); }
.rv-tab.disabled { opacity: 0.5; cursor: not-allowed; }
.rv-tab .badge { height: 18px; font-size: 10px; padding: 0 6px; }
.rv-count { min-width: 18px; height: 18px; border-radius: 999px; background: var(--fx-loss); color: #fff; font-size: 11px; font-weight: 800; display: inline-grid; place-items: center; padding: 0 5px; }
.rv-overview { max-width: 860px; }
.rv-ov-tabs { flex-wrap: wrap; margin-top: var(--sp-3); }
.rv-key { margin-top: var(--sp-2); }
.rv-key-item { display: flex; align-items: center; gap: var(--sp-3); text-align: left; background: none; border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-2) var(--sp-3); font: inherit; font-size: 14px; cursor: pointer; }
.rv-key-item:hover { border-color: var(--kt-blue-500); background: var(--kt-blue-50); }
.rv-limits { margin: var(--sp-2) 0 0; padding-left: var(--sp-5); color: var(--ink-600); font-size: 14px; }
.rv-disabled { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-10); }
.rv-catview { padding: var(--sp-3) var(--sp-4); }
.rv-cat-toggle { display: flex; align-items: center; gap: var(--sp-2); background: none; border: 0; font: inherit; cursor: pointer; color: var(--ink-800); padding: 4px 0; }
.rv-cat-body { padding-top: var(--sp-3); }
.rv-org { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); }
.rv-org .label { margin-bottom: var(--sp-2); }
.rv-org-hint { grid-column: 1 / -1; }
.rv-toggle { margin-bottom: var(--sp-2); }
.rv-table { max-height: 300px; overflow: auto; }
.rv-cstat { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; }
.rv-cstat.c-met { color: var(--fx-ok); }
.rv-cstat.c-partial { color: var(--fx-dup); }
.rv-cstat.c-not { color: var(--fx-loss); }
.rv-cstat.c-none { color: var(--ink-500); }
.rv-bench-note { margin-top: var(--sp-2); }
.rv-cols { display: grid; grid-template-columns: 260px minmax(0, 1fr) minmax(0, 1.1fr); gap: var(--sp-4); flex: 1; min-height: 0; align-items: stretch; }
.rv-list { min-height: 0; max-height: 72vh; }
.rv-list-filters { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); border-bottom: 1px solid var(--line); }
.rv-list-filters .select { height: 32px; font-size: 13px; }
.rv-list-body { flex: 1; overflow-y: auto; padding: var(--sp-2); }
.rv-item { display: flex; align-items: flex-start; gap: var(--sp-2); width: 100%; text-align: left; background: none; border: 0; border-radius: var(--r-sm); padding: 8px; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink-800); }
.rv-item:hover { background: var(--kt-blue-50); }
.rv-item.active { background: var(--kt-blue-100); box-shadow: inset 3px 0 0 var(--kt-blue-600); }
.rv-item.done { opacity: 0.55; }
.rv-item.done .rv-item-title { text-decoration: none; color: var(--ink-500); }
.rv-item-sev { width: 10px; height: 10px; border-radius: 50%; flex: none; margin-top: 4px; }
.dot-high { background: var(--fx-loss); }
.dot-medium { background: var(--fx-dup); }
.dot-low { background: var(--st-abolished); }
.rv-item-title { flex: 1; line-height: 18px; }
.rv-item-st { color: var(--ink-500); margin-top: 2px; }
.rv-empty { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; padding: var(--sp-8) var(--sp-4); color: var(--ink-500); }
.rv-hotkeys { border-top: 1px solid var(--line); padding: 6px var(--sp-3); font-size: 11px; }
.rv-editorial { border-top: 1px dashed var(--line); margin-top: var(--sp-3); padding: var(--sp-2); }
.rv-ed-list { margin-top: var(--sp-2); }
.rv-ed-item { border: 1px solid var(--line); border-radius: var(--r-sm); padding: var(--sp-2); display: flex; flex-direction: column; gap: 4px; }
.rv-ed-item .badge { align-self: flex-start; }
.rv-card { min-height: 0; overflow-y: auto; max-height: 72vh; }
.rv-viewer { min-height: 0; max-height: 72vh; }
@media (max-width: 1500px) { .rv-cols { grid-template-columns: 230px minmax(0, 1fr) minmax(0, 1fr); } }
@media (max-width: 1280px) { .rv-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .rv-list { grid-column: 1 / -1; max-height: 30vh; } }
</style>
