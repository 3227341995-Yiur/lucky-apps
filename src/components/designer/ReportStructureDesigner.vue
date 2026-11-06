<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, CopyDocument, MoreFilled, RefreshLeft, RefreshRight, WarningFilled } from '@element-plus/icons-vue'
import AppDialog from '@/components/common/AppDialog.vue'
import LayoutPalette from './LayoutPalette.vue'
import LayoutCanvas from './LayoutCanvas.vue'
import LayoutInspector from './LayoutInspector.vue'
import ReportPage from '@/components/report/ReportPage.vue'
import { getReportConfig, saveReportConfig } from '@/services/reportConfigService'
import { cloneConfig, createSectionsFromConfig } from '@/config/defaultReportConfig'
import {
  createDefaultLayout,
  createSectionFromPreset,
  createWidget,
  normalizeLayoutConfig
} from '@/config/reportLayout'
import { generateId } from '@/utils/idGenerator'
import { getWeekRange } from '@/utils/date'

defineOptions({ name: 'ReportStructureDesigner' })

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  mode: {
    type: String,
    default: 'edit',
    validator: value => ['edit', 'view'].includes(value)
  },
  currentReport: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['saved', 'apply'])

const draft = ref(createDefaultLayout())
const baseline = ref('')
const loading = ref(false)
const saving = ref(false)
const preview = ref(false)
const selectedId = ref(null)
const draggingWidget = ref(null)
const dragElementId = ref(null)
const closeConfirm = ref(false)
const pendingClose = ref(null)
const previewReport = ref(null)
const previewLayout = ref(null)

const history = ref([])
const historyIndex = ref(-1)
let historyTimer = null
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const isView = computed(() => props.mode === 'view')
const canApply = computed(() => !isView.value && Boolean(props.currentReport))
const selectedElement = computed(() => (
  draft.value.elements.find(element => element.id === selectedId.value) || null
))
const selectedSection = computed(() => {
  const type = selectedElement.value?.sectionType
  return type ? draft.value.sections.find(section => section.type === type) || null : null
})
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)
const dialogTitle = computed(() => (
  isView.value ? '周报画布（只读）' : '周报画布设计器'
))
const dialogSubtitle = computed(() => (
  `自由画布 · ${draft.value.elements.length} 个元素 · ${draft.value.page.width} × ${draft.value.page.height}`
))

function takeSnapshot() {
  return JSON.stringify(draft.value)
}

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
  const current = props.currentReport
  previewLayout.value = cloneConfig(draft.value)
  previewReport.value = {
    title: current?.title || '工作周报',
    dateRange: Array.isArray(current?.dateRange) && current.dateRange.length
      ? [...current.dateRange]
      : getWeekRange(),
    sections: current?.sections?.length
      ? cloneConfig(current.sections)
      : createSectionsFromConfig(draft.value.sections)
  }
}

watch(preview, value => {
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
    draft.value = normalizeLayoutConfig(await getReportConfig())
  } catch (error) {
    console.error('[designer] 加载画布失败:', error)
    ElMessage.error('加载画布失败，已回退为默认画布')
    draft.value = createDefaultLayout()
  } finally {
    baseline.value = takeSnapshot()
    resetHistory()
    loading.value = false
  }
}

