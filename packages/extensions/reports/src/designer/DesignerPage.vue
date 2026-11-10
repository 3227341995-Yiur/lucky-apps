<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Check, CopyDocument, MoreFilled, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { useWeekReport } from 'plugin-api'
import LayoutPalette from './components/LayoutPalette.vue'
import LayoutCanvas from './components/LayoutCanvas.vue'
import LayoutInspector from './components/LayoutInspector.vue'
import ReportPage from './components/ReportPage.vue'
import {
  cloneConfig,
  createRow,
  createSectionsFromConfig,
  normalizeReportConfig,
} from './config/defaultReportConfig.ts'
import {
  createDefaultLayout,
  createSectionFromPreset,
  createWidget,
  extractLayout,
  normalizeLayoutConfig,
} from './config/reportLayout.ts'
import { generateId } from './utils/idGenerator.ts'
import { getWeekRange } from './utils/date.ts'

defineOptions({ name: 'StructureDesignerPage' })

const props = defineProps({ embedded: { type: Boolean, default: false } })

const api = useWeekReport()

const draft = ref(createDefaultLayout())
const loading = ref(false)
const saving = ref(false)
const applying = ref(false)
const preview = ref(false)
const selectedId = ref(null)
const draggingWidget = ref(null)
const dragElementId = ref(null)
const previewReport = ref(null)
const previewLayout = ref(null)

const reports = ref([])
const reportsLoading = ref(false)
const selectedReportId = ref(null)

const history = ref([])
const historyIndex = ref(-1)
let historyTimer = null
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const selectedElement = computed(() => (
  draft.value.elements.find(element => element.id === selectedId.value) || null
))
const selectedSection = computed(() => {
  const type = selectedElement.value?.sectionType
  return type ? draft.value.sections.find(section => section.type === type) || null : null
})

function resetHistory() {
  history.value = [JSON.stringify(draft.value)]
  historyIndex.value = 0
  clearTimeout(historyTimer)
  historyTimer = null
}

function recordOnce() {
  if (historyTimer) return
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(JSON.stringify(draft.value))
  if (history.value.length > 80) history.value.shift()
  historyIndex.value = history.value.length - 1
  historyTimer = setTimeout(() => {
    historyTimer = null
  }, 500)
}

function undo() {
  if (!canUndo.value) return
  clearTimeout(historyTimer)
  historyTimer = null
  historyIndex.value -= 1
  draft.value = JSON.parse(history.value[historyIndex.value])
  selectedId.value = null
}

function redo() {
  if (!canRedo.value) return
  clearTimeout(historyTimer)
  historyTimer = null
  historyIndex.value += 1
  draft.value = JSON.parse(history.value[historyIndex.value])
  selectedId.value = null
}

function preparePreview() {
  previewLayout.value = cloneConfig(draft.value)
  previewReport.value = {
    title: '工作周报',
    dateRange: getWeekRange(),
    sections: createSectionsFromConfig(draft.value.sections),
  }
}

watch(preview, (value) => {
  if (value) preparePreview()
  else {
    previewReport.value = null
    previewLayout.value = null
  }
})

async function loadDraft() {
  loading.value = true
  selectedId.value = null
  preview.value = false
  try {
    draft.value = normalizeLayoutConfig(await api.config.get())
  } catch (error) {
    console.error('[designer] 加载画布失败:', error)
    api.ui.toast('加载画布失败，已回退为默认画布', 'error')
    draft.value = createDefaultLayout()
  } finally {
    resetHistory()
    loading.value = false
  }
}

async function loadReports() {
  reportsLoading.value = true
  try {
    reports.value = await api.reports.list({ limit: 200, offset: 0 })
  } catch (error) {
    api.ui.toast(error?.message || '加载周报列表失败', 'error')
  } finally {
    reportsLoading.value = false
  }
}

function reportLabel(report) {
  const range = Array.isArray(report.dateRange) ? report.dateRange.join(' ~ ') : report.dateRange || ''
  return range ? `${report.title} · ${range}` : report.title
}

