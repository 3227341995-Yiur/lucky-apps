/**
 * 周报自由画布布局模型（Axure 风格设计器）
 *
 * config = {
 *   version: 2,
 *   page: { width, height, background, padding },
 *   elements: [{ id, type, x, y, w, h, style, sectionType?, text? }],
 *   sections: [{ type, title, icon, columns, hasExpandColumn }]  // 数据表结构
 * }
 *
 * 报表中只保存 page + elements（layout），数据表结构复用 report.sections。
 */
import layoutDefaults from './defaults/layout-defaults.json' with { type: 'json' }
import { generateId } from '../utils/idGenerator.js'
import {
  DEFAULT_REPORT_CONFIG,
  SECTION_PRESETS,
  cloneConfig,
  normalizeReportConfig,
  normalizeSection
} from './defaultReportConfig.js'

export const LAYOUT_VERSION = 2

export const PAGE_PRESETS = layoutDefaults.pagePresets
export const DEFAULT_PAGE = layoutDefaults.defaultPage
export const ELEMENT_TYPES = layoutDefaults.elementTypes
export const EP_WIDGETS = layoutDefaults.epWidgets
export const WIDGETS = layoutDefaults.widgets

const DEFAULT_STYLES = layoutDefaults.styles

const STYLE_KEYS = {
  title: ['fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight', 'letterSpacing', 'background', 'padding', 'borderWidth', 'borderColor', 'borderRadius', 'opacity'],
  date: ['fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight', 'letterSpacing', 'background', 'padding', 'borderWidth', 'borderColor', 'borderRadius', 'opacity'],
  text: ['fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight', 'letterSpacing', 'background', 'padding', 'borderWidth', 'borderColor', 'borderRadius', 'opacity'],
  section: ['background', 'padding', 'borderWidth', 'borderColor', 'borderRadius', 'opacity', 'titleSize', 'titleColor', 'headerBg', 'headerColor', 'bodyColor', 'fontSize'],
  divider: ['color', 'thickness', 'opacity'],
  el: ['background', 'padding', 'borderWidth', 'borderColor', 'borderRadius', 'opacity']
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function normalizePage(page = {}) {
  return {
    width: clamp(page.width, 320, 2000, DEFAULT_PAGE.width),
    height: clamp(page.height, 400, 5000, DEFAULT_PAGE.height),
    background: typeof page.background === 'string' && page.background
      ? page.background
      : DEFAULT_PAGE.background,
    padding: clamp(page.padding, 0, 200, DEFAULT_PAGE.padding)
  }
}

export function normalizeElementStyle(type, style = {}) {
  const defaults = DEFAULT_STYLES[type] || {}
  const keys = STYLE_KEYS[type] || []
  const normalized = { ...defaults }
  for (const key of keys) {
    if (style?.[key] !== undefined && style?.[key] !== '') normalized[key] = style[key]
  }
  // 旧版默认样式偏灰，读取时平滑迁移到当前 Element Plus 表格配色
  if (type === 'section') {
    if (normalized.headerBg === 'var(--el-fill-color-lighter)') {
      normalized.headerBg = 'var(--el-fill-color-light)'
    }
    if (normalized.headerColor === 'var(--el-text-color-regular)') {
      normalized.headerColor = 'var(--el-text-color-secondary)'
    }
    if (normalized.bodyColor === 'var(--el-text-color-regular)') {
      normalized.bodyColor = 'var(--el-text-color-primary)'
    }
  }
  return normalized
}

function normalizeElement(element = {}, index = 0, page = DEFAULT_PAGE, sections = []) {
  const type = ELEMENT_TYPES.includes(element.type) ? element.type : null
  if (!type) return null

  const fallback = WIDGETS.find(widget => widget.type === type)
  const w = Math.max(24, clamp(element.w, 24, page.width, fallback?.w || 200))
  const h = Math.max(2, clamp(element.h, 2, page.height, fallback?.h || 40))

  const normalized = {
    id: element.id || generateId(),
    type,
    x: clamp(element.x, -page.width, page.width * 2, page.padding),
    y: clamp(element.y, -page.height, page.height * 2, page.padding),
    w,
    h,
    style: normalizeElementStyle(type, element.style)
  }

  if (type === 'section') {
    const sectionType = String(element.sectionType || sections[0]?.type || '')
    if (!sections.some(section => section.type === sectionType)) return null
    normalized.sectionType = sectionType
  }

  if (type === 'text') {
    normalized.text = typeof element.text === 'string'
      ? element.text
      : '在这里输入内容…'
  }

  if (type === 'el') {
    normalized.component = typeof element.component === 'string' && /^el-/.test(element.component)
      ? element.component
      : 'el-button'
    normalized.props = element.props && typeof element.props === 'object' && !Array.isArray(element.props)
      ? { ...element.props }
      : {}
    normalized.text = typeof element.text === 'string' ? element.text : ''
  }

  return normalized
}

/**
 * 旧版 sections 配置 / 新布局配置统一归一化
 */
export function normalizeLayoutConfig(input) {
  if (Array.isArray(input)) {
    const sections = normalizeReportConfig(input)
    return createDefaultLayout(sections)
  }

  if (!input || typeof input !== 'object') {
    return createDefaultLayout(normalizeReportConfig(DEFAULT_REPORT_CONFIG))
  }

  const sections = normalizeReportConfig(input.sections || [])
  const page = normalizePage(input.page)
  const elements = (Array.isArray(input.elements) ? input.elements : [])
    .map((element, index) => normalizeElement(element, index, page, sections))
    .filter(Boolean)

  if (!elements.length) return createDefaultLayout(sections)

  return {
    version: LAYOUT_VERSION,
    page,
    elements,
    sections
  }
}

/**
 * 由数据表结构生成默认纵向排版
 */
export function createDefaultLayout(inputSections = DEFAULT_REPORT_CONFIG) {
  const sections = normalizeReportConfig(inputSections)
  const page = { ...DEFAULT_PAGE }
  const contentWidth = page.width - page.padding * 2
  const elements = []

  elements.push({
    id: generateId(),
    type: 'title',
    x: page.padding,
    y: 36,
    w: contentWidth,
    h: 46,
    style: normalizeElementStyle('title')
  })

  elements.push({
    id: generateId(),
    type: 'date',
    x: page.padding,
    y: 90,
    w: contentWidth,
    h: 30,
    style: normalizeElementStyle('date')
  })

  let y = 136
  for (const section of sections) {
    const h = Math.min(320, Math.max(190, 130 + (section.columns.length * 24)))
    elements.push({
      id: generateId(),
      type: 'section',
      sectionType: section.type,
      x: page.padding,
      y,
      w: contentWidth,
      h,
      style: normalizeElementStyle('section')
    })
    y += h + 18
  }

  page.height = Math.max(DEFAULT_PAGE.height, y + page.padding)
  return {
    version: LAYOUT_VERSION,
    page,
    elements,
    sections
  }
}

export function createWidget(type, overrides = {}) {
  const definition = WIDGETS.find(widget => widget.type === type)
  const base = {
    id: generateId(),
    type,
    x: overrides.x ?? DEFAULT_PAGE.padding,
    y: overrides.y ?? DEFAULT_PAGE.padding,
    w: overrides.w ?? definition?.w ?? 200,
    h: overrides.h ?? definition?.h ?? 40,
    style: normalizeElementStyle(type, overrides.style)
  }
  if (type === 'section') {
    base.sectionType = overrides.sectionType
    base.h = overrides.h ?? 200
  }
  if (type === 'text') {
    base.text = overrides.text ?? '在这里输入内容…'
  }
  if (type === 'el') {
    base.component = overrides.component || 'el-button'
    base.props = overrides.props ? { ...overrides.props } : {}
    base.text = overrides.text ?? ''
  }
  return base
}

export function createSectionFromPreset(preset, existingSections = []) {
  const source = preset || {
    title: '新表格',
    icon: 'fas fa-table',
    type: 'table',
    columns: [{ prop: 'title', label: '标题', fixed: true }]
  }
  const section = normalizeSection(cloneConfig(source), existingSections.length)
  const used = new Set(existingSections.map(item => item.type))
  let type = section.type
  let suffix = 2
  while (used.has(type)) type = `${section.type}-${suffix++}`
  section.type = type
  return section
}

/**
 * 报表只保存 page + elements，sections 复用报表数据
 */
export function extractLayout(config) {
  return {
    version: LAYOUT_VERSION,
    page: normalizePage(config?.page),
    elements: (config?.elements || [])
      .filter(element => element && ELEMENT_TYPES.includes(element.type))
      .map(element => cloneConfig(element))
  }
}

export function normalizeReportLayout(layout, sections) {
  if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) {
    return createDefaultLayout(sections)
  }
  return {
    version: LAYOUT_VERSION,
    page: normalizePage(layout.page),
    elements: layout.elements
      .map((element, index) => normalizeElement(element, index, normalizePage(layout.page), sections))
      .filter(Boolean),
    sections: normalizeReportConfig(sections)
  }
}

