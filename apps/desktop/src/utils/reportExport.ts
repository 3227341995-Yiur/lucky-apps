/**
 * 周报导出共享工具
 * 抽取自 App.vue 的 copyContent / exportWeekly，供单份复制、单份导出、批量导出复用
 */
import { renderHtml, renderMarkdown } from '@/utils/templateRenderer'
import { getTemplateForType } from '@/services/templateService'
import { getSetting, setSetting } from '@/services/database'
import { renderLayoutHtml } from '@/config/reportLayout'

/**
 * 格式化日期范围显示
 * @param {string|string[]} dateRange
 * @returns {string}
 */
export function formatDateRange(dateRange) {
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return dateRange.join(' ~ ')
  }
  return dateRange
}

export const COPY_TEMPLATE_ENABLED_KEY = 'template.copy.enabled'
export const COPY_DEFAULT_TYPE_KEY = 'template.copy.defaultType'

/** 模板设计器里的复制设置：是否使用模板、默认类型 */
export async function getCopySettings() {
  const [enabled, defaultType] = await Promise.all([
    getSetting(COPY_TEMPLATE_ENABLED_KEY, true),
    getSetting(COPY_DEFAULT_TYPE_KEY, 'html'),
  ])
  return {
    enabled: enabled !== false,
    defaultType: typeof defaultType === 'string' && defaultType ? defaultType : 'html',
  }
}

export async function saveCopySettings(patch = {}) {
  if ('enabled' in patch) await setSetting(COPY_TEMPLATE_ENABLED_KEY, Boolean(patch.enabled))
  if ('defaultType' in patch && patch.defaultType) {
    await setSetting(COPY_DEFAULT_TYPE_KEY, String(patch.defaultType))
  }
  return getCopySettings()
}

/**
 * 渲染单份周报内容（复制/导出共用）
 * @param {object} report
 * @param {string} format - html / markdown / 自定义模板类型
 */
export async function renderReportContent(report, format = 'html') {
  const template = await getTemplateForType(format)
  if (template?.template) {
    const reportData = {
      title: report.title,
      dateRange: formatDateRange(report.dateRange),
      sections: report.sections || [],
    }
    return format === 'markdown'
      ? renderMarkdown(reportData, template.template)
      : renderHtml(reportData, template.template)
  }

  if (format === 'html' && report?.layout && Array.isArray(report.layout.elements)) {
    return renderLayoutHtml(report, report.layout, report.sections || [])
  }

  throw new Error(`未找到「${format}」类型的模板`)
}

/** 画布 HTML（模板开关关闭时复制使用） */
export async function renderCanvasContent(report) {
  if (report?.layout && Array.isArray(report.layout.elements) && report.layout.elements.length) {
    return renderLayoutHtml(report, report.layout, report.sections || [])
  }
  return renderReportContent(report, 'html')
}

/** 按复制设置渲染：关闭模板时直接复制画布内容 */
export async function renderCopyContent(report, type, settings) {
  const config = settings || await getCopySettings()
  if (!config.enabled) return renderCanvasContent(report)
  return renderReportContent(report, type || config.defaultType)
}

/**
 * 文件名安全化：去除非法字符与多余空白
 */
export function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|\n\r]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}

/**
 * 构造单份周报导出文件名
 * @param {object} report
 * @param {'html'|'markdown'} format
 * @returns {string}
 */
export function buildReportFilename(report, format) {
  const ext = format === 'markdown' ? 'md' : 'html'
  const titlePart = sanitizeFilename(report.title) || '周报'
  const datePart = Array.isArray(report.dateRange) ? report.dateRange.join('_') : ''
  return datePart ? `${titlePart}_${datePart}.${ext}` : `${titlePart}.${ext}`
}

/**
 * 触发浏览器下载文本文件（复用 exportWeekly 的下载逻辑）
 * @param {string} filename
 * @param {string} content
 * @param {string} mime
 */
export function downloadTextFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)

  // 触发下载
  link.click()

  // 清理
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 150)
}
