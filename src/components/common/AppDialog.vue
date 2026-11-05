<script setup>
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'

defineOptions({ name: 'AppDialog' })

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  width: { type: String, default: '760px' },
  /** 撑满视口高度（IDE / 设计器） */
  fillHeight: { type: Boolean, default: false },
  showFooter: { type: Boolean, default: false },
  closeOnClickModal: { type: Boolean, default: false },
  closeOnPressEscape: { type: Boolean, default: true },
  destroyOnClose: { type: Boolean, default: true },
  beforeClose: { type: Function, default: null }
})

const emit = defineEmits(['closed', 'close'])

const dialogStyle = computed(() => ({
  width: props.width,
  maxWidth: 'calc(100vw - 32px)'
}))

function close() {
  if (props.beforeClose) {
    props.beforeClose(() => {
      emit('close')
      visible.value = false
    })
    return
  }
  emit('close')
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :class="['wr-app-dialog', { 'is-fill': fillHeight }]"
    :style="dialogStyle"
    :show-close="false"
    :destroy-on-close="destroyOnClose"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    append-to-body
    align-center
    @closed="emit('closed')"
  >
    <template #header>
      <header class="wr-dialog-header">
        <div class="wr-dialog-heading">
          <span v-if="icon" class="wr-dialog-icon">
            <el-icon :size="17"><component :is="icon" /></el-icon>
          </span>
          <slot name="icon" />
          <div class="wr-dialog-title">
            <h2>{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div class="wr-dialog-actions">
          <slot name="actions" />
          <button type="button" class="wr-dialog-close" aria-label="关闭" @click="close">
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>
      </header>
    </template>

    <el-scrollbar v-if="!fillHeight" class="wr-dialog-body">
      <div class="wr-dialog-body-inner">
        <slot />
      </div>
    </el-scrollbar>
    <div v-else class="wr-dialog-body">
      <slot />
    </div>

    <template v-if="showFooter" #footer>
      <footer class="wr-dialog-footer">
        <slot name="footer" />
      </footer>
    </template>
  </el-dialog>
</template>

<style>
.wr-app-dialog {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.wr-app-dialog.is-fill {
  height: calc(100vh - 40px);
  max-height: calc(100vh - 40px);
}

.wr-app-dialog .el-dialog__header {
  padding: 0;
  margin: 0;
  flex: none;
}

.wr-app-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  color: var(--el-text-color-regular);
}

.wr-app-dialog .el-dialog__footer {
  flex: none;
  padding: 0;
}

.wr-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.wr-dialog-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wr-dialog-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.wr-dialog-title {
  min-width: 0;
}

.wr-dialog-title h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 650;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wr-dialog-title p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wr-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.wr-dialog-actions .el-button + .el-button {
  margin-left: 0;
}

.wr-dialog-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.wr-dialog-close:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.wr-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wr-dialog-body > * {
  min-height: 0;
}

.wr-dialog-body-inner {
  display: flex;
  flex-direction: column;
}

.wr-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.wr-dialog-footer .el-button + .el-button {
  margin-left: 0;
}
</style>
