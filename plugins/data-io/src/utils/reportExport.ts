/**
 * 周报导出（插件版）
 *
 * 与宿主 utils/reportExport + services/importExportService 的单份/批量导出保持一致；
 * 模板与新区块通过宿主插件 API 读取，渲染逻辑保留在插件内。
 */
import Handlebars from 'handlebars'
import { renderLayoutHtml } from './layoutRender.ts'
import { formatDate } from './date.ts'

const DOWNLOAD_GAP = 180

export function formatDateRange(dateRange) {
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return dateRange.join(' ~ ')
  }
  return dateRange
}

export function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|\n\r]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}

export function buildReportFilename(report, format) {
  const ext = format === 'markdown' ? 'md' : 'html'
  const titlePart = sanitizeFilename(report.title) || '周报'
  const datePart = Array.isArray(report.dateRange) ? report.dateRange.join('_') : ''
  return datePart ? `${titlePart}_${datePart}.${ext}` : `${titlePart}.${ext}`
}

export function downloadTextFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 150)
}

function renderTemplate(report, templateString) {
  const cleanTemplate = templateString.replace(/^#\s*(?:HTML|Markdown)\s+Template[^\n]*\n/i, '')
  return Handlebars.compile(cleanTemplate)(report)
}

/** 与宿主 getTemplateForType 一致：优先该类型默认模板，其次该类型最新模板 */
async function pickTemplate(api, type) {
  const templates = await api.templates.list()
  const ofType = (Array.isArray(templates) ? templates : [])
    .filter(template => template && template.type === type && template.template)
  return ofType.find(template => template.isDefault) || ofType[0] || null
}

export async function renderReportContent(api, report, format = 'html') {
  const template = await pickTemplate(api, format)
  if (template?.template) {
    const reportData = {
      title: report.title,
      dateRange: formatDateRange(report.dateRange),
      sections: report.sections || [],
    }
    return renderTemplate(reportData, template.template)
  }

  if (format === 'html' && report?.layout && Array.isArray(report.layout.elements)) {
    return renderLayoutHtml(report, report.layout, report.sections || [])
  }

  throw new Error(`未找到「${format}」类型的模板`)
}

async function ensureSections(api, report) {
  if (!report || typeof report !== 'object') {
    throw new Error('周报数据无效')
  }
  if (Array.isArray(report.sections) && report.sections.length > 0) {
    return report
  }
  if (report.id == null) {
    return { ...report, sections: Array.isArray(report.sections) ? report.sections : [] }
  }
  const full = await api.reports.get(report.id)
  return {
    ...report,
    sections: full?.sections || [],
    layout: full?.layout ?? report.layout ?? null,
  }
}

/**
 * 导出单份周报，返回导出的文件名
 */
export async function exportReport(api, report, format = 'html') {
  if (!report) throw new Error('没有可导出的周报')

  const target = await ensureSections(api, report)

  if (format === 'json') {
    const filename = `${sanitizeFilename(target.title) || '周报'}_${formatDate()}.json`
    downloadTextFile(filename, JSON.stringify(target, null, 2), 'application/json')
    return filename
  }

  if (format !== 'html' && format !== 'markdown') {
    throw new Error('不支持的导出格式')
  }

  const content = await renderReportContent(api, target, format)
  const filename = buildReportFilename(target, format)
  const mime = format === 'markdown' ? 'text/markdown' : 'text/html'
  downloadTextFile(filename, content, mime)
  return filename
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 批量导出
 * @returns {Promise<{ ok: number, fail: number }>}
 */
export async function exportReports(api, reports = [], format = 'html', { onProgress } = {}) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : []
  let ok = 0
  let fail = 0

  for (let index = 0; index < list.length; index++) {
    onProgress?.(index, list.length)
    try {
      await exportReport(api, list[index], format)
      ok++
    } catch (error) {
      console.error('[data-io] 导出失败:', list[index]?.title, error)
      fail++
    }
    onProgress?.(index + 1, list.length)
    if (index < list.length - 1) await sleep(DOWNLOAD_GAP)
  }

  return { ok, fail }
}
