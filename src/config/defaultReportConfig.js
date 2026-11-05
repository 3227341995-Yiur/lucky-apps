/**
 * 周报默认结构（低代码设计器的数据模型）
 *
 * section: { type, title, icon, hasExpandColumn, columns[] }
 * column:  { prop, label, width, fixed, component, defaultValue, defaultValueType, attrs }
 *
 * defaultValueType:
 *   literal - 直接使用 defaultValue（默认）
 *   code    - 把 defaultValue 当作 JS 表达式执行（可用 moment / lodash 全局）
 *   today   - 新建行时填入当天日期 YYYY-MM-DD
 *   now     - 新建行时填入时间戳
 *
 * 旧数据里的 moment().format('YYYY-MM-DD') 仍会在 resolveDefaultValue 中
 * 兼容为 today。
 */
import { generateId } from '../utils/idGenerator.js'
import { formatDate } from '../utils/date.js'

export const DEFAULT_REPORT_CONFIG = [
  {
    type: 'completed',
    title: '本周完成',
    icon: 'fas fa-check-circle',
    hasExpandColumn: false,
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      },
      {
        prop: 'status',
        label: '状态',
        component: 'status-selector',
        defaultValue: '开发中',
        defaultValueType: 'literal',
        attrs: {
          options: ['开发中', '待测试', '已完成']
        }
      }
    ]
  },
  {
    type: 'support',
    title: '开发支持',
    icon: 'fas fa-headset',
    hasExpandColumn: true,
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      },
      {
        prop: 'date',
        label: '日期',
        component: 'date-selector',
        defaultValueType: 'today'
      }
    ]
  },
  {
    type: 'plan',
    title: '下周计划',
    icon: 'fas fa-calendar-week',
    hasExpandColumn: false,
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      },
      {
        prop: 'status',
        label: '状态',
        component: 'status-selector',
        defaultValue: '待开始',
        defaultValueType: 'literal',
        attrs: {
          options: ['待开始', '进行中', '已完成']
        }
      }
    ]
  }
]

export const SECTION_PRESETS = [
  {
    title: '本周完成',
    icon: 'fas fa-check-circle',
    type: 'completed',
    hasExpandColumn: false,
    columns: DEFAULT_REPORT_CONFIG[0].columns
  },
  {
    title: '开发支持',
    icon: 'fas fa-headset',
    type: 'support',
    hasExpandColumn: true,
    columns: DEFAULT_REPORT_CONFIG[1].columns
  },
  {
    title: '下周计划',
    icon: 'fas fa-calendar-week',
    type: 'plan',
    hasExpandColumn: false,
    columns: DEFAULT_REPORT_CONFIG[2].columns
  },
  {
    title: '风险与问题',
    icon: 'fas fa-exclamation-triangle',
    type: 'risk',
    hasExpandColumn: true,
    columns: [
      { prop: 'title', label: '问题', fixed: true },
      {
        prop: 'level',
        label: '等级',
        component: 'status-selector',
        defaultValue: '中',
        attrs: { options: ['低', '中', '高'] }
      }
    ]
  },
  {
    title: '备注',
    icon: 'fas fa-sticky-note',
    type: 'note',
    hasExpandColumn: true,
    columns: [{ prop: 'title', label: '内容', fixed: true }]
  }
]

export const COLUMN_WIDGETS = [
  {
    id: 'text',
    label: '文本',
    icon: 'fas fa-font',
    description: '单行文本输入',
    column: { label: '文本列' }
  },
  {
    id: 'status',
    label: '状态',
    icon: 'fas fa-toggle-on',
    description: '下拉状态选择',
    column: {
      label: '状态',
      component: 'status-selector',
      defaultValue: '开发中',
      attrs: { options: ['开发中', '待测试', '已完成'] }
    }
  },
  {
    id: 'date',
    label: '日期',
    icon: 'fas fa-calendar-day',
    description: '日期选择，默认今天',
    column: {
      label: '日期',
      component: 'date-selector',
      defaultValueType: 'today'
    }
  },
  {
    id: 'number',
    label: '数字',
    icon: 'fas fa-hashtag',
    description: '数字输入',
    column: {
      label: '数值',
      component: 'number-input',
      defaultValue: 0
    }
  },
]

