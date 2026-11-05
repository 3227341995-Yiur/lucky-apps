<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CopyDocument, Delete, Rank, ZoomIn, ZoomOut, FullScreen } from '@element-plus/icons-vue'
import WidgetView from './WidgetView.vue'
import { layoutBottom } from '@/config/reportLayout'

defineOptions({ name: 'LayoutCanvas' })

const props = defineProps({
  layout: { type: Object, required: true },
  selectedId: { type: [String, Number], default: null },
  draggingWidget: { type: Object, default: null },
  dragElementId: { type: String, default: null },
  preview: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits([
  'select',
  'update-element',
  'update-drag-element',
  'delete-element',
  'duplicate-element',
  'drag-end'
])

const page = computed(() => props.layout.page)
const pageHeight = computed(() => Math.max(page.value.height, layoutBottom(props.layout) + page.value.padding, 320))
const selected = computed(() => props.layout.elements.find(element => element.id === props.selectedId) || null)
const sectionMap = computed(() => new Map((props.layout.sections || []).map(section => [section.type, section])))

const dragOverPage = ref(false)
const dragVisual = ref({ left: 0, top: 0 })
const dragMoved = ref(false)
const editingId = ref(null)
const dragState = ref(null)
const guides = ref({ vertical: [], horizontal: [] })
const scrollRef = ref(null)
const zoom = ref(1)
const autoFit = ref(true)
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

function setZoom(value) {
  autoFit.value = false
  zoom.value = clampZoom(value)
}

function zoomIn() {
  setZoom(zoom.value + 0.1)
}

function zoomOut() {
  setZoom(zoom.value - 0.1)
}

function resetZoom() {
  setZoom(1)
}

function fitCanvas() {
  const width = scrollRef.value?.clientWidth || 0
  if (!width) return
  autoFit.value = true
  // 22px 标尺 + 左右留白
  zoom.value = clampZoom((width - 64) / (page.value.width + 22))
}

function onWheel(event) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  setZoom(zoom.value + (event.deltaY < 0 ? 0.1 : -0.1))
}

watch(() => page.value.width, () => {
  if (autoFit.value) fitCanvas()
})

const xMarks = computed(() => (
  Array.from({ length: Math.floor(page.value.width / 50) + 1 }, (_, index) => ({
    pos: index * 50,
    major: index % 2 === 0
  }))
))
const yMarks = computed(() => (
  Array.from({ length: Math.floor(pageHeight.value / 50) + 1 }, (_, index) => ({
    pos: index * 50,
    major: index % 2 === 0
  }))
))

const pageStyle = computed(() => ({
  width: `${page.value.width}px`,
  minHeight: `${pageHeight.value}px`,
  background: page.value.background || '#ffffff'
}))

function sectionOf(element) {
  return element?.sectionType ? sectionMap.value.get(element.sectionType) || null : null
}

function elementStyle(element) {
  // 拖拽中的元素用 fixed 跟随鼠标，整个窗口内都能看到；放下后切回 absolute
  if (element.id === props.dragElementId) {
    // 抵消画布 zoom，保证预览的视觉宽高 = 放置后的视觉宽高
    const scale = zoom.value || 1
    return {
      position: 'fixed',
      left: `${dragVisual.value.left}px`,
      top: `${dragVisual.value.top}px`,
      width: `${element.w * scale}px`,
      height: `${element.h * scale}px`,
      zoom: 1 / scale,
      zIndex: 9999,
      visibility: dragMoved.value ? 'visible' : 'hidden'
    }
  }
  return {
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.w}px`,
    height: `${element.h}px`,
    zIndex: selected.value?.id === element.id ? 20 : 10
  }
}

function snap(value) {
  return Math.round(value / 8) * 8
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * 对齐吸附：页面内边距 / 页面中心 / 其他元素的左右、中线、上下边缘
 * 返回吸附后的坐标与需要展示的对齐线
 */
function snapToGuides(x, y, w, h, excludeId, threshold = 6) {
  const pageInfo = page.value
  const xTargets = [pageInfo.padding, Math.round(pageInfo.width / 2), pageInfo.width - pageInfo.padding]
  const yTargets = [pageInfo.padding, Math.round(pageInfo.height / 2), pageInfo.height - pageInfo.padding]

  for (const item of props.layout.elements) {
    if (item.id === excludeId) continue
    xTargets.push(item.x, item.x + item.w / 2, item.x + item.w)
    yTargets.push(item.y, item.y + item.h / 2, item.y + item.h)
  }

  const xEdges = [x, x + w / 2, x + w]
  const yEdges = [y, y + h / 2, y + h]

  let bestX = { diff: threshold, target: null, edge: null }
  for (const edge of xEdges) {
    for (const target of xTargets) {
      const diff = Math.abs(edge - target)
      if (diff < bestX.diff) bestX = { diff, target, edge }
    }
  }

  let bestY = { diff: threshold, target: null, edge: null }
  for (const edge of yEdges) {
    for (const target of yTargets) {
      const diff = Math.abs(edge - target)
      if (diff < bestY.diff) bestY = { diff, target, edge }
    }
  }

  const snappedX = bestX.target != null ? x + (bestX.target - bestX.edge) : snap(x)
  const snappedY = bestY.target != null ? y + (bestY.target - bestY.edge) : snap(y)

  return {
    x: snappedX,
    y: snappedY,
    vertical: bestX.target != null ? [bestX.target] : [],
    horizontal: bestY.target != null ? [bestY.target] : []
  }
}

const pageRef = ref(null)
let paletteDragging = false

function clearDragPreview() {
  dragOverPage.value = false
  dragMoved.value = false
  guides.value = { vertical: [], horizontal: [] }
}

function onPalettePointerMove(event) {
  const id = props.dragElementId
  const pageEl = pageRef.value
  const element = id ? props.layout.elements.find(item => item.id === id) : null
  if (!element || !pageEl) return
  dragMoved.value = true

  const rect = pageEl.getBoundingClientRect()
  const scale = zoom.value || 1
  const w = element.w
  const h = element.h
  // Axure 式：组件左上角跟鼠标，不居中
  const rawX = (event.clientX - rect.left) / scale
  const rawY = (event.clientY - rect.top) / scale

  const inside = event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom

  if (!inside) {
    dragOverPage.value = false
    guides.value = { vertical: [], horizontal: [] }
    dragVisual.value = { left: event.clientX, top: event.clientY }
    return
  }

  const x = clamp(rawX, 0, page.value.width - w)
  const y = Math.max(0, rawY)
  // 只显示参考线，不自动吸附；落点就是鼠标位置
  const guide = snapToGuides(rawX, rawY, w, h, id, 1)
  dragOverPage.value = true
  guides.value = { vertical: guide.vertical, horizontal: guide.horizontal }
  dragVisual.value = {
    left: rect.left + x * scale,
    top: rect.top + y * scale
  }
  emit('update-drag-element', id, { x, y })
}

function onPalettePointerUp() {
  const commit = dragOverPage.value && Boolean(props.dragElementId)
  stopPaletteDrag()
  emit('drag-end', { commit })
}

function startPaletteDrag() {
  if (paletteDragging) return
  paletteDragging = true
  dragMoved.value = false
  document.body.classList.add('is-palette-dragging')
  window.addEventListener('pointermove', onPalettePointerMove)
  window.addEventListener('pointerup', onPalettePointerUp)
}

function stopPaletteDrag() {
  if (!paletteDragging) return
  paletteDragging = false
  document.body.classList.remove('is-palette-dragging')
  window.removeEventListener('pointermove', onPalettePointerMove)
  window.removeEventListener('pointerup', onPalettePointerUp)
  clearDragPreview()
}

watch(
  () => props.draggingWidget,
  widget => {
    if (widget && !props.preview && !props.disabled) startPaletteDrag()
    else stopPaletteDrag()
  }
)

function selectElement(element) {
  if (props.preview) return
  emit('select', element.id)
}

function onElementPointerDown(event, element) {
  if (props.preview || props.disabled || event.button !== 0) return
  if (element.id === props.dragElementId) return
  if (event.target.closest('.element-actions') || event.target.closest('.resize-handle')) return
  if (editingId.value === element.id) return
  event.preventDefault()
  event.stopPropagation()
  emit('select', element.id)

  dragState.value = {
    mode: 'move',
    element,
    startX: event.clientX,
    startY: event.clientY,
    origin: { x: element.x, y: element.y, w: element.w, h: element.h }
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onResizePointerDown(event, element, dir) {
  if (props.preview || props.disabled || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  emit('select', element.id)
  dragState.value = {
    mode: 'resize',
    dir,
    element,
    startX: event.clientX,
    startY: event.clientY,
    origin: { x: element.x, y: element.y, w: element.w, h: element.h }
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(event) {
  const state = dragState.value
  if (!state) return
  const scale = zoom.value || 1
  const dx = (event.clientX - state.startX) / scale
  const dy = (event.clientY - state.startY) / scale

  if (state.mode === 'move') {
    const snapped = snapToGuides(
      state.origin.x + dx,
      state.origin.y + dy,
      state.element.w,
      state.element.h,
      state.element.id
    )
    const x = clamp(snapped.x, 0, page.value.width - state.element.w)
    const y = Math.max(0, snapped.y)
    guides.value = { vertical: snapped.vertical, horizontal: snapped.horizontal }
    emit('update-element', state.element.id, { x, y })
    return
  }

  let { x, y, w, h } = state.origin
  if (state.dir.includes('e')) w = Math.max(24, snap(state.origin.w + dx))
  if (state.dir.includes('s')) h = Math.max(2, snap(state.origin.h + dy))
  if (state.dir.includes('w')) {
    const nextX = clamp(snap(state.origin.x + dx), 0, state.origin.x + state.origin.w - 24)
    w = state.origin.w + (state.origin.x - nextX)
    x = nextX
  }
  if (state.dir.includes('n')) {
    const nextY = clamp(snap(state.origin.y + dy), 0, state.origin.y + state.origin.h - 2)
    h = state.origin.h + (state.origin.y - nextY)
    y = nextY
  }
  w = Math.min(w, page.value.width - x)
  emit('update-element', state.element.id, { x, y, w, h })
}

function onPointerUp() {
  dragState.value = null
  guides.value = { vertical: [], horizontal: [] }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onDoubleClick(element) {
  if (props.preview || props.disabled || element.id === props.dragElementId || element.type !== 'text') return
  editingId.value = element.id
  nextTick(() => document.querySelector('.inline-text')?.focus())
}

function updateEditingText(element, event) {
  emit('update-element', element.id, { text: event.target.value })
}

function finishEditing() {
  editingId.value = null
}

onMounted(() => {
  scrollRef.value?.addEventListener('wheel', onWheel, { passive: false })
  nextTick(fitCanvas)
})
onBeforeUnmount(() => {
  stopPaletteDrag()
  scrollRef.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div ref="scrollRef" class="canvas-shell">
    <el-scrollbar class="canvas-scroll">
      <div class="canvas-stage">
        <div class="canvas-caption">
          <span>自由画布</span>
          <span>{{ page.width }} × {{ page.height }} px · 8px 网格 · 选中后可拖动 / 缩放 · Ctrl + 滚轮缩放</span>
        </div>

        <div class="canvas-frame" :style="{ zoom, '--page-width': `${page.width}px` }">
        <div class="ruler-corner" />
        <div class="ruler ruler-x" aria-hidden="true">
          <span
            v-for="mark in xMarks"
            :key="mark.pos"
            :class="{ major: mark.major }"
            :style="{ left: `${mark.pos}px` }"
          >{{ mark.major ? mark.pos : '' }}</span>
        </div>
        <div class="ruler ruler-y" aria-hidden="true">
          <span
            v-for="mark in yMarks"
            :key="mark.pos"
            :class="{ major: mark.major }"
            :style="{ top: `${mark.pos}px` }"
          >{{ mark.major ? mark.pos : '' }}</span>
        </div>

      <div
        ref="pageRef"
        class="canvas-page"
        :class="{ 'is-preview': preview, 'is-drop-active': dragOverPage }"
        :style="pageStyle"
        @click.self="emit('select', null)"
      >
        <div v-if="!preview" class="page-grid" />

        <div v-if="!layout.elements.length && !preview" class="canvas-empty">
          <el-icon :size="26"><Rank /></el-icon>
          <strong>把左侧组件拖到画布</strong>
          <span>组件会跟随鼠标实时预览，放下后可以移动、缩放和改样式</span>
        </div>

        <div
          v-for="element in layout.elements"
          :key="element.id"
          class="canvas-element"
          :class="{
            'is-selected': selectedId === element.id,
            'is-moving': dragState?.element?.id === element.id,
            'is-dragging': element.id === dragElementId
          }"
          :style="elementStyle(element)"
          @pointerdown="onElementPointerDown($event, element)"
          @click.stop="selectElement(element)"
          @dblclick.stop="onDoubleClick(element)"
        >
          <WidgetView
            v-if="!(editingId === element.id && element.type === 'text')"
            :element="element"
            :section="sectionOf(element)"
          />

          <textarea
            v-else
            class="inline-text"
            :value="element.text"
            :style="{
              fontSize: `${element.style?.fontSize || 13}px`,
              fontWeight: element.style?.fontWeight || 400,
              color: element.style?.color || '#374151',
              textAlign: element.style?.textAlign || 'left',
              lineHeight: element.style?.lineHeight || 1.75
            }"
            @pointerdown.stop
            @input="updateEditingText(element, $event)"
            @blur="finishEditing"
            @keydown.esc.prevent="finishEditing"
          />

          <template v-if="!preview && !disabled && selectedId === element.id && element.id !== dragElementId">
            <span class="resize-handle dir-nw" @pointerdown.stop="onResizePointerDown($event, element, 'nw')" />
            <span class="resize-handle dir-n" @pointerdown.stop="onResizePointerDown($event, element, 'n')" />
            <span class="resize-handle dir-ne" @pointerdown.stop="onResizePointerDown($event, element, 'ne')" />
            <span class="resize-handle dir-e" @pointerdown.stop="onResizePointerDown($event, element, 'e')" />
            <span class="resize-handle dir-se" @pointerdown.stop="onResizePointerDown($event, element, 'se')" />
            <span class="resize-handle dir-s" @pointerdown.stop="onResizePointerDown($event, element, 's')" />
            <span class="resize-handle dir-sw" @pointerdown.stop="onResizePointerDown($event, element, 'sw')" />
            <span class="resize-handle dir-w" @pointerdown.stop="onResizePointerDown($event, element, 'w')" />
          </template>

          <div v-if="!preview && !disabled && element.id !== dragElementId" class="element-actions" @pointerdown.stop>
            <span class="element-tag">{{ element.type }}</span>
            <button type="button" title="复制" @click.stop="emit('duplicate-element', element)">
              <el-icon :size="11"><CopyDocument /></el-icon>
            </button>
            <button type="button" title="删除" @click.stop="emit('delete-element', element)">
              <el-icon :size="11"><Delete /></el-icon>
            </button>
          </div>
        </div>

        <div
          v-for="x in guides.vertical"
          :key="`v-${x}`"
          class="align-guide vertical"
          :style="{ left: `${x}px` }"
        />
        <div
          v-for="y in guides.horizontal"
          :key="`h-${y}`"
          class="align-guide horizontal"
          :style="{ top: `${y}px` }"
        />
      </div>
      </div>
    </div>
    </el-scrollbar>

    <div class="canvas-zoom" @pointerdown.stop @click.stop>
      <button type="button" title="缩小" @click="zoomOut">
        <el-icon :size="13"><ZoomOut /></el-icon>
      </button>
      <button type="button" class="zoom-value" title="重置为 100%" @click="resetZoom">
        {{ zoomPercent }}
      </button>
      <button type="button" title="放大" @click="zoomIn">
        <el-icon :size="13"><ZoomIn /></el-icon>
      </button>
      <span class="zoom-divider" />
      <button type="button" class="zoom-fit" title="适应画布宽度" @click="fitCanvas">
        <el-icon :size="12"><FullScreen /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.canvas-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  background-color: var(--wr-bg);
  background-image: radial-gradient(circle at 1px 1px, var(--el-border-color) 0.8px, transparent 0);
  background-size: 20px 20px;
}

.canvas-scroll {
  height: 100%;
  min-height: 0;
}

.canvas-zoom {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 120;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 7px;
  background: color-mix(in srgb, var(--el-bg-color) 92%, transparent);
  box-shadow: var(--wr-shadow-md);
  backdrop-filter: blur(8px);
}

.canvas-zoom button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 10.5px;
  cursor: pointer;
}

.canvas-zoom button:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.canvas-zoom .zoom-value {
  width: 46px;
  font-size: 10px;
}

.zoom-divider {
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: var(--el-border-color-lighter);
}

.canvas-zoom .zoom-fit {
  width: 26px;
}

.canvas-stage {
  width: max-content;
  min-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 28px 60px;
}

.canvas-caption {
  display: flex;
  gap: 14px;
  margin-bottom: 8px;
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.canvas-caption span:first-child {
  color: var(--el-text-color-secondary);
  font-family: var(--el-font-family);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.canvas-page {
  position: relative;
  flex: none;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.14);
  transition: box-shadow 0.2s ease;
}

.canvas-page.is-preview {
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.1);
}

.page-grid {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px);
  background-size: 8px 8px;
}

.canvas-empty {
  position: absolute;
  inset: 24px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  color: #9ca3af;
  text-align: center;
}

.canvas-empty strong {
  font-size: 14px;
  font-weight: 600;
  color: #4b5563;
}

.canvas-empty span {
  font-size: 11.5px;
}

.canvas-element {
  position: absolute;
  box-sizing: border-box;
  cursor: move;
  outline: 1px dotted transparent;
  transition: outline-color 0.1s ease;
}

.canvas-element:hover {
  outline-color: rgba(53, 116, 240, 0.5);
}

.canvas-element.is-selected {
  outline: 1.5px solid #3574f0;
  box-shadow: 0 0 0 3px rgba(53, 116, 240, 0.12);
}

.canvas-element.is-moving {
  opacity: 0.92;
}

.canvas-element.is-dragging {
  pointer-events: none;
}

.inline-text {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid #3574f0;
  outline: none;
  resize: none;
  background: #fff;
  font-family: inherit;
  overflow: auto;
}

.resize-handle {
  position: absolute;
  z-index: 30;
  width: 7px;
  height: 7px;
  border: 1px solid #3574f0;
  background: #fff;
  border-radius: 1px;
}

.dir-nw { top: -4px; left: -4px; cursor: nwse-resize; }
.dir-n { top: -4px; left: calc(50% - 3.5px); cursor: ns-resize; }
.dir-ne { top: -4px; right: -4px; cursor: nesw-resize; }
.dir-e { top: calc(50% - 3.5px); right: -4px; cursor: ew-resize; }
.dir-se { bottom: -4px; right: -4px; cursor: nwse-resize; }
.dir-s { bottom: -4px; left: calc(50% - 3.5px); cursor: ns-resize; }
.dir-sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
.dir-w { top: calc(50% - 3.5px); left: -4px; cursor: ew-resize; }

.element-actions {
  position: absolute;
  top: -24px;
  right: 0;
  z-index: 40;
  display: none;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-bg-color);
  box-shadow: var(--wr-shadow-sm);
}

.canvas-element:hover .element-actions,
.canvas-element.is-selected .element-actions {
  display: flex;
}

.element-tag {
  padding: 0 4px;
  font-family: var(--wr-mono);
  font-size: 8.5px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.element-actions button {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.element-actions button:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}


.canvas-page.is-drop-active {
  box-shadow: 0 10px 40px rgba(53, 116, 240, 0.18);
}


/* ---------- 标尺与对齐线 ---------- */
.canvas-frame {
  display: grid;
  grid-template-columns: 22px var(--page-width);
  grid-template-rows: 22px auto;
  flex: none;
}

.ruler-corner {
  grid-column: 1;
  grid-row: 1;
  border-right: 1px solid var(--el-border-color);
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
}

.ruler {
  position: relative;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-placeholder);
  font-family: var(--wr-mono);
  font-size: 7.5px;
  user-select: none;
}

.ruler-x {
  grid-column: 2;
  grid-row: 1;
  border-bottom: 1px solid var(--el-border-color);
  background-image: repeating-linear-gradient(
    to right,
    var(--el-border-color) 0 1px,
    transparent 1px 10px
  );
  background-size: 100% 3px;
  background-position: left bottom;
  background-repeat: no-repeat;
}

.ruler-y {
  grid-column: 1;
  grid-row: 2;
  border-right: 1px solid var(--el-border-color);
  background-image: repeating-linear-gradient(
    to bottom,
    var(--el-border-color) 0 1px,
    transparent 1px 10px
  );
  background-size: 3px 100%;
  background-position: right top;
  background-repeat: no-repeat;
}

.ruler-x span {
  position: absolute;
  top: 3px;
  transform: translateX(-50%);
}

.ruler-y span {
  position: absolute;
  left: 2px;
  transform: translateY(-50%);
}

.ruler span.major {
  color: var(--el-text-color-secondary);
}

.canvas-page {
  grid-column: 2;
  grid-row: 2;
}

.align-guide {
  position: absolute;
  z-index: 80;
  pointer-events: none;
  background: #f59e0b;
}

.align-guide.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.align-guide.horizontal {
  left: 0;
  right: 0;
  height: 1px;
}

</style>
