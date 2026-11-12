<script setup lang="ts">
import { weekReportApi } from './api'
import { computed, onMounted, ref , inject } from 'vue'
import { ElMessage } from 'element-plus'
import { openReportsDialog } from './dialogs'

defineOptions({ name: 'ReportsSettings' })

const ctx = inject('cordis')
const resources = ref([])
const loading = ref(false)
const stats = ref({ reports: 0, workItems: 0, trash: 0, templates: 0 })

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

async function loadStats() {
  try {
    stats.value = { ...stats.value, ...(await weekReportApi.reports.stats()) }
  } catch {}
}

async function load() {
  loading.value = true
  try {
    const list = await ctx.get('extensions').list()
    resources.value = (list || []).filter(item => item.kind === 'component')
  } catch (error) {
    ElMessage.error(`读取组件失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

async function toggle(resource) {
  try {
    const enabled = await ctx.get('extensions').toggle(resource.id)
    if (enabled === null || enabled === undefined) return
    // Cordis 卸载时会撤销组件注册，直接热切换，不需要重载应用。
    await load()
    ElMessage.success(`已${enabled ? '启用' : '禁用'}「${resource.name}」`)
  } catch (error) {
    ElMessage.error(`切换组件失败：${error?.message || error}`)
  }
}

async function rescan() {
  loading.value = true
  try {
    await ctx.get('extensions').rescan()
    await load()
    ElMessage.success('已重新扫描组件')
  } catch (error) {
    ElMessage.error(`重新扫描失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  loadStats()
})

async function resetConfig() {
  try {
    await ElMessageBox.confirm(
      '将删除自定义的周报结构配置，恢复为系统默认结构。已有周报内容不会受到影响。',
      '恢复系统默认结构',
      { confirmButtonText: '恢复默认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await weekReportApi.config.reset()
    ElMessage.success('已恢复系统默认结构')
  } catch (error) {
    ElMessage.error(`恢复默认结构失败：${error?.message || error}`)
  }
}
</script>

<template>
  <div class="report-components">
    <section class="rc-data">
      <div class="stat-grid">
        <div class="stat-tile"><strong>{{ stats.reports }}</strong><span>周报</span></div>
        <div class="stat-tile"><strong>{{ stats.workItems }}</strong><span>工作项</span></div>
        <div class="stat-tile"><strong>{{ stats.trash }}</strong><span>回收站</span></div>
        <div class="stat-tile"><strong>{{ stats.templates }}</strong><span>模板</span></div>
      </div>
      <div class="data-actions">
        <el-button @click="openReportsDialog('io')">
          <el-icon><Sort /></el-icon><span>导入 / 导出</span>
        </el-button>
        <el-button @click="openReportsDialog('designer')">
          <el-icon><MagicStick /></el-icon><span>打开结构设计器</span>
        </el-button>
      </div>
      <div class="reset-row">
        <div class="reset-text">
          <strong>默认结构</strong>
          <span>仅重置之后新建周报所使用的区块结构，不影响已有周报内容。</span>
        </div>
        <el-button type="danger" plain @click="resetConfig">恢复系统默认结构</el-button>
      </div>
    </section>

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

.rc-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.stat-tile strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.stat-tile span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.data-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.reset-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.reset-text strong {
  font-size: 12.5px;
  color: var(--el-text-color-primary);
}

.reset-text span {
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
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
