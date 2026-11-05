<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ReportSection from '@/components/report/ReportSection.vue'
import ColumnSettingsDialog from '@/components/report/ColumnSettingsDialog.vue'
import DateRangeField from '@/components/common/DateRangeField.vue'
import ElementWidget from '@/components/designer/ElementWidget.vue'

defineOptions({ name: 'ReportPage' })

const props = defineProps({
  report: {
    type: Object,
    required: true
  },
  layout: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['change'])

const showColumnSettings = ref(false)
const editingSection = ref(null)
const pageRef = ref(null)
const sectionHeights = ref({})
let resizeObserver = null

const page = computed(() => props.layout.page)

/**
 * 区块高度跟随数据量增长；后续元素按增长量下移，避免与下方区域重叠。
 * 自由画布仍以元素坐标为准，只有“被上方区块撑开”的部分才会让位。
 */
const placedElements = computed(() => {
  const elements = props.layout.elements || []
  const info = elements.map(element => {
    let height = element.h || 0
    if (element.type === 'section') {
      const section = sectionMap.value.get(element.sectionType)
      const estimated = 46 + (section?.items?.length || 0) * 29 + (element.style?.padding || 0) * 2
      height = Math.max(height, sectionHeights.value[element.id] || estimated)
    }
    return { element, height }
  })

  return info.map(({ element, height }) => {
    let shift = 0
    for (const other of info) {
      if (other.element.id === element.id || other.element.type !== 'section') continue
      const grow = other.height - (other.element.h || 0)
      if (grow > 0 && other.element.y + (other.element.h || 0) <= element.y + 0.5) {
        shift += grow
      }
    }
    return { ...element, _top: element.y + shift, _height: height }
  })
})

const placedMap = computed(() => new Map(placedElements.value.map(element => [element.id, element])))

const pageHeight = computed(() => {
  let bottom = 0
  for (const element of placedElements.value) {
    bottom = Math.max(bottom, element._top + element._height)
  }
  return Math.max(page.value.height, bottom + page.value.padding)
})

function observeSections() {
  if (!resizeObserver) return
  resizeObserver.disconnect()
  const nodes = pageRef.value?.querySelectorAll('.section-widget[data-section-id]') || []
  for (const node of nodes) resizeObserver.observe(node)
}

function onSectionResize(entries) {
  let changed = false
  const next = { ...sectionHeights.value }
  for (const entry of entries) {
    const id = entry.target.dataset.sectionId
    if (!id) continue
    const size = entry.borderBoxSize?.[0]?.blockSize || entry.target.offsetHeight || 0
    if (next[id] !== size) {
      next[id] = size
      changed = true
    }
  }
  if (changed) sectionHeights.value = next
}

onMounted(() => {
  resizeObserver = new ResizeObserver(onSectionResize)
  observeSections()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => (props.layout.elements || []).map(element => `${element.id}:${element.type}:${element.sectionType || ''}`).join('|'),
  () => nextTick(observeSections)
)

const pageStyle = computed(() => ({
  width: `${page.value.width}px`,
  minHeight: `${pageHeight.value}px`,
  background: !page.value.background || page.value.background === '#ffffff'
    ? 'var(--el-bg-color)'
    : page.value.background
}))

const sectionMap = computed(() => {
  const map = new Map()
  for (const section of props.report.sections || []) map.set(section.type, section)
  return map
})

function frameStyle(element) {
  const placed = placedMap.value.get(element.id) || element
  const base = {
    left: `${element.x}px`,
    top: `${placed._top ?? element.y}px`,
    width: `${element.w}px`
  }
  // 数据表格高度随记录数增长，不做固定裁切
  if (element.type === 'section') return { ...base, height: 'auto', minHeight: `${element.h}px` }
  return { ...base, height: `${element.h}px` }
}

function boxStyle(style = {}) {
  return {
    background: style.background === 'transparent' ? 'transparent' : style.background,
    padding: `${style.padding || 0}px`,
    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || 'var(--el-border-color-lighter)'}` : 'none',
    borderRadius: `${style.borderRadius || 0}px`,
    opacity: style.opacity ?? 1
  }
}

function textStyle(style = {}) {
  return {
    fontSize: `${style.fontSize || 13}px`,
    fontWeight: style.fontWeight || 400,
    color: style.color || 'var(--el-text-color-primary)',
    textAlign: style.textAlign || 'left',
    lineHeight: style.lineHeight || 1.5,
    letterSpacing: `${style.letterSpacing || 0}px`
  }
}

function sectionStyle(element) {
  const style = element.style || {}
  return {
    ...boxStyle(style),
    '--report-section-title-size': `${style.titleSize || 14}px`,
    '--report-section-title-color': style.titleColor || 'var(--el-text-color-primary)',
    '--report-section-header-bg': style.headerBg || 'var(--el-fill-color-light)',
    '--report-section-header-color': style.headerColor || 'var(--el-text-color-secondary)',
    '--report-section-body-color': style.bodyColor || 'var(--el-text-color-primary)',
    '--report-section-font-size': `${style.fontSize || 12}px`
  }
}

function sectionOf(element) {
  return sectionMap.value.get(element.sectionType)
}

function openColumnSettings(section) {
  editingSection.value = section
  showColumnSettings.value = true
}

function saveColumnSettings(nextSection) {
  const list = props.report.sections || []
  const index = list.findIndex(section => section.type === nextSection.type)
  if (index !== -1) list[index] = nextSection
  else list.push(nextSection)
  emit('change')
}

function onTitleInput(event) {
  props.report.title = event.target.value
  emit('change')
}

function onTextInput(element, event) {
  element.text = event.target.value
  emit('change')
}

function onDateChange() {
  emit('change')
}

function updateElModel(element, value) {
  element.props = { ...(element.props || {}), modelValue: value }
  emit('change')
}
</script>

<template>
  <div ref="pageRef" class="report-page" :style="pageStyle">
    <div
      v-for="element in layout.elements"
      :key="element.id"
      class="page-element"
      :class="`is-${element.type}`"
      :style="frameStyle(element)"
    >
      <template v-if="element.type === 'title'">
        <input
          class="element-title"
          :value="report.title"
          placeholder="请输入周报标题"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
          @input="onTitleInput"
        >
      </template>

      <template v-else-if="element.type === 'date'">
        <div
          class="element-date-field"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
        >
          <DateRangeField v-model="report.dateRange" @change="onDateChange" />
        </div>
      </template>

      <template v-else-if="element.type === 'text'">
        <textarea
          class="element-text"
          :value="element.text"
          placeholder="输入文本…"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
          @input="onTextInput(element, $event)"
        />
      </template>

      <template v-else-if="element.type === 'divider'">
        <div
          class="element-divider"
          :style="{
            borderTop: `${element.style?.thickness || 1}px solid ${element.style?.color || 'var(--el-border-color-lighter)'}`,
            opacity: element.style?.opacity ?? 1
          }"
        />
      </template>

      <template v-else-if="element.type === 'section' && sectionOf(element)">
        <div class="section-widget" :data-section-id="element.id" :style="sectionStyle(element)">
          <ReportSection
            :section="sectionOf(element)"
            @change="emit('change')"
            @configure="openColumnSettings"
          />
        </div>
      </template>

      <template v-else-if="element.type === 'el'">
        <div
          class="element-el"
          :style="{ ...boxStyle(element.style), width: '100%', height: '100%' }"
        >
          <ElementWidget
            :element="element"
            @update:model-value="value => updateElModel(element, value)"
          />
        </div>
      </template>
    </div>

    <ColumnSettingsDialog
      v-model="showColumnSettings"
      :section="editingSection"
      @save="saveColumnSettings"
    />
  </div>
</template>

<style scoped>
.report-page {
  position: relative;
  margin: 0 auto;
  overflow: visible;
  color: var(--el-text-color-primary);
  font-family: var(--el-font-family);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--wr-radius-md);
  box-shadow: var(--wr-shadow-sm);
}

.page-element {
  position: absolute;
  box-sizing: border-box;
}

.page-element.is-section {
  overflow: visible;
}

.element-title,
.element-text {
  display: block;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-family: inherit;
}

.element-title {
  font-family: inherit;
}

.element-title::placeholder,
.element-text::placeholder {
  color: var(--el-text-color-placeholder);
}

.element-text {
  overflow: auto;
}

.element-divider {
  width: 100%;
}

.element-date-field {
  display: flex;
  align-items: center;
}

.element-date-field :deep(.date-trigger) {
  color: inherit;
  font-family: var(--wr-mono);
  font-size: inherit;
}

.element-date-field :deep(.date-icon) {
  color: var(--el-color-primary);
}

.section-widget {
  width: 100%;
  height: auto;
  min-height: 100%;
  overflow: visible;
  box-sizing: border-box;
}
</style>