export function layoutBottom(layout) {
  const elements = layout?.elements || []
  return elements.reduce((bottom, element) => Math.max(bottom, element.y + element.h), 0)
}

export function pageHeightFor(layout) {
  const page = normalizePage(layout?.page)
  return Math.max(page.height, layoutBottom(layout) + page.padding)
}

// ============================================================
// 静态 HTML 渲染（复制 / HTML 导出）
// ============================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styleToCss(style = {}, mapping = {}) {
  const declarations = []
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === '') continue
    const cssKey = mapping[key] || key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
    if (key === 'fontSize' || key === 'titleSize' || key === 'letterSpacing' || key === 'thickness') {
      declarations.push(`${cssKey}:${Number(value) || value}px`)
    } else if (key === 'padding' || key === 'borderRadius' || key === 'borderWidth') {
      declarations.push(`${cssKey}:${Number(value) || value}px`)
    } else if (key === 'lineHeight' || key === 'opacity' || key === 'fontWeight') {
      declarations.push(`${cssKey}:${value}`)
    } else {
      declarations.push(`${cssKey}:${value}`)
    }
  }
  return declarations.join(';')
}

function renderElementWidget(element) {
  const props = element.props || {}
  const text = escapeHtml(element.text || '')
  const component = element.component || 'el-button'
  if (component === 'el-button') {
    return `<span style="display:inline-flex;align-items:center;justify-content:center;height:100%;min-height:28px;padding:0 14px;border-radius:6px;background:#3574f0;color:#fff;font-size:12px;">${text || '按钮'}</span>`
  }
  if (component === 'el-tag') {
    return `<span style="display:inline-flex;align-items:center;height:100%;padding:0 8px;border-radius:4px;background:#eaf1ff;color:#3574f0;font-size:11px;">${text || '标签'}</span>`
  }
  if (component === 'el-alert') {
    return `<div style="height:100%;box-sizing:border-box;padding:8px 10px;border-radius:5px;background:#eff6ff;color:#374151;font-size:12px;">${text || escapeHtml(props.title || '提示信息')}</div>`
  }
  if (component === 'el-card') {
    return `<div style="height:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:6px;background:#fff;padding:10px;font-size:12px;color:#374151;"><div style="font-weight:600;margin-bottom:6px;">${escapeHtml(props.header || '卡片标题')}</div><div style="white-space:pre-wrap;">${text}</div></div>`
  }
  if (component === 'el-progress') {
    const percentage = Math.max(0, Math.min(100, Number(props.percentage) || 0))
    return `<div style="display:flex;align-items:center;gap:8px;height:100%;font-size:11px;color:#6b7280;"><div style="flex:1;height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;"><div style="width:${percentage}%;height:100%;background:#3574f0;"></div></div><span>${percentage}%</span></div>`
  }
  if (component === 'el-table') {
    const columns = Array.isArray(props.columns) && props.columns.length ? props.columns : ['名称', '状态']
    const rows = Array.isArray(props.data) && props.data.length ? props.data : [['示例 A', '完成'], ['示例 B', '进行中']]
    const head = columns.map(column => `<th style="border:1px solid #e5e7eb;padding:5px 8px;background:#f8fafc;text-align:left;">${escapeHtml(column)}</th>`).join('')
    const body = rows.map(row => `<tr>${columns.map((_, i) => `<td style="border:1px solid #e5e7eb;padding:5px 8px;">${escapeHtml(row[i] || '')}</td>`).join('')}</tr>`).join('')
    return `<table style="width:100%;height:100%;border-collapse:collapse;font-size:11px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  }
  if (component === 'el-divider') {
    return '<div style="width:100%;border-top:1px solid #e5e7eb;"></div>'
  }
  if (component === 'el-switch') {
    return `<span style="display:inline-flex;align-items:center;width:36px;height:20px;padding:2px;box-sizing:border-box;border-radius:10px;background:${props.modelValue === false ? '#d1d5db' : '#3574f0'};"><span style="width:16px;height:16px;border-radius:50%;background:#fff;margin-left:${props.modelValue === false ? '0' : 'auto'};"></span></span>`
  }
  if (component === 'el-avatar') {
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:#eaf1ff;color:#3574f0;font-size:13px;">${text || 'W'}</span>`
  }
  if (component === 'el-badge') {
    return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#374151;">${text || '消息'}<span style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#e5484d;color:#fff;font-size:9px;">${props.value ?? 5}</span></span>`
  }
  if (component === 'el-rate') {
    const value = Math.max(0, Math.min(5, Number(props.modelValue) || 0))
    return `<span style="color:#f59e0b;font-size:15px;letter-spacing:2px;">${'★'.repeat(value)}${'☆'.repeat(5 - value)}</span>`
  }
  if (component === 'el-input' || component === 'el-select' || component === 'el-date-picker' || component === 'el-input-number') {
    return `<div style="display:flex;align-items:center;height:100%;box-sizing:border-box;padding:0 9px;border:1px solid #d1d5db;border-radius:5px;background:#fff;color:#9ca3af;font-size:11px;">${escapeHtml(props.placeholder || props.modelValue || '')}</div>`
  }
  return `<div style="font-size:12px;color:#374151;">${text || escapeHtml(component)}</div>`
}

