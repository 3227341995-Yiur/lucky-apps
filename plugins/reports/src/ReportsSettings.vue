<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWeekReport } from 'plugin-api'

defineOptions({ name: 'ReportsSettings' })

const api = useWeekReport()
const resources = ref([])
const loading = ref(false)

const KINDS = {
  'component-canvas': { label: '画布组件', hint: '拖入自由画布的外部组件' },
  'component-column': { label: '列组件', hint: '表格单元格 / 列编辑的外部组件' },
}

const canvasComponents = computed(() => resources.value.filter(item => item.componentKind === 'canvas' || item.kind === 'component-canvas'))
const columnComponents = computed(() => resources.value.filter(item => item.componentKind === 'column' || item.kind === 'component-column'))

function statusOf(resource) {
  if (resource.status === 'error') return { label: '加载失败', type: 'danger' }
  if (!resource.enabled) return { label: '已禁用', type: 'info' }
  return { label: '已加载', type: 'success' }
}

async function load() {
  loading.value = true
  try {
    const list = await api.extensions.list()
    resources.value = (list || []).filter(item => item.kind === 'component')
  } catch (error) {
    ElMessage.error(`读取组件失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

async function toggle(resource) {
  let enabled
  try {
    enabled = await api.extensions.toggle(resource.id)
  } catch (error) {
    ElMessage.error(`保存设置失败：${error?.message || error}`)
    return
  }
  if (enabled === null || enabled === undefined) return
  try {
    await ElMessageBox.confirm(
      `已${enabled ? '启用' : '禁用'}「${resource.name}」，需要重新加载应用后生效。是否立即重新加载？`,
      '需要重新加载',
      { confirmButtonText: '立即重新加载', cancelButtonText: '稍后', type: 'info' },
    )
    window.location.reload()
  } catch {
    ElMessage.info('设置已保存，下次启动生效')
  }
}

async function rescan() {
  loading.value = true
  try {
    await api.extensions.rescan()
    await load()
    ElMessage.success('已重新扫描组件')
  } catch (error) {
    ElMessage.error(`重新扫描失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="report-components">
    <div class="rc-head">
      <div>
        <strong>周报组件</strong>
        <p>画布组件与列组件属于周报本体能力，在这里统一维护；功能插件在「扩展」页管理。</p>
      </div>
      <el-button size="small" :loading="loading" @click="rescan">
        <el-icon><Refresh /></el-icon><span>重新扫描</span>
      </el-button>
    </div>

    <div v-loading="loading" class="rc-body">
      <section class="rc-group">
        <div class="rc-group-head">
          <span>{{ KINDS['component-canvas'].label }}</span>
          <small>{{ KINDS['component-canvas'].hint }}</small>
          <span class="rc-count">{{ canvasComponents.length }}</span>
        </div>
        <div v-if="!canvasComponents.length" class="rc-empty">暂无画布组件</div>
        <div v-for="resource in canvasComponents" :key="resource.id" class="rc-item">
          <span class="rc-icon"><el-icon :size="15"><Grid /></el-icon></span>
          <div class="rc-info">
            <div class="rc-line">
              <span class="rc-name">{{ resource.name }}</span>
              <el-tag size="small" effect="light" round :type="statusOf(resource).type">
                {{ statusOf(resource).label }}
              </el-tag>
            </div>
            <code v-if="resource.file" class="rc-file">{{ resource.file }}</code>
            <p v-if="resource.error" class="rc-error">{{ resource.error }}</p>
          </div>
          <el-switch
            :model-value="resource.enabled"
            :aria-label="`启用 ${resource.name}`"
            @change="toggle(resource)"
          />
        </div>
      </section>

      <section class="rc-group">
        <div class="rc-group-head">
          <span>{{ KINDS['component-column'].label }}</span>
          <small>{{ KINDS['component-column'].hint }}</small>
          <span class="rc-count">{{ columnComponents.length }}</span>
        </div>
        <div v-if="!columnComponents.length" class="rc-empty">暂无列组件</div>
        <div v-for="resource in columnComponents" :key="resource.id" class="rc-item">
          <span class="rc-icon"><el-icon :size="15"><Grid /></el-icon></span>
          <div class="rc-info">
            <div class="rc-line">
              <span class="rc-name">{{ resource.name }}</span>
              <el-tag size="small" effect="light" round :type="statusOf(resource).type">
                {{ statusOf(resource).label }}
              </el-tag>
            </div>
            <code v-if="resource.file" class="rc-file">{{ resource.file }}</code>
            <p v-if="resource.error" class="rc-error">{{ resource.error }}</p>
          </div>
          <el-switch
            :model-value="resource.enabled"
            :aria-label="`启用 ${resource.name}`"
            @change="toggle(resource)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.report-components {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.rc-head strong {
  display: block;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
}

.rc-head p {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.rc-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rc-group {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.rc-group-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.rc-group-head > span:first-child {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.rc-group-head small {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.rc-count {
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color);
  font-size: 10px;
  line-height: 17px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.rc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.rc-item + .rc-item {
  margin-top: 6px;
}

.rc-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-border-color-lighter);
}

.rc-info {
  flex: 1;
  min-width: 0;
}

.rc-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.rc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.rc-file {
  display: block;
  margin-top: 3px;
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
  overflow-wrap: anywhere;
}

.rc-error {
  margin: 4px 0 0;
  font-size: 10.5px;
  color: var(--el-color-danger);
  overflow-wrap: anywhere;
}

.rc-empty {
  padding: 14px 4px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
