<script setup lang="ts">
defineOptions({ name: 'TextareaCell' })

defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <el-input
    :model-value="modelValue"
    type="textarea"
    :rows="2"
    :autosize="{ minRows: 2, maxRows: 6 }"
    size="small"
    resize="none"
    :placeholder="placeholder || '多行文本'"
    class="textarea-cell"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
.textarea-cell {
  width: 100%;
}

.textarea-cell :deep(.el-textarea__inner) {
  padding: 2px 4px;
  box-shadow: none;
  background: transparent;
}
</style>
