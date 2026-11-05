<script setup>
defineOptions({ name: 'NumberInput' })

defineProps({
  modelValue: {
    type: [Number, String],
    default: 0
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <el-input-number
    :model-value="modelValue === '' ? undefined : Number(modelValue)"
    size="small"
    controls-position="right"
    class="number-input"
    @update:model-value="emit('update:modelValue', $event ?? 0)"
  />
</template>

<style scoped>
.number-input {
  width: 100%;
}
</style>
