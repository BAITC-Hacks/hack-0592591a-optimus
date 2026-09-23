// Reactive session store for the demo frontend flow. Mock until the backend pipeline is wired in.
import { reactive, watch } from "vue";
import { demo } from "./data.js";

const LS_KEY = "orgscope-demo-v1";

const REVIEW_TABS = ["structure", "functions", "duplication", "coi", "doc_quality", "compliance", "benchmark", "recommendations"];

function freshFindingState(f, forceStatus) {
  return {
    status: forceStatus || f.status,
    reject_reason: f.reject_reason,
    comment: f.comment || "",
    assignee: f.assignee,
    edited: f.edited,
    recommendation: f.recommendation,
  };
}

function freshSessionState(session) {
  const st = {
    step: session.current_step || 1,
    maxStep: session.current_step || 1,
    files: { before: null, after: null },
    upload: { before: { phase: "empty", pct: 0, error: null }, after: { phase: "empty", pct: 0, error: null } },
    analysis: { running: false, stage: -1, stagePct: 0, finished: false, counters: { units: 0, functions: 0, findings: 0 } },
    checks: { compliance: true, benchmark: true },
    findings: {},
    reportGenerated: false,
    reportStale: false,
    reportEdits: {},
  };
  const withFiles = ["analyzing", "review", "completed"].includes(session.status) || session.status === "draft";
  if (withFiles) {
    st.files.before = { ...demo.files.before };
    st.upload.before.phase = "verified";
  }
  if (["analyzing", "review", "completed"].includes(session.status)) {
    st.files.after = { ...demo.files.after };
    st.upload.after.phase = "verified";
  }
  if (session.status === "analyzing") {
    st.analysis = { running: true, stage: 4, stagePct: 40, finished: false, counters: { units: 8, functions: 96, findings: 14 } };
    st.maxStep = 4;
  }
  if (session.status === "review") {
    st.analysis = { running: false, stage: 9, stagePct: 100, finished: true, counters: { units: 11, functions: 148, findings: demo.findings.length } };
    st.maxStep = 5;
  }
  if (session.status === "completed") {
    st.analysis = { running: false, stage: 9, stagePct: 100, finished: true, counters: { units: 11, functions: 148, findings: demo.findings.length } };
    st.maxStep = 6;
    st.reportGenerated = true;
  }
  for (const f of demo.findings) {
    st.findings[f.id] = freshFindingState(f, session.status === "completed" ? "accepted" : undefined);
  }
  return st;
}

function initialState() {
  const sessions = demo.sessions.map((s) => ({ ...s }));
  const states = {};
  for (const s of sessions) states[s.id] = freshSessionState(s);
  return { sessions, states, currentId: demo.current_session_id, nextId: 1 };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && saved.states && saved.sessions) return saved;
  } catch { /* corrupted autosave — start fresh */ }
  return initialState();
}

export const store = reactive({
  ...load(),
  toast: null, // { text, undo: fn|null }
  kbOpen: false,
  introSeen: !!localStorage.getItem("orgscope-intro-seen"),
});

let toastTimer = null;
export function showToast(text, undo = null) {
  store.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (store.toast = null), 5000);
}

watch(
  () => ({ sessions: store.sessions, states: store.states, currentId: store.currentId, nextId: store.nextId }),
  (v) => localStorage.setItem(LS_KEY, JSON.stringify(v)),
  { deep: true },
);

export function session() {
  return store.sessions.find((s) => s.id === store.currentId);
}
export function state() {
  return store.states[store.currentId];
}

export function openSession(id) {
  store.currentId = id;
}

export function newSession() {
  const id = `s-new-${store.nextId++}`;
  const s = { id, title: `Новый анализ от ${new Date().toLocaleDateString("ru-RU")}`, created_at: new Date().toISOString(), status: "draft", current_step: 1 };
  store.sessions.unshift(s);
  store.states[id] = {
    step: 1, maxStep: 1,
    files: { before: null, after: null },
    upload: { before: { phase: "empty", pct: 0, error: null }, after: { phase: "empty", pct: 0, error: null } },
    analysis: { running: false, stage: -1, stagePct: 0, finished: false, counters: { units: 0, functions: 0, findings: 0 } },
    checks: { compliance: true, benchmark: true },
    findings: Object.fromEntries(demo.findings.map((f) => [f.id, freshFindingState(f)])),
    reportGenerated: false, reportStale: false, reportEdits: {},
  };
  store.currentId = id;
}

export function renameSession(id, title) {
  const s = store.sessions.find((x) => x.id === id);
  if (s && title.trim()) s.title = title.trim();
}

export function duplicateSession(id) {
  const src = store.sessions.find((x) => x.id === id);
  if (!src) return;
  const nid = `s-new-${store.nextId++}`;
  store.sessions.unshift({ ...src, id: nid, title: `${src.title} — новая редакция`, created_at: new Date().toISOString(), status: "draft", current_step: 2, is_sample: false });
  const st = JSON.parse(JSON.stringify(store.states[id]));
  st.step = 2; st.maxStep = 2;
  st.files.after = null;
  st.upload.after = { phase: "empty", pct: 0, error: null };
  st.analysis = { running: false, stage: -1, stagePct: 0, finished: false, counters: { units: 0, functions: 0, findings: 0 } };
  st.reportGenerated = false; st.reportStale = false;
  for (const f of demo.findings) st.findings[f.id] = freshFindingState(f);
  store.states[nid] = st;
  store.currentId = nid;
}

export function deleteSession(id) {
  const i = store.sessions.findIndex((x) => x.id === id);
  if (i === -1) return;
  store.sessions.splice(i, 1);
  delete store.states[id];
  if (store.currentId === id) store.currentId = store.sessions[0]?.id || null;
  if (!store.sessions.length) newSession();
}

