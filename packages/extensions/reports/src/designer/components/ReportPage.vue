<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch , inject } from 'vue'
import ReportSection from './ReportSection.vue'
import DateRangeField from './DateRangeField.vue'
import ElementWidget from './ElementWidget.vue'

defineOptions({ name: 'ReportPage' })

const ctx = inject('cordis')

function formatDateRange(dateRange) {
  return Array.isArray(dateRange) && dateRange.length === 2 ? dateRange.join(' ~ ') : dateRange
}

const props = defineProps({
  report: {
    type: Object,
    required: true,
  },
  layout: {
    type: Object,
    required: true,
  },
  interactive: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['change'])

const pageRef = ref(null)
const sectionHeights = ref({})
const runtimeValues = reactive({})
const runtimeVisibility = reactive({})
const runtimeVariables = reactive({})
let resizeObserver = null

const page = computed(() => props.layout.page)

/**
 * 区块高度跟随数据量增长；后续元素按增长量下移，避免与下方区域重叠。
 * 自由画布仍以元素坐标为准，只有“被上方区块撑开”的部分才会让位。
 */
const placedElements = computed(() => {
  const elements = props.layout.elements || []
  const info = elements.map((element) => {
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
  nextTick(runLoadInteractions)
})

watch(
  () => props.interactive,
  (value) => {
    if (value) nextTick(runLoadInteractions)
  },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => (props.layout.elements || []).map(element => `${element.id}:${element.type}:${element.sectionType || ''}`).join('|'),
  () => nextTick(observeSections),
)

const pageStyle = computed(() => ({
  width: `${page.value.width}px`,
  minHeight: `${pageHeight.value}px`,
  background: !page.value.background || page.value.background === '#ffffff'
    ? 'var(--el-bg-color)'
    : page.value.background,
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
    width: `${element.w}px`,
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
    opacity: style.opacity ?? 1,
  }
}

function textStyle(style = {}) {
  return {
    fontSize: `${style.fontSize || 13}px`,
    fontWeight: style.fontWeight || 400,
    color: style.color || 'var(--el-text-color-primary)',
    textAlign: style.textAlign || 'left',
    lineHeight: style.lineHeight || 1.5,
    letterSpacing: `${style.letterSpacing || 0}px`,
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
    '--report-section-font-size': `${style.fontSize || 12}px`,
  }
}

function sectionOf(element) {
  return sectionMap.value.get(element.sectionType)
}

function evaluateExpression(element) {
  let code = String(element.expression || '').trim()
  if (!code) return null
  // 兼容 {{ report.title }} 这种旧写法，表达式本身仍按 JS 执行
  const wrapped = /^\{\{([\s\S]*)\}\}$/.exec(code)
  if (wrapped) code = wrapped[1].trim()

  const moment = typeof window !== 'undefined' ? window.moment : undefined
  try {
    let result
    try {
      result = new Function('report', 'moment', `"use strict"; return (${code});`)(props.report, moment)
    } catch (expressionError) {
      // 允许写多行脚本，最后一行用 return
      result = new Function('report', 'moment', `"use strict";
${code}`)(props.report, moment)
    }
    return result === undefined || result === null ? '' : String(result)
  } catch (error) {
    console.warn('[report] 内容表达式执行失败:', code, error)
    return ''
  }
}

function titleText(element) {
  const value = evaluateExpression(element)
  return value === null ? props.report.title : value
}

function dateText(element) {
  const value = evaluateExpression(element)
  return value === null ? formatDateRange(props.report.dateRange) : value
}

function displayTitle(element) {
  return runtimeValues[element.id] !== undefined ? runtimeValues[element.id] : titleText(element)
}

function displayDate(element) {
  return runtimeValues[element.id] !== undefined ? runtimeValues[element.id] : dateText(element)
}

function displayText(element) {
  return runtimeValues[element.id] !== undefined ? runtimeValues[element.id] : (element.text || '')
}

function isVisible(element) {
  return runtimeVisibility[element.id] !== false
}

function interpolate(value) {
  return String(value ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
    const result = runtimeVariables[key]
    return result === undefined || result === null ? '' : String(result)
  })
}

function elementValue(element) {
  if (!element) return ''
  if (runtimeValues[element.id] !== undefined) return runtimeValues[element.id]
  if (element.type === 'title') return titleText(element)
  if (element.type === 'date') return dateText(element)
  return element.text || ''
}

function matchesCondition(condition) {
  if (!condition) return true
  const left = condition.source === 'target'
    ? elementValue(props.layout.elements.find(item => item.id === condition.targetId))
    : runtimeVariables[condition.variable]
  const right = interpolate(condition.value)
  switch (condition.operator) {
    case 'notEquals': return String(left ?? '') !== right
    case 'contains': return String(left ?? '').includes(right)
    case 'gt': return Number(left) > Number(right)
    case 'lt': return Number(left) < Number(right)
    case 'truthy': return Boolean(left)
    case 'falsy': return !left
    default: return String(left ?? '') === right
  }
}

function runActions(actions = []) {
  for (const action of actions) {
    if (action.type === 'show') runtimeVisibility[action.targetId] = true
    else if (action.type === 'hide') runtimeVisibility[action.targetId] = false
    else if (action.type === 'toggle') runtimeVisibility[action.targetId] = runtimeVisibility[action.targetId] === false
    else if (action.type === 'setText' || action.type === 'setValue') {
      if (action.targetId) runtimeValues[action.targetId] = interpolate(action.value)
    } else if (action.type === 'setVariable') {
      if (action.variable) runtimeVariables[action.variable] = interpolate(action.value)
    } else if (action.type === 'scrollTo') {
      if (action.targetId) {
        pageRef.value?.querySelector(`[data-element-id="${action.targetId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else if (action.type === 'runScript') {
      try {
        // 本地原型预览：脚本由用户自己维护
        const fn = new Function('variables', 'report', `"use strict";\n${action.value || ''}`)
        fn(runtimeVariables, props.report)
      } catch (error) {
        console.warn('[report] 交互脚本执行失败:', error)
      }
    }
  }
}

function runInteractions(element, trigger) {
  if (!props.interactive || !element) return
  for (const interaction of element.interactions || []) {
    if (interaction.trigger !== trigger) continue
    const passed = matchesCondition(interaction.condition)
    runActions(passed ? interaction.actions : interaction.elseActions)
  }
}

function runLoadInteractions() {
  if (!props.interactive) return
  for (const element of props.layout.elements || []) runInteractions(element, 'load')
}

function onElementClick(element) {
  runInteractions(element, 'click')
}

function onElementDoubleClick(element) {
  runInteractions(element, 'dblclick')
}

function onElementHover(element) {
  runInteractions(element, 'hover')
}

function onTitleInput(element, event) {
  props.report.title = event.target.value
  emit('change')
  runInteractions(element, 'input')
}

function onTextInput(element, event) {
  element.text = event.target.value
  emit('change')
  runInteractions(element, 'input')
}

function onDateChange(element) {
  emit('change')
  runInteractions(element, 'input')
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
      :data-element-id="element.id"
      :style="[frameStyle(element), { visibility: isVisible(element) ? 'visible' : 'hidden' }]"
      @click="onElementClick(element)"
      @dblclick="onElementDoubleClick(element)"
      @mouseenter="onElementHover(element)"
    >
      <template v-if="element.type === 'title'">
        <div
          v-if="element.expression || runtimeValues[element.id] !== undefined"
          class="element-title-static"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
        >{{ displayTitle(element) }}</div>
        <input
          v-else
          class="element-title"
          :value="displayTitle(element)"
          :readonly="interactive"
          placeholder="请输入周报标题"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
          @input="onTitleInput(element, $event)"
        >
      </template>

      <template v-else-if="element.type === 'date'">
        <div
          class="element-date-field"
          :style="{ ...textStyle(element.style), ...boxStyle(element.style), width: '100%', height: '100%' }"
        >
          <span v-if="element.expression || runtimeValues[element.id] !== undefined" class="element-date-static">{{ displayDate(element) }}</span>
          <DateRangeField v-else v-model="report.dateRange" @change="onDateChange(element)" />
        </div>
      </template>

      <template v-else-if="element.type === 'text'">
        <textarea
          class="element-text"
          :value="displayText(element)"
          :readonly="interactive"
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

      <template v-else-if="element.type === 'component'">
        <div
          class="element-custom"
          :style="{ ...boxStyle(element.style), width: '100%', height: '100%' }"
        >
          <component
            :is="element.component"
            v-if="ctx.get('components').has(element.component)"
            v-bind="element.props || {}"
          />
          <span v-else class="element-custom-empty">外部组件不可用：{{ element.component || '未选择' }}</span>
        </div>
      </template>
    </div>
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

.element-title-static,
.element-date-static {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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

.element-custom {
  overflow: hidden;
}

.element-custom-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
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