function renderSectionTable(section, sectionStyle = {}) {
  if (!section) return ''
  const columns = section.columns || []
  const items = section.items || []
  const border = `1px solid ${sectionStyle.borderColor || '#e5e7eb'}`
  const headerStyle = `background:${sectionStyle.headerBg || '#f8fafc'};color:${sectionStyle.headerColor || '#374151'};font-weight:600;`
  const cellStyle = `color:${sectionStyle.bodyColor || '#4b5563'};font-size:${sectionStyle.fontSize || 12}px;`
  const titleStyle = `font-size:${sectionStyle.titleSize || 14}px;font-weight:650;color:${sectionStyle.titleColor || '#1f2937'};margin:0 0 8px;`

  const head = columns.map(column => `<th style="${headerStyle}border:${border};padding:6px 9px;text-align:left;white-space:nowrap;">${escapeHtml(column.label)}</th>`).join('')
  const rows = items.length
    ? items.map(item => `<tr>${columns.map(column => `<td style="${cellStyle}border:${border};padding:6px 9px;vertical-align:top;white-space:pre-wrap;">${escapeHtml(item[column.prop])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length || 1}" style="${cellStyle}border:${border};padding:12px;text-align:center;color:#9ca3af;">暂无数据</td></tr>`

  const detailRows = section.hasExpandColumn
    ? items.filter(item => item.content).map(item => `<tr><td colspan="${columns.length || 1}" style="${cellStyle}border:${border};padding:8px 9px;background:#fbfdff;white-space:pre-wrap;">${escapeHtml(item.content)}</td></tr>`).join('')
    : ''

  return `<div style="font-family:inherit;">
    <h3 style="${titleStyle}">${escapeHtml(section.title)}</h3>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}${detailRows}</tbody>
    </table>
  </div>`
}

/**
 * 把布局 + 报表数据渲染成可独立粘贴/打开的 HTML
 */
export function renderLayoutHtml(report, layout, sections) {
  const page = normalizePage(layout?.page)
  const sourceSections = Array.isArray(sections) ? sections : (report?.sections || [])
  const sectionMap = new Map(sourceSections.map(section => [section.type, section]))
  const height = Math.max(page.height, layoutBottom(layout) + page.padding)

  const elementsHtml = (layout?.elements || []).map(element => {
    const base = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.w}px;height:${element.h}px;box-sizing:border-box;overflow:hidden;`

    if (element.type === 'title') {
      return `<div style="${base}${styleToCss(element.style)}">${escapeHtml(report?.title || '')}</div>`
    }
    if (element.type === 'date') {
      const range = Array.isArray(report?.dateRange) ? report.dateRange.join(' ~ ') : (report?.dateRange || '')
      return `<div style="${base}${styleToCss(element.style)}">${escapeHtml(range)}</div>`
    }
    if (element.type === 'text') {
      return `<div style="${base}${styleToCss(element.style)};white-space:pre-wrap;">${escapeHtml(element.text || '')}</div>`
    }
    if (element.type === 'divider') {
      return `<div style="${base}border-top:${Number(element.style?.thickness) || 1}px solid ${element.style?.color || '#e5e7eb'};opacity:${element.style?.opacity ?? 1};"></div>`
    }
    if (element.type === 'section') {
      const section = sectionMap.get(element.sectionType)
      const boxStyle = styleToCss({
        background: element.style?.background,
        padding: element.style?.padding,
        borderWidth: element.style?.borderWidth,
        borderColor: element.style?.borderColor,
        borderRadius: element.style?.borderRadius,
        opacity: element.style?.opacity
      })
      return `<div style="${base}${boxStyle}">${renderSectionTable(section, element.style)}</div>`
    }
    if (element.type === 'el') {
      return `<div style="${base}${styleToCss(element.style)}">${renderElementWidget(element)}</div>`
    }
    return ''
  }).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report?.title || '周报')}</title>
  <style>
    :root {
      --el-bg-color: #ffffff;
      --el-fill-color-lighter: #f8fafc;
      --el-fill-color-light: #f1f5f9;
      --el-border-color-lighter: #e5e7eb;
      --el-border-color: #d1d5db;
      --el-text-color-primary: #1f2937;
      --el-text-color-regular: #374151;
      --el-text-color-secondary: #6b7280;
      --el-text-color-placeholder: #9ca3af;
    }
    body { margin: 0; background: #eef2f7; padding: 24px; }
  </style>
</head>
<body>
  <div style="position:relative;width:${page.width}px;min-height:${height}px;margin:0 auto;background:${page.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;box-shadow:0 8px 30px rgba(15,23,42,.12);">
    ${elementsHtml}
  </div>
</body>
</html>`
}

export function sectionPresets() {
  return SECTION_PRESETS
}

export default {
  normalizeLayoutConfig,
  createDefaultLayout,
  createWidget,
  createSectionFromPreset,
  extractLayout,
  normalizeReportLayout,
  renderLayoutHtml,
  PAGE_PRESETS,
  WIDGETS
}