export function goStep(n) {
  const st = state();
  if (n <= st.maxStep) st.step = n;
}

// ---- Upload simulation (mock until the backend accepts real files) ----
const ACCEPTED = ["docx", "pdf", "xlsx", "doc", "xls"];
export function simulateUpload(side, fileName) {
  const st = state();
  const up = st.upload[side];
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (!ACCEPTED.includes(ext)) {
    up.phase = "error";
    up.error = "Этот формат не поддерживается. Загрузите файл Word, PDF или Excel.";
    return;
  }
  up.error = null;
  up.phase = "uploading";
  up.pct = 0;
  const t = setInterval(() => {
    up.pct = Math.min(100, up.pct + 18 + Math.random() * 14);
    if (up.pct >= 100) {
      clearInterval(t);
      up.phase = "checking";
      setTimeout(() => {
        up.phase = "verified";
        st.files[side] = { ...demo.files[side] };
        const s = session();
        if (side === "before" && st.step === 1) {
          st.step = 2; st.maxStep = Math.max(st.maxStep, 2);
          showToast("Документ «ДО» загружен. Переходим к шагу 2 — документ «ПОСЛЕ».");
        }
        if (side === "after") {
          st.maxStep = Math.max(st.maxStep, 3);
          showToast("Оба документа загружены. Шаг 3 «Запуск анализа» доступен.");
        }
        if (s) s.current_step = st.step;
      }, 900);
    }
  }, 140);
}

export function removeFile(side) {
  const st = state();
  st.files[side] = null;
  st.upload[side] = { phase: "empty", pct: 0, error: null };
  if (side === "before") { st.step = 1; st.maxStep = 1; }
  else { st.maxStep = Math.min(st.maxStep, 2); if (st.step > 2) st.step = 2; }
}

// ---- Fake analysis timer ----
const STAGE_MS = 1700;
let analysisTimer = null;

export function startAnalysis() {
  const st = state();
  const s = session();
  st.step = 4; st.maxStep = Math.max(st.maxStep, 4);
  st.analysis = { running: true, stage: 0, stagePct: 0, finished: false, counters: { units: 0, functions: 0, findings: 0 } };
  s.status = "analyzing";
  s.current_step = 4;
  const sid = store.currentId;
  clearInterval(analysisTimer);
  analysisTimer = setInterval(() => {
    const a = store.states[sid].analysis;
    a.stagePct += 100 / (STAGE_MS / 120);
    if (a.stagePct >= 100) {
      a.stagePct = 0;
      a.stage += 1;
      const total = demo.analysis_stages.length;
      const p = a.stage / total;
      a.counters.units = Math.round(11 * Math.min(1, p * 2.4));
      a.counters.functions = Math.round(148 * Math.min(1, p * 1.8));
      a.counters.findings = Math.round(demo.findings.length * Math.min(1, Math.max(0, p - 0.3) * 1.9));
      if (a.stage >= total) {
        clearInterval(analysisTimer);
        a.running = false;
        a.finished = true;
        a.stage = total;
        a.counters = { units: 11, functions: 148, findings: demo.findings.length };
        store.states[sid].maxStep = Math.max(store.states[sid].maxStep, 5);
        const sess = store.sessions.find((x) => x.id === sid);
        if (sess) { sess.status = "review"; sess.current_step = 5; sess.progress = { done: 0, total: demo.findings.length }; }
      }
    }
  }, 120);
}

export function analysisPct(st) {
  const total = demo.analysis_stages.length;
  if (st.analysis.finished) return 100;
  if (st.analysis.stage < 0) return 0;
  return Math.round(((st.analysis.stage + st.analysis.stagePct / 100) / total) * 100);
}

// ---- Decisions ----
const DONE = ["accepted", "accepted_edited", "rejected"];

export function isDone(fs) {
  return DONE.includes(fs.status);
}

export function setDecision(fid, patch, label) {
  const st = state();
  const fs = st.findings[fid];
  const prev = { ...fs };
  Object.assign(fs, patch);
  if (st.reportGenerated) st.reportStale = true;
  updateSessionProgress();
  showToast(label, () => {
    Object.assign(fs, prev);
    updateSessionProgress();
    store.toast = null;
  });
}

export function updateSessionProgress() {
  const st = state();
  const s = session();
  if (!s || !st) return;
  const done = demo.findings.filter((f) => isDone(st.findings[f.id])).length;
  if (s.status === "review" || s.status === "completed") {
    s.progress = { done, total: demo.findings.length };
  }
}

export function tabFindings(tab) {
  return demo.findings.filter((f) => f.tab === tab);
}

export function tabPendingCount(tab) {
  const st = state();
  if ((tab === "compliance" && !st.checks.compliance) || (tab === "benchmark" && !st.checks.benchmark)) return 0;
  return tabFindings(tab).filter((f) => !isDone(st.findings[f.id])).length;
}

export function reviewStats() {
  const st = state();
  const total = demo.findings.length;
  const done = demo.findings.filter((f) => isDone(st.findings[f.id])).length;
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of demo.findings) if (!isDone(st.findings[f.id])) bySeverity[f.severity]++;
  const tabsLeft = REVIEW_TABS.filter((t) => tabPendingCount(t) > 0);
  return { total, done, bySeverity, tabsLeft, allDone: done === total || tabsLeft.length === 0 };
}

export function generateReport() {
  const st = state();
  const s = session();
  st.reportGenerated = true;
  st.reportStale = false;
  st.step = 6; st.maxStep = 6;
  if (s) { s.status = "completed"; s.current_step = 6; }
}

export { REVIEW_TABS };
