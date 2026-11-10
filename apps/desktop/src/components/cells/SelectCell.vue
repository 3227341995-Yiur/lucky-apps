<script setup lang="ts">
defineOptions({ name: 'SelectCell' })

defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: '请选择',
  },
})

const emit = defineEmits(['update:modelValue'])

function optionValue(option) {
  return option?.value ?? option
}

function optionLabel(option) {
  return option?.label ?? option
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    size="small"
    clearable
    class="select-cell"
    @update:model-value="emit('update:modelValue', $event ?? '')"
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
.select-cell {
  width: 100%;
}
</style>
