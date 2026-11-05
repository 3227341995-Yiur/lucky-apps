<script setup>
defineOptions({ name: 'StatusSelector' })

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  }
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
    placeholder="选择状态"
    size="small"
    class="status-selector"
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
.status-selector {
  width: 100%;
}
</style>
