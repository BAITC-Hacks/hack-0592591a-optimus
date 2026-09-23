// Reactive state for the demo frontend flow. Mock until the backend pipeline is wired in.
// Steps: 1 documents · 2 analysis · 3 review · 4 report
import { reactive, watch } from "vue";
import { demo } from "./data.js";

const LS_KEY = "orgscope-demo-v2";

export const REVIEW_TABS = ["structure", "functions", "duplication", "coi", "doc_quality", "compliance", "benchmark", "recommendations"];

function freshFindingState(f) {
  return { status: "pending", reject_reason: null, comment: "", recommendation: f.recommendation };
}

function freshState() {
  return {
    step: 1,
    maxStep: 1,
    files: { before: null, after: null },
    upload: { before: { phase: "empty", pct: 0, error: null }, after: { phase: "empty", pct: 0, error: null } },
    analysis: { running: false, stage: -1, stagePct: 0, finished: false },
    findings: Object.fromEntries(demo.findings.map((f) => [f.id, freshFindingState(f)])),
    reportGenerated: false,
    reportStale: false,
    reportEdits: {},
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved?.findings && saved?.upload) {
      // A timer can't survive a reload — treat an interrupted analysis as finished.
      if (saved.analysis.running) {
        saved.analysis = { running: false, stage: demo.analysis_stages.length, stagePct: 0, finished: true };
        saved.maxStep = Math.max(saved.maxStep, 3);
      }
      return saved;
    }
  } catch { /* corrupted autosave — start fresh */ }
  return freshState();
}

export const store = reactive({
  st: load(),
  toast: null, // { text, undo: fn|null }
  doc: null, // { side } | { finding, cit } | { finding, kb: true } — document modal
});

export function state() {
  return store.st;
}

watch(
  () => store.st,
  (v) => localStorage.setItem(LS_KEY, JSON.stringify(v)),
  { deep: true },
);

let toastTimer = null;
export function showToast(text, undo = null) {
  store.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (store.toast = null), 5000);
}

export function reset() {
  clearInterval(analysisTimer);
  store.st = freshState();
  store.doc = null;
}

export function goStep(n) {
  if (n <= store.st.maxStep) store.st.step = n;
}

export function openDoc(payload) {
  store.doc = payload;
}

// ---- Upload simulation (mock until the backend accepts real files) ----
const ACCEPTED = ["docx", "pdf", "xlsx", "doc", "xls"];

export function simulateUpload(side, fileName) {
  const up = store.st.upload[side];
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (!ACCEPTED.includes(ext)) {
    up.phase = "error";
    up.error = "Формат не поддерживается. Нужен Word, PDF или Excel.";
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
        store.st.files[side] = { ...demo.files[side] };
      }, 700);
    }
  }, 130);
}

export function removeFile(side) {
  store.st.files[side] = null;
  store.st.upload[side] = { phase: "empty", pct: 0, error: null };
}

// ---- Fake analysis timer ----
const STAGE_MS = 1500;
let analysisTimer = null;

export function startAnalysis() {
  const st = store.st;
  st.step = 2;
  st.maxStep = Math.max(st.maxStep, 2);
  st.analysis = { running: true, stage: 0, stagePct: 0, finished: false };
  clearInterval(analysisTimer);
  analysisTimer = setInterval(() => {
    const a = st.analysis;
    a.stagePct += 100 / (STAGE_MS / 120);
    if (a.stagePct >= 100) {
      a.stagePct = 0;
      a.stage += 1;
      if (a.stage >= demo.analysis_stages.length) {
        clearInterval(analysisTimer);
        a.running = false;
        a.finished = true;
        a.stage = demo.analysis_stages.length;
        st.maxStep = Math.max(st.maxStep, 3);
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
  const fs = store.st.findings[fid];
  const prev = { ...fs };
  Object.assign(fs, patch);
  if (store.st.reportGenerated) store.st.reportStale = true;
  showToast(label, () => {
    Object.assign(fs, prev);
    store.toast = null;
  });
}

export function tabFindings(tab) {
  return demo.findings.filter((f) => f.tab === tab);
}

export function tabPendingCount(tab) {
  return tabFindings(tab).filter((f) => !isDone(store.st.findings[f.id])).length;
}

export function reviewStats() {
  const total = demo.findings.length;
  const done = demo.findings.filter((f) => isDone(store.st.findings[f.id])).length;
  return { total, done, allDone: done === total };
}

export function generateReport() {
  store.st.reportGenerated = true;
  store.st.reportStale = false;
  store.st.step = 4;
  store.st.maxStep = 4;
}
