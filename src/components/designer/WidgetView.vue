<script setup>
import { computed } from 'vue'
import { resolveDefaultValue } from '@/config/defaultReportConfig'
import { hasComponent } from '@/plugins/registry'
import ElementWidget from './ElementWidget.vue'

defineOptions({ name: 'WidgetView' })

const props = defineProps({
  element: {
    type: Object,
    required: true
  },
  section: {
    type: Object,
    default: null
  },
  title: {
    type: String,
    default: '工作周报'
  },
  dateRange: {
    type: String,
    default: '2026-11-02 — 2026-11-08'
  }
})


function evaluateExpression(element, fallback) {
  let code = String(element?.expression || '').trim()
  if (!code) return fallback
  const wrapped = /^\{\{([\s\S]*)\}\}$/.exec(code)
  if (wrapped) code = wrapped[1].trim()
  const dateText = typeof props.dateRange === 'string' ? props.dateRange : ''
  const report = {
    title: props.title,
    dateRange: dateText,
    sections: []
  }
  try {
    let result
    try {
      result = new Function('report', 'moment', `"use strict"; return (${code});`)(report, window.moment)
    } catch {
      result = new Function('report', 'moment', `"use strict";
${code}`)(report, window.moment)
    }
    return result === undefined || result === null ? '' : String(result)
  } catch (error) {
    console.warn('[designer] 内容表达式执行失败:', code, error)
    return fallback
  }
}

const displayTitle = computed(() => evaluateExpression(props.element, props.title))
const displayDate = computed(() => evaluateExpression(props.element, props.dateRange))

const style = computed(() => props.element.style || {})

const boxStyle = computed(() => ({
  background: style.value.background === 'transparent' ? 'transparent' : style.value.background,
  padding: `${style.value.padding || 0}px`,
  border: style.value.borderWidth
    ? `${style.value.borderWidth}px solid ${style.value.borderColor || 'var(--el-border-color-lighter)'}`
    : 'none',
  borderRadius: `${style.value.borderRadius || 0}px`,
  opacity: style.value.opacity ?? 1
}))

const textStyle = computed(() => ({
  fontSize: `${style.value.fontSize || 13}px`,
  fontWeight: style.value.fontWeight || 400,
  color: style.value.color || 'var(--el-text-color-primary)',
  textAlign: style.value.textAlign || 'left',
  lineHeight: style.value.lineHeight || 1.5,
  letterSpacing: `${style.value.letterSpacing || 0}px`
}))

const sectionBoxStyle = computed(() => ({
  ...boxStyle.value,
  '--wv-title-size': `${style.value.titleSize || 14}px`,
  '--wv-title-color': style.value.titleColor || 'var(--el-text-color-primary)',
  '--wv-header-bg': style.value.headerBg || 'var(--el-fill-color-lighter)',
  '--wv-header-color': style.value.headerColor || 'var(--el-text-color-regular)',
  '--wv-body-color': style.value.bodyColor || 'var(--el-text-color-regular)',
  '--wv-font-size': `${style.value.fontSize || 12}px`
}))

const columns = computed(() => props.section?.columns || [])
const customReady = computed(() => (
  props.element.type === 'component' && hasComponent(props.element.component)
))

const sampleRows = computed(() => {
  const first = { _key: 0 }
  for (const column of columns.value) {
    const value = resolveDefaultValue(column)
    first[column.prop] = value === '' ? '示例' : String(value)
  }
  const second = { _key: 1 }
  for (const column of columns.value) second[column.prop] = '—'
  return [first, second]
})
</script>

<template>
  <div class="widget-view" :class="`is-${element.type}`">
    <template v-if="element.type === 'title'">
      <div class="wv-text" :style="{ ...textStyle, ...boxStyle }">{{ displayTitle }}</div>
    </template>

    <template v-else-if="element.type === 'date'">
      <div class="wv-text" :style="{ ...textStyle, ...boxStyle }">{{ displayDate }}</div>
    </template>

    <template v-else-if="element.type === 'text'">
      <div class="wv-text wv-pre" :style="{ ...textStyle, ...boxStyle }">{{ element.text }}</div>
    </template>

    <template v-else-if="element.type === 'divider'">
      <div
        class="wv-divider"
        :style="{
          borderTop: `${style.thickness || 1}px solid ${style.color || 'var(--el-border-color-lighter)'}`,
          opacity: style.opacity ?? 1
        }"
      />
    </template>

    <template v-else-if="element.type === 'el'">
      <ElementWidget :element="element" />
    </template>

    <template v-else-if="element.type === 'component'">
      <div class="wv-custom" :style="boxStyle">
        <component
          :is="element.component"
          v-if="customReady"
          v-bind="element.props || {}"
        />
        <span v-else class="wv-empty">外部组件不可用：{{ element.component || '未选择' }}</span>
      </div>
    </template>

    <template v-else-if="element.type === 'section' && section">
      <div class="wv-section" :style="sectionBoxStyle">
        <div class="wv-section-title">{{ section.title }}</div>
        <el-table
          v-if="columns.length"
          :data="sampleRows"
          size="small"
          class="wv-table"
          border
        >
          <el-table-column
            v-for="column in columns"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
            :width="column.width || undefined"
          />
        </el-table>
        <div v-else class="wv-empty">暂无列，请在右侧添加</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.widget-view {
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  pointer-events: none;
}

.wv-text {
  width: 100%;
  height: 100%;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.wv-pre {
  white-space: pre-wrap;
}

.wv-divider {
  width: 100%;
}

.wv-section {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wv-section-title {
  margin-bottom: 6px;
  font-size: var(--wv-title-size);
  font-weight: 650;
  color: var(--wv-title-color);
}

.wv-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--wv-font-size);
}

.wv-table th,
.wv-table td {
  padding: 5px 7px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wv-table th {
  background: var(--wv-header-bg);
  color: var(--wv-header-color);
  font-weight: 600;
}

.wv-table td {
  color: var(--wv-body-color);
}

.wv-custom {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wv-empty {
  padding: 18px;
  border: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  text-align: center;
}
</style>
