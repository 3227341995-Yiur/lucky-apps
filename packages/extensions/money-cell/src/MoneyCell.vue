<script setup lang="ts">
import { ElInputNumber } from 'element-plus'

defineProps({
  modelValue: { type: [Number, String], default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 999999999 },
  precision: { type: Number, default: 2 },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <ElInputNumber
    :model-value="Number(modelValue) || 0"
    :min="min"
    :max="max"
    :precision="precision"
    :step="0.01"
    size="small"
    controls-position="right"
    class="money-cell"
    @update:model-value="value => emit('update:modelValue', value ?? 0)"
  />
</template>

<style scoped>
.money-cell {
  width: 100%;
}
</style>
