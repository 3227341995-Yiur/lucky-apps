<script setup lang="ts">
import { ElSelect, ElOption } from 'element-plus'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '选择成员' }
})

const emit = defineEmits(['update:modelValue'])

function valueOf(option) {
  return option?.value ?? option
}

function labelOf(option) {
  return option?.label ?? option
}
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :placeholder="placeholder"
    size="small"
    filterable
    clearable
    class="user-cell"
    @update:model-value="value => emit('update:modelValue', value ?? '')"
  >
    <ElOption
      v-for="option in props.options"
      :key="valueOf(option)"
      :label="labelOf(option)"
      :value="valueOf(option)"
    />
  </ElSelect>
</template>

<style scoped>
.user-cell {
  width: 100%;
}
</style>
