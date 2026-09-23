<script setup>
defineProps({
  health: { type: Object, required: true }, // { state: "checking" | "ok" | "down", text }
  inverse: { type: Boolean, default: false },
});
</script>

<template>
  <span class="health" :class="[health.state, { inverse }]" :title="`API: ${health.text}`">
    <i class="dot" />API: {{ health.text }}
  </span>
</template>

<style scoped>
.health {
  display: inline-flex; align-items: center; gap: 8px; height: 26px; padding: 0 10px;
  border-radius: var(--r-pill); font-size: 12px; font-weight: 700; white-space: nowrap;
  background: var(--surface-muted); border: 1px solid var(--line); color: var(--ink-600);
}
.health.inverse { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.22); color: #fff; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-300); }
.ok .dot { background: var(--fx-ok); box-shadow: 0 0 0 3px rgba(14, 159, 110, 0.18); }
.down .dot { background: var(--fx-loss); box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.18); }
.inverse.ok .dot { background: #3EE0A4; }
.inverse.down .dot { background: #FF8A80; }
</style>
