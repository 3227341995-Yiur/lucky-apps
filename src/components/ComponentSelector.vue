<script setup>
import { defineProps, defineEmits, ref } from 'vue'

const { column } = defineProps({
  column: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['select', 'close'])

const modelValue = ref({ ...column })

const selectComponent = () => {
  emit('select', modelValue.value)
  emit('close')
}
</script>

<template>
  <base-dialog
      title="列组件配置"
      width="800px"
      align-center
      @close="$emit('close')"
  >
    <div class="config-container">
      <column-card v-model="modelValue" />
    </div>

    <template #footer>
      <el-button type="primary" @click="selectComponent">确定</el-button>
    </template>
  </base-dialog>
</template>

<style scoped>
.config-container {
  padding: 15px;
}
</style>