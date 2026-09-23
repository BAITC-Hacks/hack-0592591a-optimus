<script setup>
defineProps({
  d: { type: Object, required: true }, // { kept, moved, partial, lost, total }
  caption: { type: String, default: "" },
  compact: { type: Boolean, default: false },
});
const pct = (n, total) => (total ? Math.max(n ? 1.2 : 0, (n / total) * 100) : 0);
</script>

<template>
  <div class="dist" :class="{ compact }">
    <div v-if="caption" class="cap">{{ caption }}</div>
    <div class="bar" role="img" :aria-label="`сохранены ${d.kept}, переданы ${d.moved}, частично ${d.partial}, не найдены ${d.lost}`">
      <i class="k" :style="{ width: pct(d.kept, d.total) + '%' }" />
      <i class="m" :style="{ width: pct(d.moved, d.total) + '%' }" />
      <i class="p" :style="{ width: pct(d.partial, d.total) + '%' }" />
      <i class="l" :style="{ width: pct(d.lost, d.total) + '%' }" />
    </div>
    <div class="legend">
      <div><b>{{ d.kept }}</b>сохранены</div>
      <div><b>{{ d.moved }}</b>переданы</div>
      <div><b class="p">{{ d.partial }}</b>частично</div>
      <div><b class="l">{{ d.lost }}</b>не найдены</div>
    </div>
  </div>
</template>

<style scoped>
.dist { display: flex; flex-direction: column; gap: 10px; }
.cap { font-size: 13px; font-weight: 600; color: var(--muted); }
.bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; gap: 2px; background: var(--panel-line); }
.bar i { display: block; height: 100%; }
.bar .k { background: var(--accent); }
.bar .m { background: var(--accent-soft); }
.bar .p { background: var(--c-dup); }
.bar .l { background: var(--c-loss); }
.legend { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; font-size: 12px; line-height: 16px; color: var(--muted); }
.legend b { display: block; font-family: var(--font-display); font-size: 20px; line-height: 24px; font-weight: 800; color: var(--navy); }
.legend b.p { color: var(--c-dup-text); }
.legend b.l { color: var(--c-loss); }
.compact .bar { height: 12px; }
.compact .legend b { font-size: 16px; line-height: 20px; }
.compact .legend { font-size: 11px; }
</style>
