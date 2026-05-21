<script setup>
import { defineProps, defineEmits, ref } from 'vue'

const props = defineProps({
  showFooter: {
    type: Boolean,
    default: true
  }
})

const visible = ref(true)

const emit = defineEmits(['close'])
</script>

<template>
  <el-dialog
      ref="modal"
      v-model="visible"
      v-bind="$attrs"
      @close="emit('close')"
  >
    <template #title>
      <slot name="title">
        <span class="el-dialog__title">{{ $attrs.title }}</span>
      </slot>
    </template>

    <el-scrollbar>
      <div class="dialog-content">
        <slot></slot>
      </div>
    </el-scrollbar>

    <template #footer v-if="showFooter">
      <slot name="actions"></slot>
      <slot name="footer"></slot>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-content {
  max-height: 70vh;
}
</style>