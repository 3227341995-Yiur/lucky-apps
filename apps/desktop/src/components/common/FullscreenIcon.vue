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
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </template>
    <template v-else>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
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
