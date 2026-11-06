<script setup>
import { computed } from 'vue'

defineOptions({ name: 'MultiSelectCell' })

const props = defineProps({
  modelValue: {
    type: [Array, String, Number],
    default: () => []
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择'
  }
})

const emit = defineEmits(['update:modelValue'])

const value = computed(() => {
  const raw = props.modelValue
  if (Array.isArray(raw)) return raw
  if (raw === '' || raw === null || raw === undefined) return []
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // 按逗号分隔处理
      }
    }
    return trimmed.split(/[,，]/).map(item => item.trim()).filter(Boolean)
  }
  return [raw]
})

function optionValue(option) {
  return option?.value ?? option
}

function optionLabel(option) {
  return option?.label ?? option
}
</script>

<template>
  <el-select
    :model-value="value"
    :placeholder="placeholder"
    size="small"
    multiple
    collapse-tags
    collapse-tags-tooltip
    clearable
    class="multi-select-cell"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="option in options"
      :key="optionValue(option)"
      :label="optionLabel(option)"
      :value="optionValue(option)"
    />
  </el-select>
</template>

<style scoped>
.multi-select-cell {
  width: 100%;
}
</style>
