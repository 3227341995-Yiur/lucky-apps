<script setup>
import { ElInputNumber, ElSwitch } from 'element-plus'

const column = defineModel()

function attrs() {
  if (!column.value.attrs) column.value.attrs = {}
  return column.value.attrs
}
</script>

<template>
  <div class="rating-slot">
    <label>
      <span>最大分值</span>
      <ElInputNumber :model-value="attrs().max || 5" :min="1" :max="10" size="small" controls-position="right" @update:model-value="v => attrs().max = v" />
    </label>
    <label class="switch">
      <span>允许半星</span>
      <ElSwitch :model-value="Boolean(attrs().allowHalf)" size="small" @update:model-value="v => attrs().allowHalf = v" />
    </label>
  </div>
</template>

<style scoped>
.rating-slot {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.rating-slot label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}
.rating-slot .switch {
  justify-content: flex-end;
}
</style>
