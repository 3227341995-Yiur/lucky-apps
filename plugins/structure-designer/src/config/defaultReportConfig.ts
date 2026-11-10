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
import reportDefaults from './defaults/report-config.json'
import { generateId } from '../utils/idGenerator.ts'
import { formatDate } from '../utils/date.ts'

export const DEFAULT_REPORT_CONFIG = reportDefaults.sections
export const SECTION_PRESETS = reportDefaults.sectionPresets
export const COLUMN_WIDGETS = reportDefaults.columnWidgets
export const ICON_OPTIONS = reportDefaults.icons

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
    attrs: normalizeAttrs(column.attrs),
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
    defaultRows: cleanNumber(section.defaultRows, 0, 100) ?? 0,
    columns,
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
function normalizeMultiValue(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // 不是 JSON 数组，按逗号分隔处理
      }
    }
    return trimmed.split(/[,，]/).map(item => item.trim()).filter(Boolean)
  }
  return [value]
}

export function resolveDefaultValue(column = {}) {
  let value

  if (column.defaultValueType === 'today') value = formatDate()
  else if (column.defaultValueType === 'now') value = Date.now()
  else if (column.defaultValueType === 'code') value = evaluateDefaultValue(column.defaultValue)
  else {
    value = column.defaultValue
    if (value === undefined || value === null) value = ''
    else if (typeof value === 'string') {
      const trimmed = value.trim()
      if (/^moment\(\)\.format\(\s*['"]YYYY-MM-DD['"]\s*\)$/.test(trimmed)) value = formatDate()
      else if (trimmed === 'Date.now()') value = Date.now()
      else if (trimmed === 'true') value = true
      else if (trimmed === 'false') value = false
    }
  }

  if (column.component === 'multi-select') return normalizeMultiValue(value)
  return value
}

/**
 * 创建一行空白数据（带默认值）
 */
export function createRow(columns = []) {
  const row = { id: generateId() }
  columns.forEach((column) => {
    if (column.prop && row[column.prop] === undefined) {
      row[column.prop] = resolveDefaultValue(column)
    }
  })
  return row
}

/**
 * 默认结构 -> 新周报的 sections（默认 0 行，按区块 defaultRows 生成）
 */
export function createSectionsFromConfig(config) {
  return normalizeReportConfig(config).map((section) => {
    const rows = Math.max(0, Math.min(100, Number(section.defaultRows) || 0))
    return {
      ...cloneConfig(section),
      items: Array.from({ length: rows }, () => createRow(section.columns)),
    }
  })
}

export default DEFAULT_REPORT_CONFIG
