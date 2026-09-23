<script setup>
import { computed, ref, watch } from "vue";
import Icon from "../Icon.vue";
import { SEVERITY, REJECT_REASONS } from "./data.js";
import { state, setDecision, isDone, openDoc } from "./store.js";

const props = defineProps({ finding: { type: Object, required: true } });

const fs = computed(() => state().findings[props.finding.id]);
const rejecting = ref(false);
const needComment = ref(false);

watch(() => props.finding.id, () => {
  rejecting.value = false;
  needComment.value = false;
});

function accept() {
  const edited = fs.value.recommendation !== props.finding.recommendation;
  setDecision(props.finding.id, { status: edited ? "accepted_edited" : "accepted" }, "Замечание принято");
}
function reject(reason) {
  if (reason === "Другое" && !fs.value.comment.trim()) {
    needComment.value = true;
    return;
  }
  setDecision(props.finding.id, { status: "rejected", reject_reason: reason }, "Замечание отклонено");
  rejecting.value = false;
  needComment.value = false;
}
function reopen() {
  setDecision(props.finding.id, { status: "pending", reject_reason: null }, "Замечание открыто заново");
}

function citLabel(c) {
  if (c.type === "internal") return `${c.doc === "before" ? "ДО" : "ПОСЛЕ"} · ${c.clause || "пункт не найден"}`;
  return c.collection;
}
function openCit(i) {
  const c = props.finding.citations[i];
  openDoc(c.type === "kb" ? { finding: props.finding, kb: true } : { finding: props.finding, cit: props.finding.citations.filter((x) => x.type === "internal").indexOf(c) });
}
</script>

<template>
  <!-- Decided: one collapsed row -->
  <article v-if="isDone(fs)" class="fc fc-done">
    <Icon :name="fs.status === 'rejected' ? 'x' : 'check'" class="icon-sm" :class="fs.status === 'rejected' ? 'fc-ic-rej' : 'fc-ic-ok'" />
    <span class="fc-done-title">{{ finding.title }}</span>
    <span class="muted small">{{ fs.status === "rejected" ? `Отклонено${fs.reject_reason ? " · " + fs.reject_reason : ""}` : "Принято" }}</span>
    <button class="btn btn-ghost btn-sm" @click="reopen">Вернуть</button>
  </article>

  <!-- Pending: full card -->
  <article v-else class="fc card">
    <div class="fc-head">
      <span class="fc-dot" :class="'dot-' + finding.severity" :title="'Важность: ' + SEVERITY[finding.severity].label" />
      <h3>{{ finding.title }}</h3>
    </div>
    <p class="fc-sum">{{ finding.summary }}</p>

    <div class="fc-cits">
      <button v-for="(c, i) in finding.citations" :key="i" class="src-chip" :title="c.quote || c.note || ''" @click="openCit(i)">
        <Icon :name="c.type === 'internal' ? 'file-text' : 'book-open'" class="icon-sm" />{{ citLabel(c) }}
      </button>
    </div>

    <div class="field">
      <label class="label" :for="'rec-' + finding.id">Рекомендация</label>
      <textarea :id="'rec-' + finding.id" v-model="fs.recommendation" class="textarea" rows="2" />
    </div>
    <input
      v-model="fs.comment" class="input fc-comment"
      :placeholder="needComment ? 'Для «Другое» комментарий обязателен' : 'Комментарий (необязательно)'"
      :class="{ 'fc-comment-req': needComment }"
    />

    <div class="fc-foot">
      <template v-if="!rejecting">
        <button class="btn btn-primary" @click="accept"><Icon name="check" class="icon-sm" />Принять</button>
        <button class="btn btn-outline" @click="rejecting = true">Отклонить</button>
      </template>
      <template v-else>
        <span class="small muted">Причина:</span>
        <div class="chips">
          <button v-for="r in REJECT_REASONS" :key="r" class="chip" @click="reject(r)">{{ r }}</button>
        </div>
        <button class="btn btn-ghost btn-sm" @click="rejecting = false; needComment = false">Отмена</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.fc { display: flex; flex-direction: column; gap: var(--sp-2); }
.fc-head { display: flex; align-items: baseline; gap: var(--sp-2); }
.fc-head h3 { margin: 0; font-size: 16px; line-height: 22px; }
.fc-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; align-self: center; }
.dot-high { background: var(--fx-loss); }
.dot-medium { background: var(--fx-dup); }
.dot-low { background: var(--line-strong); }
.fc-sum { margin: 0; color: var(--ink-600); font-size: 14px; }
.fc-cits { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.fc-comment { height: 34px; font-size: 13px; }
.fc-comment-req { border-color: var(--fx-loss); }
.fc-comment-req::placeholder { color: var(--fx-loss); }
.fc-foot { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-1); }
.fc-done { display: flex; align-items: center; gap: var(--sp-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 6px var(--sp-3); background: var(--surface-muted); }
.fc-done-title { flex: 1; font-size: 13px; color: var(--ink-600); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-ic-ok { color: var(--fx-ok); }
.fc-ic-rej { color: var(--ink-500); }
</style>
