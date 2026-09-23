<script setup>
import Icon from "../Icon.vue";

defineProps({
  node: { type: Object, required: true },
  statusOf: { type: Function, required: true }, // (name) => {label, cls, icon} | null
  selected: { type: String, default: null },
});
const emit = defineEmits(["pick"]);
</script>

<template>
  <div class="org-node">
    <button class="org-unit" :class="{ selected: selected && node.name.includes(selected) }" @click="emit('pick', node)">
      <span class="org-name">{{ node.name }}</span>
      <span v-if="statusOf(node.name)" class="badge" :class="statusOf(node.name).cls">
        <Icon :name="statusOf(node.name).icon" />{{ statusOf(node.name).label }}
      </span>
      <span v-if="node.head" class="muted small">{{ node.head }}</span>
    </button>
    <div v-if="node.children?.length" class="org-children">
      <OrgTree v-for="c in node.children" :key="c.id" :node="c" :status-of="statusOf" :selected="selected" @pick="emit('pick', $event)" />
    </div>
  </div>
</template>

<style scoped>
.org-node { display: flex; flex-direction: column; gap: var(--sp-2); }
.org-unit { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-2) var(--sp-3); font: inherit; cursor: pointer; box-shadow: var(--sh-1); }
.org-unit:hover { border-color: var(--kt-blue-500); }
.org-unit.selected { border-color: var(--kt-blue-600); background: var(--kt-blue-50); }
.org-name { font-weight: 700; font-size: 13px; color: var(--ink-900); }
.org-children { margin-left: var(--sp-5); padding-left: var(--sp-3); border-left: 2px dotted var(--kt-blue-100); display: flex; flex-direction: column; gap: var(--sp-2); }
</style>
