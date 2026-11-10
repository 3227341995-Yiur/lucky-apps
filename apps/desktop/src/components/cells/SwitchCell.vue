<script setup>
import { computed } from 'vue'

defineOptions({ name: 'SwitchCell' })

const props = defineProps({
  modelValue: {
    type: [Boolean, String, Number],
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const checked = computed(() => props.modelValue === true || props.modelValue === 1 || props.modelValue === 'true')
</script>

<template>
  <el-switch
    :model-value="checked"
    size="small"
    class="switch-cell"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
.switch-cell {
  height: 22px;
}
</style>
