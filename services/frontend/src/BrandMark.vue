<script setup>
defineProps({ inverse: { type: Boolean, default: false } });
</script>

<template>
  <div class="brand" :class="{ inverse }">
    <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1E88FF" />
          <stop offset="1" stop-color="#0842A0" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" :fill="inverse ? '#fff' : 'url(#brand-grad)'" />
      <g fill="none" :stroke="inverse ? '#0A6FE0' : '#fff'" stroke-width="2.4" stroke-linecap="round">
        <path d="M6 14c6-3 22-3 28 0" />
        <path d="M4 20c8-3 24-3 32 0" />
        <path d="M6 26c6-3 22-3 28 0" />
      </g>
      <circle cx="29" cy="11" r="3.2" fill="#FF8A00" stroke="#fff" stroke-width="1.5" />
    </svg>
    <div>
      <div class="brand-name">ORGSCOPE</div>
      <div class="brand-sub">Анализ оргструктуры</div>
    </div>
  </div>
</template>

<style scoped>
.brand-mark circle:nth-of-type(1) { fill: var(--accent); }
.inverse { color: #fff; }
.inverse .brand-sub { color: rgba(255, 255, 255, 0.8); }
.inverse .brand-mark circle:nth-of-type(1) { fill: #fff; }
</style>
