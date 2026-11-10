<script setup lang="ts">
import { ElSlider } from 'element-plus'

defineProps({
  modelValue: { type: [Number, String], default: 0 },
  max: { type: Number, default: 100 }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <ElSlider
    :model-value="Number(modelValue) || 0"
    :max="max"
    :show-tooltip="false"
    size="small"
    class="progress-cell"
    @update:model-value="value => emit('update:modelValue', value)"
  />
</template>

<style scoped>
.progress-cell {
  width: 100%;
  height: 22px;
  padding: 0 4px;
}
</style>
