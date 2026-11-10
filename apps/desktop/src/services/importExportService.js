/**
 * 导入导出服务
 *
 * - 备份格式：全量周报（含回收站）、模板与默认结构
 * - 导入：备份 / 单份周报 / 周报数组，统一生成新 ID，不覆盖现有数据
 * - 导出：单份、批量与备份文件
 */
import {
  loadAllReportsFull,
  loadReportSections,
  saveReport,
  deleteReportById
} from '@/services/database'
import { getAllTemplates, saveTemplate } from '@/services/templateService'
import { getReportConfig, saveReportConfig } from '@/services/reportConfigService'
import {
  renderReportContent,
  buildReportFilename,
  sanitizeFilename,
  downloadTextFile
} from '@/utils/reportExport'
import { generateId } from '@/utils/idGenerator'
import { formatDate } from '@/utils/date'
import { BACKUP_FORMAT, parseImportData } from '@/services/importParsing'

export { BACKUP_FORMAT }

const BACKUP_VERSION = 2
const DOWNLOAD_GAP = 180

/**
 * 生成备份数据（不落盘）
 */
export async function createBackup() {
  const [reports, templates, config] = await Promise.all([
    loadAllReportsFull({ includeDeleted: true }),
    getAllTemplates(),
    getReportConfig()
  ])

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'week-report',
    reports: reports.map(report => ({
      ...report,
      deleted_at: report.deleted_at ?? null
    })),
    templates,
    config
  }
}

/**
 * 导出全量备份文件
 */
export async function exportBackupFile() {
  const backup = await createBackup()
  const filename = `周报备份_${formatDate()}.json`
  downloadTextFile(filename, JSON.stringify(backup, null, 2), 'application/json')
  return backup
}

/**
 * 读取并解析导入文件
 * @param {File} file
 * @returns {Promise<{ kind: 'backup'|'reports', data: object|Array, summary: { reports: number, templates: number, hasConfig: boolean } }>}
 */
export async function parseImportFile(file) {
  if (!file || typeof file.text !== 'function') {
    throw new Error('请选择要导入的文件')
  }

  let text
  try {
    text = await file.text()
  } catch {
    throw new Error('文件读取失败，请重试')
  }

  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON 格式')
  }

  return parseImportData(raw)
}

/**
 * 执行导入
 * @param {object} parsed parseImportFile 的返回值
 * @param {{ importReports?: boolean, importTemplates?: boolean, importConfig?: boolean }} options
 * @returns {Promise<{ reports: number, templates: number, config: number }>}
 */
export async function importData(parsed, options = {}) {
  const {
    importReports = true,
    importTemplates = true,
    importConfig = false
  } = options

  if (!parsed || (parsed.kind !== 'backup' && parsed.kind !== 'reports')) {
    throw new Error('导入数据无效')
  }

  const isBackup = parsed.kind === 'backup'
  const result = { reports: 0, templates: 0, config: 0 }

  if (importReports) {
    const list = isBackup ? parsed.data?.reports : parsed.data
    if (!Array.isArray(list)) {
      throw new Error('导入数据缺少周报列表')
    }
    for (const source of list) {
      const id = generateId()
      await saveReport({
        id,
        title: source.title,
        dateRange: source.dateRange,
        sections: source.sections || [],
        layout: source.layout || null
      })
      if (isBackup && source.deleted_at != null) {
        await deleteReportById(id)
      }
      result.reports++
    }
  }

  if (isBackup && importTemplates) {
    result.templates = await importTemplatesFromBackup(parsed.data?.templates)
  }

  if (isBackup && importConfig && Array.isArray(parsed.data?.config) && parsed.data.config.length) {
    await saveReportConfig(parsed.data.config)
    result.config = 1
  }

  return result
}

async function importTemplatesFromBackup(templates) {
  if (!Array.isArray(templates) || templates.length === 0) return 0

  const existing = await getAllTemplates()
  const usedIds = new Set(existing.map(template => template.id))
  const usedNames = new Set(existing.map(template => template.name))
  let count = 0

  for (const source of templates) {
    if (!source || source.isSystem) continue
    if (typeof source.name !== 'string' || !source.name.trim() ||
        typeof source.template !== 'string' || !source.template.trim()) {
      continue
    }

    const name = source.name.trim()
    let id = Number.isFinite(source.id) ? source.id : null
    if (id == null || usedIds.has(id) || usedNames.has(name)) {
      id = generateId()
      while (usedIds.has(id)) id = generateId()
    }

    const finalName = usedNames.has(name) ? uniqueTemplateName(`${name}（导入）`, usedNames) : name

    await saveTemplate({
      id,
      name: finalName,
      type: source.type === 'markdown' ? 'markdown' : 'html',
      // ponytail: 不继承 isDefault，避免导入模板抢走系统默认模板
      isDefault: false,
      isSystem: false,
      template: source.template
    })

    usedIds.add(id)
    usedNames.add(finalName)
    count++
  }

  return count
}

function uniqueTemplateName(base, usedNames) {
  let name = base
  let index = 2
  while (usedNames.has(name)) {
    name = `${base}${index++}`
  }
  return name
}

/**
 * 导出单份周报
 * @param {object} report
 * @param {'html'|'markdown'|'json'} format
 * @returns {Promise<string>} 导出的文件名
 */
export async function exportReport(report, format = 'html') {
  if (!report) throw new Error('没有可导出的周报')

  const target = await ensureSections(report)

  if (format === 'json') {
    const filename = `${sanitizeFilename(target.title) || '周报'}_${formatDate()}.json`
    downloadTextFile(filename, JSON.stringify(target, null, 2), 'application/json')
    return filename
  }

  if (format !== 'html' && format !== 'markdown') {
    throw new Error('不支持的导出格式')
  }

  const content = await renderReportContent(target, format)
  const filename = buildReportFilename(target, format)
  const mime = format === 'markdown' ? 'text/markdown' : 'text/html'
  downloadTextFile(filename, content, mime)
  return filename
}

/**
 * 批量导出
 * @param {Array} reports 周报元数据（允许 sections 为空，内部按需加载）
 * @param {'html'|'markdown'|'json'} format
 * @param {{ onProgress?: (done: number, total: number) => void }} options
 * @returns {Promise<{ ok: number, fail: number }>}
 */
export async function exportReports(reports = [], format = 'html', { onProgress } = {}) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : []
  let ok = 0
  let fail = 0

  for (let index = 0; index < list.length; index++) {
    onProgress?.(index, list.length)
    try {
      await exportReport(list[index], format)
      ok++
    } catch (error) {
      console.error('[importExport] 导出失败:', list[index]?.title, error)
      fail++
    }
    onProgress?.(index + 1, list.length)
    if (index < list.length - 1) await sleep(DOWNLOAD_GAP)
  }

  return { ok, fail }
}

async function ensureSections(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('周报数据无效')
  }
  if (Array.isArray(report.sections) && report.sections.length > 0) {
    return report
  }
  if (report.id == null) {
    return { ...report, sections: Array.isArray(report.sections) ? report.sections : [] }
  }
  const sections = await loadReportSections(report.id)
  return { ...report, sections }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
