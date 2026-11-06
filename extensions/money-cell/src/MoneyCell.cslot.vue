<script setup>
import { ElInputNumber } from 'element-plus'

const column = defineModel()

function attrs() {
  if (!column.value.attrs) column.value.attrs = {}
  return column.value.attrs
}
</script>

<template>
  <div class="money-slot">
    <label>
      <span>最小值</span>
      <ElInputNumber :model-value="attrs().min ?? 0" size="small" controls-position="right" @update:model-value="v => attrs().min = v" />
    </label>
    <label>
      <span>最大值</span>
      <ElInputNumber :model-value="attrs().max ?? 999999999" size="small" controls-position="right" @update:model-value="v => attrs().max = v" />
    </label>
    <label>
      <span>小数位</span>
      <ElInputNumber :model-value="attrs().precision ?? 2" :min="0" :max="6" size="small" controls-position="right" @update:model-value="v => attrs().precision = v" />
    </label>
  </div>
</template>

<style scoped>
.money-slot {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.money-slot label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}
</style>