function selectElement(id) {
  selectedId.value = id || null
}

function updateElement(id, patch) {
  const element = draft.value.elements.find(item => item.id === id)
  if (element) {
    recordOnce()
    Object.assign(element, patch)
  }
}

function updateSection(section) {
  const index = draft.value.sections.findIndex(item => item.type === section.type)
  if (index !== -1) {
    recordOnce()
    draft.value.sections[index] = section
  }
}

function updatePage(patch) {
  recordOnce()
  Object.assign(draft.value.page, patch)
  if (patch.width) {
    draft.value.elements.forEach((element) => {
      if (element.x + element.w > draft.value.page.width) {
        element.x = Math.max(0, draft.value.page.width - element.w)
      }
    })
  }
}

function deleteElement(element) {
  const index = draft.value.elements.findIndex(item => item.id === element.id)
  if (index === -1) return
  recordOnce()
  draft.value.elements.splice(index, 1)
  if (selectedId.value === element.id) selectedId.value = null

  if (element.type === 'section' && !draft.value.elements.some(item => item.sectionType === element.sectionType)) {
    draft.value.sections = draft.value.sections.filter(section => section.type !== element.sectionType)
  }
}

function duplicateElement(element) {
  recordOnce()
  const copy = cloneConfig(element)
  copy.id = generateId()
  copy.x = Math.min(draft.value.page.width - copy.w, copy.x + 16)
  copy.y = copy.y + 16
  draft.value.elements.push(copy)
  selectedId.value = copy.id
}

// 拖拽时直接把真实元素放进画布，移动的就是最终 DOM，放下不重新创建
function removeDragElement() {
  const id = dragElementId.value
  if (!id) return
  const index = draft.value.elements.findIndex(element => element.id === id)
  if (index !== -1) {
    const [removed] = draft.value.elements.splice(index, 1)
    if (removed?.type === 'section' && removed.sectionType) {
      const used = draft.value.elements.some(element => element.sectionType === removed.sectionType)
      if (!used) draft.value.sections = draft.value.sections.filter(section => section.type !== removed.sectionType)
    }
  }
  dragElementId.value = null
}

function handleDragStart({ widget }) {
  if (!widget) {
    draggingWidget.value = null
    return
  }
  removeDragElement()
  selectedId.value = null
  const page = draft.value.page
  const w = Math.min(widget.w || 320, page.width)
  const h = widget.h || (widget.kind === 'section' ? 210 : 60)

  let section = null
  if (widget.kind === 'section') {
    section = createSectionFromPreset(widget.preset || null, draft.value.sections)
    draft.value.sections.push(section)
  }

  const element = createWidget(widget.type, {
    x: page.padding,
    y: page.padding,
    w,
    h,
    component: widget.component,
    props: widget.props,
    text: widget.text,
  })
  if (section) element.sectionType = section.type
  draft.value.elements.push(element)
  dragElementId.value = element.id
  draggingWidget.value = widget
}

function updateDragElement(id, patch) {
  const element = draft.value.elements.find(item => item.id === id)
  if (element) Object.assign(element, patch)
}

function handleDragEnd({ commit } = {}) {
  const id = dragElementId.value
  draggingWidget.value = null
  if (!id) return
  if (commit) {
    dragElementId.value = null
    selectedId.value = id
    clearTimeout(historyTimer)
    historyTimer = null
    recordOnce()
    return
  }
  removeDragElement()
}

function validate() {
  if (!draft.value.elements.length) {
    api.ui.toast('请至少放置一个元素', 'warning')
    return false
  }
  for (const element of draft.value.elements) {
    if (element.type === 'section') {
      const section = draft.value.sections.find(item => item.type === element.sectionType)
      if (!section || !section.columns.length) {
        api.ui.toast('存在没有列的数据表格，请补充列或删除该元素', 'warning')
        return false
      }
    }
  }
  return true
}

