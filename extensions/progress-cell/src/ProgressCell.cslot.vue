<script setup>
import { ElInputNumber } from 'element-plus'

const column = defineModel()

function attrs() {
  if (!column.value.attrs) column.value.attrs = {}
  return column.value.attrs
}
</script>

<template>
  <label class="progress-slot">
    <span>最大值</span>
    <ElInputNumber :model-value="attrs().max || 100" :min="1" :max="10000" size="small" controls-position="right" @update:model-value="v => attrs().max = v" />
  </label>
</template>

<style scoped>
.progress-slot {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}
</style>
