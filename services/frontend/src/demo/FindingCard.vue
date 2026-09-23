<script setup>
import { computed, ref, watch } from "vue";
import Icon from "../Icon.vue";
import { SEVERITY, STATUS, CONFIDENCE, BASIS, TAB_LABELS, REJECT_REASONS } from "./data.js";
import { state, setDecision, isDone } from "./store.js";

const props = defineProps({ finding: { type: Object, required: true } });
const emit = defineEmits(["cite", "kb-cite", "decided"]);

const fs = computed(() => state().findings[props.finding.id]);
const rejecting = ref(false);
const rejectReason = ref(null);
const rejectComment = ref("");
const showMeaning = ref(false);

watch(() => props.finding.id, () => {
  rejecting.value = false; rejectReason.value = null; rejectComment.value = "";
  showMeaning.value = false;
});

const kbReasons = computed(() => props.finding.citations.some((c) => c.type === "kb"));
const reasons = computed(() =>
  kbReasons.value ? REJECT_REASONS : REJECT_REASONS.filter((r) => !["Нерелевантная норма", "Устаревшая редакция"].includes(r)),
);

function accept() {
  const edited = fs.value.recommendation !== props.finding.recommendation;
  setDecision(props.finding.id, { status: edited ? "accepted_edited" : "accepted", edited }, edited ? "Принято с правками" : "Замечание принято");
  emit("decided");
}
function reject(reason) {
  if (reason === "Другое" && !rejectComment.value.trim()) {
    rejectReason.value = reason;
    return;
  }
  setDecision(props.finding.id, { status: "rejected", reject_reason: reason, comment: rejectComment.value || fs.value.comment }, "Замечание отклонено");
  rejecting.value = false;
  emit("decided");
}
function reopen() {
  setDecision(props.finding.id, { status: "pending", reject_reason: null }, "Замечание открыто заново");
}

defineExpose({ accept, startReject: () => (rejecting.value = true) });
</script>

<template>
  <article class="finding fcard" :class="'f-sev-' + finding.severity">
    <div class="row fc-head">
      <span class="badge" :class="{ 'badge-loss': finding.severity === 'high', 'badge-dup': finding.severity === 'medium', 'badge-kept': finding.severity === 'low' }">
        <Icon :name="SEVERITY[finding.severity].icon" />{{ SEVERITY[finding.severity].label }}
      </span>
      <span class="badge badge-outline">{{ TAB_LABELS[finding.tab] }}</span>
      <span class="badge badge-outline" :title="BASIS[finding.basis].label"><Icon :name="BASIS[finding.basis].icon" />{{ finding.basis === "explicit" ? "явно" : "вывод" }}</span>
      <span class="confidence" :class="CONFIDENCE[finding.confidence].cls">
        <span class="bars"><i /><i /><i /></span>{{ CONFIDENCE[finding.confidence].label }}
      </span>
      <span class="badge fc-status" :class="{ 'badge-ok': ['accepted', 'accepted_edited'].includes(fs.status), 'badge-loss': fs.status === 'rejected', 'badge-outline': fs.status === 'pending' }">
        <Icon :name="STATUS[fs.status].icon" />{{ STATUS[fs.status].label }}
      </span>
    </div>

    <h3>{{ finding.title }}</h3>
    <p class="explain">{{ finding.summary }}</p>

    <button class="btn btn-ghost btn-sm fc-meaning-btn" @click="showMeaning = !showMeaning">
      <Icon name="info" class="icon-sm" />Что это значит?
    </button>
    <p v-if="showMeaning" class="alert alert-advisory fc-meaning"><Icon name="info" /><span>{{ finding.what_it_means }}</span></p>

    <div class="units">
      <span v-for="u in finding.units" :key="u" class="u">{{ u }}</span>
    </div>

    <div class="fc-evidence">
      <div class="label">Основание</div>
      <div class="fc-cits">
        <template v-for="(c, i) in finding.citations" :key="i">
          <button v-if="c.type === 'internal'" class="src-chip" :title="c.quote || c.note || ''" @click="emit('cite', i)">
            <Icon name="file-text" class="icon-sm" />
            <span>{{ c.doc === "before" ? "ДО" : "ПОСЛЕ" }}</span>
            <span class="clause">{{ c.clause || "пункт не найден" }}</span>
          </button>
          <button v-else class="src-chip" :title="c.quote" @click="emit('kb-cite', i)">
            <Icon name="book-open" class="icon-sm" />
            <span>{{ c.collection }}</span>
            <span class="clause">{{ Math.round(c.score * 100) }}%</span>
            <span v-if="c.edition_date !== '—'" class="muted">· {{ c.edition_date }}</span>
          </button>
        </template>
      </div>
      <p v-if="!finding.citations.some((c) => c.type === 'internal')" class="muted small">Внутренних цитат нет — замечание опирается только на базу знаний.</p>
    </div>

    <div class="field fc-field">
      <label class="label" :for="'rec-' + finding.id">Рекомендация (можно править — попадёт в отчёт)</label>
      <textarea :id="'rec-' + finding.id" v-model="fs.recommendation" class="textarea" rows="2" />
    </div>
    <div class="field fc-field">
      <label class="label" :for="'com-' + finding.id">Комментарий (необязательно, попадёт в отчёт)</label>
      <textarea :id="'com-' + finding.id" v-model="fs.comment" class="textarea fc-comment" rows="2" placeholder="Необязательно" />
    </div>

    <div class="foot">
      <template v-if="!isDone(fs)">
        <template v-if="!rejecting">
          <button class="btn btn-primary" title="Клавиша A" @click="accept"><Icon name="check" class="icon-sm" />Принять</button>
          <button class="btn btn-danger" title="Клавиша R" @click="rejecting = true"><Icon name="x" class="icon-sm" />Отклонить</button>
        </template>
        <template v-else>
          <span class="small muted fc-why">Причина отклонения:</span>
          <div class="chips">
            <button v-for="r in reasons" :key="r" class="chip" :class="{ active: rejectReason === r }" @click="reject(r)">{{ r }}</button>
          </div>
          <input
            v-if="rejectReason === 'Другое'" v-model="rejectComment" class="input fc-other"
            placeholder="Обязательный комментарий для «Другое»" @keydown.enter="reject('Другое')"
          />
          <button class="btn btn-ghost btn-sm" @click="rejecting = false; rejectReason = null">Отмена</button>
        </template>
      </template>
      <template v-else>
        <span v-if="fs.status === 'rejected' && fs.reject_reason" class="small muted">Причина: {{ fs.reject_reason }}</span>
        <button class="btn btn-outline btn-sm" @click="reopen"><Icon name="undo" class="icon-sm" />Открыть заново</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.fcard { display: flex; flex-direction: column; gap: var(--sp-2); }
.fcard.f-sev-high { border-left-color: var(--fx-loss); }
.fcard.f-sev-medium { border-left-color: var(--fx-dup); }
.fcard.f-sev-low { border-left-color: var(--st-abolished); }
.fc-head { flex-wrap: wrap; gap: var(--sp-2); }
.fc-status { margin-left: auto; }
.fc-meaning-btn { align-self: flex-start; height: 26px; padding: 0 8px; }
.fc-meaning { font-size: 13px; }
.fc-evidence { margin-top: var(--sp-2); display: flex; flex-direction: column; gap: var(--sp-2); }
.fc-cits { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.fc-field { margin-top: var(--sp-2); }
.fc-comment { min-height: 56px; }
.fc-why { flex: none; }
.fc-other { max-width: 320px; height: 32px; font-size: 13px; }
</style>