async function handleSave() {
  if (saving.value) return
  if (!validate()) return
  saving.value = true
  try {
    await api.config.set(normalizeLayoutConfig(draft.value))
    resetHistory()
    api.ui.toast('画布已保存为默认周报版面', 'success')
  } catch (error) {
    api.ui.toast(`保存失败：${error?.message || error}`, 'error')
  } finally {
    saving.value = false
  }
}

async function handleApply() {
  if (applying.value) return
  if (!selectedReportId.value) {
    api.ui.toast('请先选择要应用的周报', 'warning')
    return
  }
  if (!validate()) return
  applying.value = true
  try {
    const config = normalizeLayoutConfig(draft.value)
    const report = await api.reports.get(selectedReportId.value)
    if (!report) throw new Error('周报不存在或已删除')
    const oldSections = report.sections || []
    // 同 type 的区块保留原有数据行，新区块生成一行默认数据
    report.sections = normalizeReportConfig(config.sections).map((section) => {
      const previous = oldSections.find(item => item.type === section.type)
      return {
        ...cloneConfig(section),
        items: previous?.items?.length ? cloneConfig(previous.items) : [createRow(section.columns)],
      }
    })
    report.layout = extractLayout(config)
    await api.reports.update(report)
    api.ui.toast(`已应用到「${report.title}」`, 'success')
  } catch (error) {
    api.ui.toast(`应用失败：${error?.message || error}`, 'error')
  } finally {
    applying.value = false
  }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm(
      '恢复系统默认版面会丢失当前画布上的布局与样式调整，确定继续吗？',
      '恢复默认版面',
      { confirmButtonText: '恢复默认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  recordOnce()
  draft.value = createDefaultLayout(draft.value.sections)
  selectedId.value = null
  api.ui.toast('已重置为默认版面', 'success')
}

async function handleCopyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(normalizeLayoutConfig(draft.value), null, 2))
    api.ui.toast('画布 JSON 已复制到剪贴板', 'success')
  } catch {
    api.ui.toast('复制失败，请检查剪贴板权限', 'error')
  }
}

function alignElement(direction) {
  const element = selectedElement.value
  if (!element) return
  recordOnce()
  const page = draft.value.page
  const padding = page.padding
  if (direction === 'left') element.x = padding
  else if (direction === 'right') element.x = page.width - padding - element.w
  else if (direction === 'hcenter') element.x = Math.round((page.width - element.w) / 2)
  else if (direction === 'top') element.y = padding
  else if (direction === 'bottom') element.y = page.height - padding - element.h
  else if (direction === 'vcenter') element.y = Math.round((page.height - element.h) / 2)
}

function moveLayer(element, direction) {
  if (!element) return
  const index = draft.value.elements.findIndex(item => item.id === element.id)
  if (index === -1) return
  recordOnce()
  const [item] = draft.value.elements.splice(index, 1)
  if (direction === 'front') draft.value.elements.push(item)
  else draft.value.elements.unshift(item)
}

function onDesignerKeydown(event) {
  const target = event.target
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier) return
  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  } else if (key === 'y') {
    event.preventDefault()
    redo()
  }
}

function handleCommand(command) {
  if (command === 'reset') handleReset()
  else if (command === 'copy') handleCopyJson()
}

onMounted(() => {
  loadDraft()
  loadReports()
  window.addEventListener('keydown', onDesignerKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onDesignerKeydown)
  clearTimeout(historyTimer)
})
</script>

