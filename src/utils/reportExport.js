/**
 * 周报导出共享工具
 * 抽取自 App.vue 的 copyContent / exportWeekly，供单份复制、单份导出、批量导出复用
 */
import { renderHtml, renderMarkdown } from '@/utils/templateRenderer'
import { getDefaultTemplate } from '@/services/templateService'
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

/**
 * 渲染单份周报内容（复用 copyContent 的模板渲染逻辑）
 * @param {object} report - { title, dateRange, sections }
 * @param {'html'|'markdown'} format
 * @returns {Promise<string>} 渲染后的内容
 */
export async function renderReportContent(report, format = 'html') {
  // 复制/导出优先使用模板设计器里的默认模板；只有没有模板时才回退到画布 HTML
  const template = await getDefaultTemplate(format)
  if (template?.template) {
    const reportData = {
      title: report.title,
      dateRange: formatDateRange(report.dateRange),
      sections: report.sections || []
    }
    return format === 'markdown'
      ? renderMarkdown(reportData, template.template)
      : renderHtml(reportData, template.template)
  }

  if (format === 'html' && report?.layout && Array.isArray(report.layout.elements)) {
    return renderLayoutHtml(report, report.layout, report.sections || [])
  }

  throw new Error(`未找到${format === 'markdown' ? ' Markdown ' : ' HTML '}默认模板`)
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
