<script setup lang="ts">
import { ElRate } from 'element-plus'

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  max: { type: Number, default: 5 },
  allowHalf: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <ElRate
    :model-value="Number(modelValue) || 0"
    :max="max"
    :allow-half="allowHalf"
    size="small"
    class="rating-cell"
    @update:model-value="value => emit('update:modelValue', value)"
  />
</template>

<style scoped>
.rating-cell {
  height: 22px;
  --el-rate-icon-size: 14px;
  --el-rate-icon-margin: 1px;
}
</style>
