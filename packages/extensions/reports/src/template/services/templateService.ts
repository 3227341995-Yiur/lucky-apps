/**
 * 模板服务 - 模板的 CRUD 操作
 * 使用 SQLite 数据库存储模板
 */
import defaultHtmlTemplate from '../config/default-html.html?raw'
import defaultMarkdownTemplate from '../config/default-markdown.md?raw'
import { database } from '../../database'
import { generateId } from '../../designer/utils/idGenerator'

// 模板表名
const TABLE_NAME = 'templates'

/**
 * 初始化模板表
 */
export async function initTemplateTable() {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'html',
      isDefault INTEGER DEFAULT 0,
      isSystem INTEGER DEFAULT 0,
      template TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `)
}

/**
 * 创建默认 HTML 模板配置（纯模板字符串）
 * 周报数据结构: title, dateRange, sections[{title, columns[{label, prop}], items, hasExpandColumn}]
 */
export function createDefaultTemplateData() {
  return defaultHtmlTemplate
}

/**
 * 创建 Markdown 模板配置
 */
export function createMarkdownTemplateData() {
  return defaultMarkdownTemplate
}

/**
 * 获取所有模板
 */
export async function getAllTemplates() {
  const rows = await database.select(`SELECT * FROM ${TABLE_NAME} ORDER BY isSystem DESC, createdAt DESC`)
  const templates = rows.map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault === 1,
    isSystem: row.isSystem === 1,
    template: row.template,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))

  return templates
}

/**
 * 根据 ID 获取模板
 */
export async function getTemplateById(id) {
  const rows = await database.select(`SELECT * FROM ${TABLE_NAME} WHERE id = $1`, [id])
  if (rows.length > 0) {
    const row = rows[0]
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isDefault: row.isDefault === 1,
      isSystem: row.isSystem === 1,
      template: row.template,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
  return null
}


export const BUILTIN_TEMPLATE_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
]

export function templateTypeLabel(type, types = BUILTIN_TEMPLATE_TYPES) {
  return types.find(item => item.value === type)?.label || String(type || '').toUpperCase()
}

/** 模板类型不写死：HTML / Markdown + 数据库里用户创建的自定义类型 */
export async function getTemplateTypes() {
  let rows = []
  try {
    rows = await database.select(`SELECT DISTINCT type FROM ${TABLE_NAME} ORDER BY type`)
  } catch {
    rows = []
  }
  const types = new Map(BUILTIN_TEMPLATE_TYPES.map(item => [item.value, item.label]))
  for (const row of rows) {
    if (row?.type) types.set(row.type, templateTypeLabel(row.type))
  }
  return [...types.entries()].map(([value, label]) => ({ value, label }))
}

/** 复制/导出按类型取模板：优先默认模板，其次同类型最近创建的模板 */
export async function getTemplateForType(type = 'html') {
  const preferred = await getDefaultTemplate(type)
  if (preferred?.template) return preferred
  const rows = await database.select(
    `SELECT * FROM ${TABLE_NAME} WHERE type = $1 ORDER BY createdAt DESC LIMIT 1`,
    [type],
  )
  if (!rows.length) return null
  const row = rows[0]
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault === 1,
    isSystem: row.isSystem === 1,
    template: row.template,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 获取默认模板（按类型）
 */
export async function getDefaultTemplate(type = 'html') {
  const rows = await database.select(`SELECT * FROM ${TABLE_NAME} WHERE isDefault = 1 AND type = $1 LIMIT 1`, [type])
  if (rows.length > 0) {
    const row = rows[0]
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isDefault: true,
      isSystem: row.isSystem === 1,
      template: row.template,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
  return null
}

/**
 * 保存模板（新增或更新）
 */
export async function saveTemplate(template) {
  const now = Date.now()

  const existing = await database.select(
    `SELECT id FROM ${TABLE_NAME} WHERE id = $1`,
    [template.id],
  )

  if (existing.length > 0) {
    await database.execute(
      `UPDATE ${TABLE_NAME} SET name = $1, type = $2, isDefault = $3, isSystem = $4, template = $5, updatedAt = $6 WHERE id = $7`,
      [template.name, template.type || 'html', template.isDefault ? 1 : 0, template.isSystem ? 1 : 0, template.template, now, template.id],
    )
    return template.id
  } else {
    // 新增时生成id
    const newId = template.id || generateId()
    await database.execute(
      `INSERT INTO ${TABLE_NAME} (id, name, type, isDefault, isSystem, template, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newId, template.name, template.type || 'html', template.isDefault ? 1 : 0, template.isSystem ? 1 : 0, template.template, now, now],
    )
    return newId
  }
}

/**
 * 创建新模板
 */
export function createTemplate(name, type = 'html', template = '') {
  return {
    id: 0,
    name,
    type,
    isDefault: false,
    isSystem: false,
    template: template,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 删除模板
 */
export async function deleteTemplate(id) {
  await database.execute(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [id])
}

/**
 * 设置默认模板（按类型）
 */
export async function setDefaultTemplate(id, type = null) {
  const now = Date.now()

  if (type) {
    await database.execute(`UPDATE ${TABLE_NAME} SET isDefault = 0, updatedAt = $1 WHERE type = $2`, [now, type])
  } else {
    await database.execute(`UPDATE ${TABLE_NAME} SET isDefault = 0, updatedAt = $1`, [now])
  }

  await database.execute(`UPDATE ${TABLE_NAME} SET isDefault = 1, updatedAt = $1 WHERE id = $2`, [now, id])
}

/**
 * 初始化默认模板（如果不存在）
 */
export async function ensureDefaultTemplate() {
  const templates = await getAllTemplates()

  // 检查 HTML 默认模板
  const htmlTemplate = templates.find(t => t.type === 'html' && t.isDefault)
  if (!htmlTemplate) {
    const existingHtml = templates.find(t => t.type === 'html')
    if (existingHtml) {
      await setDefaultTemplate(existingHtml.id, 'html')
    } else {
      await saveTemplate({
        id: generateId(),
        name: '系统 HTML 模板',
        type: 'html',
        isDefault: true,
        isSystem: true,
        template: createDefaultTemplateData(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  // 检查 Markdown 默认模板
  const mdTemplate = templates.find(t => t.type === 'markdown' && t.isDefault)
  if (!mdTemplate) {
    const existingMd = templates.find(t => t.type === 'markdown')
    if (existingMd) {
      await setDefaultTemplate(existingMd.id, 'markdown')
    } else {
      await saveTemplate({
        id: generateId(),
        name: '系统 Markdown 模板',
        type: 'markdown',
        isDefault: true,
        isSystem: true,
        template: createMarkdownTemplateData(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  return null
}

/**
 * 获取活动模板 ID（从 localStorage）
 */
export function getActiveTemplateId() {
  return localStorage.getItem('activeTemplateId')
}

/**
 * 设置活动模板 ID
 */
export function setActiveTemplateId(id) {
  localStorage.setItem('activeTemplateId', id)
}

/**
 * 获取活动模板（根据 localStorage 中存储的 ID）
 */
export async function getActiveTemplate(type = 'html') {
  const activeId = getActiveTemplateId()
  if (activeId) {
    const template = await getTemplateById(activeId)
    if (template) return template
  }
  // 如果没有活动模板，返回该类型的默认模板
  return getDefaultTemplate(type)
}