<template>
  <el-scrollbar class="wr-page designer-page" :class="{ 'is-embedded': props.embedded }">
    <div class="wr-page-inner designer-inner">
      <header class="designer-header">
        <div v-if="!props.embedded" class="header-main">
          <div class="wr-eyebrow">Designer</div>
          <div class="title-row">
            <h1 class="wr-page-title">周报设计</h1>
            <span class="wr-chip">{{ draft.elements.length }} 个元素</span>
            <span class="wr-chip">{{ draft.page.width }} × {{ draft.page.height }}</span>
          </div>
          <p class="wr-page-subtitle">自由画布设计周报版面：拖拽组件、调整样式与交互，保存为默认版面或应用到已有周报。</p>
        </div>

        <div class="header-actions">
          <div class="preview-toggle">
            <el-switch v-model="preview" size="small" />
            <span>交互预览</span>
          </div>
          <el-button size="small" text circle title="撤销 Ctrl+Z" :disabled="!canUndo" @click="undo">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
          <el-button size="small" text circle title="重做 Ctrl+Shift+Z" :disabled="!canRedo" @click="redo">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
          <el-select
            v-model="selectedReportId"
            size="small"
            filterable
            clearable
            placeholder="选择要应用的周报"
            class="apply-select"
            :loading="reportsLoading"
          >
            <el-option v-for="report in reports" :key="report.id" :label="reportLabel(report)" :value="report.id" />
          </el-select>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!selectedReportId || loading"
            :loading="applying"
            @click="handleApply"
          >
            <el-icon><Check /></el-icon>
            <span>应用到周报</span>
          </el-button>
          <el-button size="small" type="primary" :loading="saving" :disabled="loading || preview" @click="handleSave">
            保存默认版面
          </el-button>
          <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
            <el-button text circle size="small" title="更多">
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="copy">
                  <el-icon><CopyDocument /></el-icon> 复制画布 JSON
                </el-dropdown-item>
                <el-dropdown-item command="reset" divided>
                  恢复默认版面
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div v-if="preview" class="designer-preview">
        <div class="preview-bar">
          <span>交互预览</span>
          <span>可点击表格、状态、日期等真实组件，并执行组件交互；预览修改不会写入当前周报</span>
        </div>
        <el-scrollbar class="preview-canvas">
          <div class="preview-canvas-inner">
            <ReportPage
              v-if="previewReport && previewLayout"
              :report="previewReport"
              :layout="previewLayout"
              interactive
            />
          </div>
        </el-scrollbar>
      </div>

      <div v-else class="designer-body" v-loading="loading" element-loading-text="正在加载画布…">
        <LayoutPalette @drag-start="handleDragStart" />

        <div class="designer-canvas-area">
          <LayoutCanvas
            :layout="draft"
            :selected-id="selectedId"
            :dragging-widget="draggingWidget"
            :drag-element-id="dragElementId"
            @select="selectElement"
            @update-element="updateElement"
            @update-drag-element="updateDragElement"
            @drag-end="handleDragEnd"
            @delete-element="deleteElement"
            @duplicate-element="duplicateElement"
          />
        </div>

        <LayoutInspector
          :layout="draft"
          :element="selectedElement"
          :section="selectedSection"
          @update-element="patch => updateElement(selectedId, patch)"
          @update-section="updateSection"
          @update-page="updatePage"
          @delete-element="deleteElement"
          @duplicate-element="duplicateElement"
          @align-element="alignElement"
          @move-layer="moveLayer"
        />
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.designer-page {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.designer-page :deep(.el-scrollbar__view) {
  height: 100%;
}

.designer-inner {
  max-width: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 20px;
}

.designer-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  flex: none;
  margin-bottom: 16px;
}

.header-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.header-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.apply-select {
  width: 220px;
}

.preview-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.designer-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
  box-shadow: var(--wr-shadow-sm);
}

.designer-canvas-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.designer-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background-color: var(--wr-bg);
  background-image: radial-gradient(circle at 1px 1px, var(--el-border-color) 0.8px, transparent 0);
  background-size: 20px 20px;
}

.preview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  height: 32px;
  padding: 0 18px;
  border-bottom: 1px solid var(--wr-border);
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
}

.preview-bar span:first-child {
  font-family: var(--wr-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.preview-canvas {
  flex: 1;
  min-height: 0;
}

.preview-canvas-inner {
  padding: 26px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

@media (max-width: 900px) {
  .designer-header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