watch(
  visible,
  value => {
    if (value) {
      closeConfirm.value = false
      pendingClose.value = null
      loadDraft()
    }
  },
  { immediate: true }
)

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
    draft.value.elements.forEach(element => {
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
  if (!widget || isView.value) {
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
    text: widget.text
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
    ElMessage.warning('请至少放置一个元素')
    return false
  }
  for (const element of draft.value.elements) {
    if (element.type === 'section') {
      const section = draft.value.sections.find(item => item.type === element.sectionType)
      if (!section || !section.columns.length) {
        ElMessage.warning('存在没有列的数据表格，请补充列或删除该元素')
        return false
      }
    }
  }
  return true
}

async function handleSave() {
  if (isView.value || saving.value) return
  if (!validate()) return
  saving.value = true
  try {
    const saved = await saveReportConfig(normalizeLayoutConfig(draft.value))
    baseline.value = JSON.stringify(saved)
    resetHistory()
    emit('saved', cloneConfig(saved))
    ElMessage.success('画布已保存为默认周报版面')
    visible.value = false
  } catch (error) {
    ElMessage.error(`保存失败：${error?.message || error}`)
  } finally {
    saving.value = false
  }
}

function handleApply() {
  if (isView.value || !props.currentReport) return
  if (!validate()) return
  emit('apply', normalizeLayoutConfig(draft.value))
}

async function handleReset() {
  if (isView.value) return
  try {
    await ElMessageBox.confirm(
      '恢复系统默认版面会丢失当前画布上的布局与样式调整，确定继续吗？',
      '恢复默认版面',
      { confirmButtonText: '恢复默认', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  recordOnce()
  draft.value = createDefaultLayout(draft.value.sections)
  selectedId.value = null
  ElMessage.success('已重置为默认版面')
}

async function handleCopyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(normalizeLayoutConfig(draft.value), null, 2))
    ElMessage.success('画布 JSON 已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请检查剪贴板权限')
  }
}

function alignElement(direction) {
  const element = selectedElement.value
  if (!element || isView.value) return
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
  if (!element || isView.value) return
  const index = draft.value.elements.findIndex(item => item.id === element.id)
  if (index === -1) return
  recordOnce()
  const [item] = draft.value.elements.splice(index, 1)
  if (direction === 'front') draft.value.elements.push(item)
  else draft.value.elements.unshift(item)
}

function onDesignerKeydown(event) {
  if (!visible.value || isView.value) return
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

function handleBeforeClose(done) {
  if (!dirty.value) {
    done()
    return
  }
  pendingClose.value = done
  closeConfirm.value = true
}

function cancelClose() {
  closeConfirm.value = false
  pendingClose.value = null
}

function confirmClose() {
  const done = pendingClose.value
  cancelClose()
  done?.()
}

onMounted(() => {
  window.addEventListener('keydown', onDesignerKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onDesignerKeydown)
  clearTimeout(historyTimer)
})
</script>

<template>
  <AppDialog
    v-model="visible"
    :title="dialogTitle"
    :subtitle="dialogSubtitle"
    icon="SetUp"
    width="96vw"
    fill-height
    :close-on-press-escape="false"
    :before-close="handleBeforeClose"
  >
    <template #actions>
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
      <el-button v-if="canApply" size="small" type="primary" plain :disabled="loading" @click="handleApply">
        <el-icon><Check /></el-icon>
        <span>应用到当前周报</span>
      </el-button>
      <el-button v-if="!isView" size="small" type="primary" :loading="saving" :disabled="loading || preview" @click="handleSave">
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
            <el-dropdown-item v-if="!isView" command="reset" divided>
              恢复默认版面
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>

    <div v-if="closeConfirm" class="close-confirm">
      <el-icon :size="14"><WarningFilled /></el-icon>
      <span>画布有未保存的修改，关闭后会丢失。</span>
      <div class="close-confirm-actions">
        <el-button size="small" @click="cancelClose">继续编辑</el-button>
        <el-button size="small" type="warning" @click="confirmClose">放弃并关闭</el-button>
      </div>
    </div>

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
      <LayoutPalette
        v-if="!preview && !isView"
        @drag-start="handleDragStart"
      />

      <div class="designer-canvas-area">
        <LayoutCanvas
          :layout="draft"
          :selected-id="preview ? null : selectedId"
          :dragging-widget="draggingWidget"
          :drag-element-id="dragElementId"
          :preview="preview"
          :disabled="isView"
          @select="selectElement"
          @update-element="updateElement"
          @update-drag-element="updateDragElement"
          @drag-end="handleDragEnd"
          @delete-element="deleteElement"
          @duplicate-element="duplicateElement"
        />
      </div>

      <LayoutInspector
        v-if="!preview"
        :layout="draft"
        :element="selectedElement"
        :section="selectedSection"
        :disabled="isView"
        @update-element="patch => updateElement(selectedId, patch)"
        @update-section="updateSection"
        @update-page="updatePage"
        @delete-element="deleteElement"
        @duplicate-element="duplicateElement"
        @align-element="alignElement"
        @move-layer="moveLayer"
      />
    </div>
  </AppDialog>
</template>

<style scoped>
.close-confirm {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
}

.close-confirm > span {
  flex: 1;
}

.close-confirm-actions {
  display: flex;
  gap: 8px;
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
</style>
