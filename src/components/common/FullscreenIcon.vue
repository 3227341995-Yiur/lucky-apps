<script setup>
defineOptions({ name: 'FullscreenIcon' })

defineProps({
  exit: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <svg
    class="fullscreen-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="exit">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </template>
    <template v-else>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </template>
  </svg>
</template>

<style scoped>
.fullscreen-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
