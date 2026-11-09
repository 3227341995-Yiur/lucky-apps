<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ReportPage from '@/components/report/ReportPage.vue'
import { useReports } from '@/composables/useReports'
import { debounce } from '@/utils/debounce'
import { getCopySettings, renderCopyContent } from '@/utils/reportExport'
import { getTemplateTypes } from '@/services/templateService'
import { events } from '@/utils/eventBus'
import { formatDateTime } from '@/utils/date'
import { createDefaultLayout, extractLayout, normalizeReportLayout } from '@/config/reportLayout'

defineOptions({ name: 'ReportEditor' })

const emit = defineEmits(['open-import-export', 'open-design'])

const reports = useReports()
const { state } = reports

const copySettings = ref({ enabled: true, defaultType: 'html' })
const copyTypes = ref([
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' }
])
const copyBusy = ref(false)
const defaultCopyLabel = computed(() => {
  const type = copySettings.value.defaultType
  return copyTypes.value.find(item => item.value === type)?.label || String(type || 'HTML')
})
let offCopySettings = null

async function loadCopyOptions() {
  try {
    const [settings, types] = await Promise.all([getCopySettings(), getTemplateTypes()])
    copyTypes.value = types.length ? types : [
      { value: 'html', label: 'HTML' },
      { value: 'markdown', label: 'Markdown' }
    ]
    copySettings.value = {
      enabled: settings.enabled,
      defaultType: types.some(item => item.value === settings.defaultType)
        ? settings.defaultType
        : (types[0]?.value || 'html')
    }
  } catch (error) {
    console.warn('[editor] 加载复制设置失败:', error)
  }
}

const dirty = ref(false)
const savedVisible = ref(false)
const viewportRef = ref(null)
const zoom = ref(1)
let savedTimer = null
let pendingReport = null
let resizeObserver = null

const persist = debounce(async () => {
  const report = pendingReport
  if (!report) return
  pendingReport = null
  const ok = await reports.saveReportSnapshot(report)
  dirty.value = false
  if (!ok) return
  savedVisible.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedVisible.value = false }, 1800)
}, 700)

function scheduleSave() {
  if (!state.currentReport) return
  pendingReport = state.currentReport
  dirty.value = true
  persist()
}

function flushPending() {
  if (pendingReport) persist.flush()
}

watch(() => state.currentId, (next, previous) => {
  if (previous != null && pendingReport?.id === previous) flushPending()
})

function isAutoLayout(layout, sections) {
  const elements = layout?.elements || []
  const page = layout?.page || {}
  const contentWidth = page.width - (page.padding || 0) * 2
  const sectionElements = elements.filter(element => element.type === 'section')
  if (sectionElements.length !== sections.length) return false
  if (elements.some(element => !['title', 'date', 'section'].includes(element.type))) return false

  let expectedY = 136
  for (const section of sections) {
    const element = sectionElements.find(item => item.sectionType === section.type)
    if (!element) return false
    if (element.x !== page.padding || element.w !== contentWidth) return false
    if (Math.abs(element.y - expectedY) > 1) return false
    expectedY += (element.h || 190) + 18
  }
  return true
}

watch(() => state.currentReport, report => {
  if (!report) return
  report.sections = (report.sections || []).map(section => ({
    ...section,
    columns: Array.isArray(section.columns) ? section.columns : [],
    items: Array.isArray(section.items) ? section.items : []
  }))
  if (!report.layout || !Array.isArray(report.layout.elements) || !report.layout.elements.length) {
    report.layout = extractLayout(createDefaultLayout(report.sections))
  } else if (isAutoLayout(report.layout, report.sections)) {
    // 旧版自动排版的区块间距已过期：按当前默认版面重新排版，保持内容与自由画布元素不变
    report.layout = extractLayout(createDefaultLayout(report.sections))
  }
}, { immediate: true })

const layout = computed(() => {
  if (!state.currentReport) return null
  return normalizeReportLayout(state.currentReport.layout, state.currentReport.sections || [])
})

const itemCount = computed(() => (state.currentReport?.sections || [])
  .reduce((total, section) => total + (section.items?.length || 0), 0))
const updatedText = computed(() => {
  const timestamp = state.lastSavedAt || state.currentReport?.updated_at
  return timestamp ? `更新于 ${formatDateTime(timestamp)}` : ''
})

function fitPage() {
  const width = viewportRef.value?.clientWidth || 0
  const pageWidth = layout.value?.page?.width || 794
  if (!width) return
  zoom.value = Math.min(1.4, Math.max(0.4, (width - 56) / pageWidth))
}

onMounted(() => {
  resizeObserver = new ResizeObserver(fitPage)
  if (viewportRef.value) resizeObserver.observe(viewportRef.value)
  fitPage()
  loadCopyOptions()
  offCopySettings = events.on('template:copy-settings', loadCopyOptions)
})

watch(() => layout.value?.page?.width, fitPage)

