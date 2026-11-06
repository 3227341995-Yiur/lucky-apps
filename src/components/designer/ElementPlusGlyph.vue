<script setup>
import { computed } from 'vue'
import { getElGlyph } from '@/utils/elementPlusGlyphs'

defineOptions({ name: 'ElementPlusGlyph' })

const props = defineProps({
  name: { type: String, default: '' }
})

const glyph = computed(() => getElGlyph(props.name))
</script>

<template>
  <svg
    class="el-glyph"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="glyph"
  />
</template>

<style scoped>
.el-glyph {
  display: block;
  width: 15px;
  height: 15px;
}
</style>