export const ICON_OPTIONS = [
  'fas fa-check-circle',
  'fas fa-headset',
  'fas fa-calendar-week',
  'fas fa-exclamation-triangle',
  'fas fa-sticky-note',
  'fas fa-list',
  'fas fa-tasks',
  'fas fa-lightbulb',
  'fas fa-flag',
  'fas fa-rocket',
  'fas fa-bug',
  'fas fa-users',
  'fas fa-chart-line',
  'fas fa-book'
]

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : value == null ? fallback : String(value)
}

function cleanNumber(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return undefined
  return Math.min(max, Math.max(min, Math.round(number)))
}

function normalizeAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return {}
  return { ...attrs }
}

export function normalizeColumn(column = {}, index = 0, usedProps = new Set()) {
  let prop = cleanString(column.prop) || `column${index + 1}`
  let suffix = 2
  while (usedProps.has(prop)) prop = `column${index + 1}_${suffix++}`
  usedProps.add(prop)

  const normalized = {
    prop,
    label: cleanString(column.label) || `列 ${index + 1}`,
    fixed: Boolean(column.fixed),
    component: cleanString(column.component),
    attrs: normalizeAttrs(column.attrs)
  }

  const width = cleanNumber(column.width, 1, 2000)
  if (width !== undefined) normalized.width = width

  if (column.defaultValue !== undefined && column.defaultValue !== '') {
    normalized.defaultValue = column.defaultValue
  }
  if (column.defaultValueType && ['literal', 'code', 'today', 'now'].includes(column.defaultValueType)) {
    normalized.defaultValueType = column.defaultValueType
  }

  return normalized
}

export function normalizeSection(section = {}, index = 0) {
  const usedProps = new Set()
  const columns = Array.isArray(section.columns) && section.columns.length
    ? section.columns.map((column, columnIndex) => normalizeColumn(column, columnIndex, usedProps))
    : [normalizeColumn({ prop: 'title', label: '标题', fixed: true }, 0, usedProps)]

  return {
    type: cleanString(section.type) || `section-${index + 1}`,
    title: cleanString(section.title) || `区块 ${index + 1}`,
    icon: cleanString(section.icon) || 'fas fa-list',
    hasExpandColumn: Boolean(section.hasExpandColumn),
    columns
  }
}

export function normalizeReportConfig(config) {
  const source = Array.isArray(config) && config.length ? config : DEFAULT_REPORT_CONFIG
  const sections = source.map((section, index) => normalizeSection(section, index))
  return sections.length ? sections : cloneConfig(DEFAULT_REPORT_CONFIG)
}

function evaluateDefaultValue(expression) {
  const code = String(expression ?? '').trim()
  if (!code) return ''
  try {
    // 本地桌面应用，默认值由用户自己维护；全局 moment / lodash 可直接用
    const result = new Function(`"use strict"; return (${code});`)()
    return result === undefined || result === null ? '' : result
  } catch (error) {
    console.warn('[report] 默认值表达式执行失败:', code, error)
    return ''
  }
}

/**
 * 计算列默认值：literal / code / today / now，兼容历史 moment 写法
 */
export function resolveDefaultValue(column = {}) {
  if (column.defaultValueType === 'today') return formatDate()
  if (column.defaultValueType === 'now') return Date.now()
  if (column.defaultValueType === 'code') return evaluateDefaultValue(column.defaultValue)

  const value = column.defaultValue
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (/^moment\(\)\.format\(\s*['"]YYYY-MM-DD['"]\s*\)$/.test(trimmed)) {
    return formatDate()
  }
  if (trimmed === 'Date.now()') return Date.now()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return value
}

/**
 * 创建一行空白数据（带默认值）
 */
export function createRow(columns = []) {
  const row = { id: generateId() }
  columns.forEach(column => {
    if (column.prop && row[column.prop] === undefined) {
      row[column.prop] = resolveDefaultValue(column)
    }
  })
  return row
}

/**
 * 默认结构 -> 新周报的 sections（每个区块预置一行）
 */
export function createSectionsFromConfig(config) {
  return normalizeReportConfig(config).map(section => ({
    ...cloneConfig(section),
    items: [createRow(section.columns)]
  }))
}

export default DEFAULT_REPORT_CONFIG
