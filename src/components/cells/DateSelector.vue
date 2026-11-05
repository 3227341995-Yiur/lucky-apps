<script setup>
defineOptions({ name: 'DateSelector' })

defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <el-date-picker
    :model-value="modelValue"
    type="date"
    placeholder="选择日期"
    size="small"
    value-format="YYYY-MM-DD"
    class="date-selector"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
.date-selector {
  width: 100%;
}
</style>