onBeforeUnmount(() => {
  flushPending()
  persist.cancel()
  clearTimeout(savedTimer)
  resizeObserver?.disconnect()
  offCopySettings?.()
})

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function copyContent(type) {
  if (!state.currentReport || copyBusy.value) return
  copyBusy.value = true
  const target = copySettings.value.enabled
    ? (typeof type === 'string' && type ? type : copySettings.value.defaultType)
    : 'canvas'
  try {
    const content = await renderCopyContent(state.currentReport, target, copySettings.value)
    await copyText(content)
    const label = copySettings.value.enabled
      ? (copyTypes.value.find(item => item.value === target)?.label || target)
      : '画布'
    ElMessage.success(`已复制 ${label} 内容`)
  } catch (error) {
    ElMessage.error(`复制失败: ${error.message}`)
  } finally {
    copyBusy.value = false
  }
}

async function moveToTrash() {
  if (!state.currentReport) return
  try {
    await ElMessageBox.confirm(
      `确定把「${state.currentReport.title}」移入回收站吗？`,
      '删除确认',
      { confirmButtonText: '移入回收站', cancelButtonText: '取消', type: 'warning' }
    )
    flushPending()
    await reports.deleteReport(state.currentReport.id)
    ElMessage.success('已移入回收站')
  } catch {
    // 用户取消
  }
}

function handleCommand(command) {
  if (command === 'trash') moveToTrash()
  else if (command === 'design') emit('open-design')
  else if (command === 'io') emit('open-import-export')
}
</script>

<template>
  <div class="wr-editor">
    <header class="editor-bar">
      <div class="editor-context">
        <span class="editor-label">WEEKLY REPORT</span>
        <span class="editor-meta">
          {{ state.currentReport.sections.length }} 区块 · {{ itemCount }} 条记录
          <span class="meta-sep">/</span>
          {{ updatedText }}
        </span>
      </div>

      <div class="editor-actions">
        <span class="save-state" :class="{ dirty, visible: savedVisible }">
          <el-icon v-if="dirty" class="is-loading"><Loading /></el-icon>
          <el-icon v-else><CircleCheck /></el-icon>
          <span>{{ dirty ? '保存中…' : '已保存' }}</span>
        </span>

        <el-dropdown
          v-if="copySettings.enabled"
          split-button
          trigger="click"
          placement="bottom-end"
          class="editor-copy"
          @click="copyContent()"
          @command="copyContent"
        >
          <el-icon><CopyDocument /></el-icon>
          <span>复制 {{ defaultCopyLabel }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in copyTypes"
                :key="item.value"
                :command="item.value"
              >
                <span>{{ item.label }}</span>
                <span v-if="item.value === copySettings.defaultType" class="copy-default-tag">默认</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-else class="editor-action" @click="copyContent()">
          <el-icon><CopyDocument /></el-icon>
          <span>复制画布</span>
        </el-button>

        <el-button class="editor-action" type="primary" @click="emit('open-import-export', 'export')">
          <el-icon><Download /></el-icon>
          <span>导出</span>
        </el-button>

        <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
          <el-button text circle title="更多">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="design">
                <el-icon><MagicStick /></el-icon> 画布设计 / 排版
              </el-dropdown-item>
              <el-dropdown-item command="io">
                <el-icon><Sort /></el-icon> 导入 / 备份
              </el-dropdown-item>
              <el-dropdown-item command="trash" divided>
                <el-icon><Delete /></el-icon> 移入回收站
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div ref="viewportRef" class="editor-viewport">
      <el-scrollbar class="editor-scroll">
        <div class="page-stage">
          <div class="page-zoom" :style="{ zoom, '--page-zoom-inverse': 1 / zoom }">
            <ReportPage
              v-if="layout"
              :report="state.currentReport"
              :layout="layout"
              @change="scheduleSave"
            />
          </div>
          <div class="page-caption">
            <span>{{ layout?.page?.width }} × {{ layout?.page?.height }} px</span>
            <span>A4 画布 · {{ Math.round(zoom * 100) }}%</span>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.wr-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--wr-bg);
}

.editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  height: 46px;
  min-height: 46px;
  padding: 0 22px;
  border-bottom: 1px solid var(--wr-border);
  background: var(--wr-surface);
}

.editor-context {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.editor-label {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--el-color-primary);
}

.editor-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-sep {
  color: var(--el-border-color-dark);
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.editor-action {
  min-width: 78px;
  height: 30px;
  padding: 0 12px;
  justify-content: center;
}

.editor-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.editor-action :deep(.el-icon) {
  margin-right: 4px;
}

.editor-copy {
  display: inline-flex;
}

.editor-copy :deep(.el-button) {
  height: 30px;
}

.copy-default-tag {
  margin-left: 8px;
  font-size: 10px;
  color: var(--el-color-primary);
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 6px;
  font-size: 11px;
  color: var(--el-color-success);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.save-state.dirty,
.save-state.visible {
  opacity: 1;
}

.save-state.dirty {
  color: var(--el-text-color-secondary);
}

.editor-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: var(--wr-bg);
  background-image: radial-gradient(circle at 1px 1px, var(--el-border-color) 0.7px, transparent 0);
  background-size: 18px 18px;
}

.editor-scroll {
  height: 100%;
}

.page-stage {
  width: max-content;
  min-width: 100%;
  padding: 22px 24px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-zoom {
  box-shadow: var(--wr-shadow-md);
}

.page-caption {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 900px) {
  .editor-bar {
    padding: 8px 14px;
  }

  .editor-label,
  .save-state {
    display: none;
  }

  .page-stage {
    padding: 18px 12px 32px;
  }
}
</style>
