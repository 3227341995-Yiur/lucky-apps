/**
 * 导入文件解析与校验（纯函数，不依赖数据库，便于单测）
 */
export const BACKUP_FORMAT = 'week-report-backup'

export function parseImportData(raw) {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('无法识别的文件内容，请选择周报或备份 JSON 文件')
  }

  if (!Array.isArray(raw) && raw.format === BACKUP_FORMAT) {
    if (!Array.isArray(raw.reports)) {
      throw new Error('备份文件缺少周报数据（reports）')
    }
    const reports = raw.reports.map((report, index) => normalizeImportedReport(report, index, true))
    const templates = normalizeImportedTemplates(raw.templates)
    const hasConfig = Array.isArray(raw.config) && raw.config.length > 0

    return {
      kind: 'backup',
      data: { ...raw, reports, templates, config: hasConfig ? raw.config : null },
      summary: { reports: reports.length, templates: templates.length, hasConfig }
    }
  }

  const list = Array.isArray(raw) ? raw : [raw]
  if (list.length === 0) {
    throw new Error('文件中没有可导入的周报')
  }
  const reports = list.map((report, index) => normalizeImportedReport(report, index))

  return {
    kind: 'reports',
    data: reports,
    summary: { reports: reports.length, templates: 0, hasConfig: false }
  }
}

export function normalizeImportedReport(value, index, withDeleted = false) {
  const label = `第 ${index + 1} 份周报`
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}格式不正确`)
  }

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (!title) {
    throw new Error(`${label}缺少标题（title）`)
  }

  const dateRange = value.dateRange
  const rangeValid = Array.isArray(dateRange) &&
    dateRange.length === 2 &&
    dateRange.every(item => typeof item === 'string' && item.trim())
  const singleValid = typeof dateRange === 'string' && dateRange.trim()
  if (!rangeValid && !singleValid) {
    throw new Error(`${label}的日期范围（dateRange）格式不正确`)
  }

  if (!Array.isArray(value.sections)) {
    throw new Error(`${label}缺少区块数据（sections）`)
  }

  const report = {
    title,
    dateRange: rangeValid ? dateRange : dateRange.trim(),
    sections: value.sections.filter(section => section && typeof section === 'object')
  }
  if (value.layout && typeof value.layout === 'object') {
    report.layout = value.layout
  }
  if (withDeleted && value.deleted_at != null) {
    report.deleted_at = value.deleted_at
  }
  return report
}

export function normalizeImportedTemplates(list) {
  if (!Array.isArray(list)) return []

  const templates = []
  list.forEach((template, index) => {
    if (!template || typeof template !== 'object' || Array.isArray(template)) {
      throw new Error(`第 ${index + 1} 个模板格式不正确`)
    }
    if (template.isSystem) return
    if (typeof template.name !== 'string' || !template.name.trim() ||
        typeof template.template !== 'string' || !template.template.trim()) {
      throw new Error(`第 ${index + 1} 个模板缺少名称或内容`)
    }

    const id = Number(template.id)
    templates.push({
      id: Number.isFinite(id) ? id : null,
      name: template.name.trim(),
      type: template.type === 'markdown' ? 'markdown' : 'html',
      template: template.template
    })
  })
  return templates
}
