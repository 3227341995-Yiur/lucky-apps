/**
 * 模板服务 - 模板的 CRUD 操作
 * 使用 SQLite 数据库存储模板
 */
import { initDatabase } from './database'
import { generateId } from '@/utils/idGenerator'

// 模板表名
const TABLE_NAME = 'templates'

/**
 * 初始化模板表
 */
export async function initTemplateTable() {
  const db = await initDatabase()
  await db.execute(`
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 1000px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #409EFF; padding-bottom: 10px; }
    h2, h3 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f7fa; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .section-title { border-bottom: 2px solid #409EFF; padding-bottom: 5px; margin-bottom: 15px; }
    .support-detail { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .support-item { margin-bottom: 20px; }
    img { max-width: 100%; }
    pre { background-color: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
    code { font-family: monospace; background-color: rgba(27,31,35,0.05); border-radius: 3px; padding: 0.2em 0.4em; }
    blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding: 0 1em; }
    ul, ol { padding-left: 2em; }
  </style>
</head>
<body>
  <h1>{{title}}</h1>
  {{#each sections}}
  <div class="section">
    <h2 class="section-title">{{title}}</h2>
    <table>
      <thead>
        <tr>
          <th width="40">序号</th>
          {{#each columns}}
          <th>{{label}}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{add @index 1}}</td>
          {{#each ../columns}}
            {{!-- 根据 column.prop 从当前 item 中取出对应的值 --}}
            <td>{{lookup .. prop}}</td>
          {{/each}}
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/each}}
</body>
</html>`
}

/**
 * 创建 Markdown 模板配置
 */
export function createMarkdownTemplateData() {
  return `# {{title}}

**日期范围：** {{dateRange}}

{{#each sections}}
## {{title}}

{{#if items.length}}
| 序号 | {{#each columns}}{{label}} | {{/each}} |
| --- | {{#each columns}}--- | {{/each}} |
{{#each items}}
| {{add @index 1}} | {{#each ../columns}}{{lookup .. prop}} | {{/each}} |
{{/each}}

{{else}}
暂无数据
{{/if}}
{{/each}}`
}

/**
 * 获取所有模板
 */
export async function getAllTemplates() {
  const db = await initDatabase()
  const rows = await db.select(`SELECT * FROM ${TABLE_NAME} ORDER BY isSystem DESC, updatedAt DESC`)
  const templates = rows.map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault === 1,
    isSystem: row.isSystem === 1,
    template: row.template,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }))

  return templates
}

/**
 * 根据 ID 获取模板
 */
export async function getTemplateById(id) {
  const db = await initDatabase()
  const rows = await db.select(`SELECT * FROM ${TABLE_NAME} WHERE id = $1`, [id])
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
      updatedAt: row.updatedAt
    }
  }
  return null
}

/**
 * 获取默认模板（按类型）
 */
export async function getDefaultTemplate(type = 'html') {
  const db = await initDatabase()
  const rows = await db.select(`SELECT * FROM ${TABLE_NAME} WHERE isDefault = 1 AND type = $1 LIMIT 1`, [type])
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
      updatedAt: row.updatedAt
    }
  }
  return null
}

/**
 * 保存模板（新增或更新）
 */
export async function saveTemplate(template) {
  const db = await initDatabase()
  const now = Date.now()

  const existing = await db.select(
    `SELECT id FROM ${TABLE_NAME} WHERE id = $1`,
    [template.id]
  )

  if (existing.length > 0) {
    await db.execute(
      `UPDATE ${TABLE_NAME} SET name = $1, type = $2, isDefault = $3, isSystem = $4, template = $5, updatedAt = $6 WHERE id = $7`,
      [template.name, template.type || 'html', template.isDefault ? 1 : 0, template.isSystem ? 1 : 0, template.template, now, template.id]
    )
    return template.id
  } else {
    // 新增时生成id
    const newId = template.id || generateId()
    await db.execute(
      `INSERT INTO ${TABLE_NAME} (id, name, type, isDefault, isSystem, template, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newId, template.name, template.type || 'html', template.isDefault ? 1 : 0, template.isSystem ? 1 : 0, template.template, now, now]
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
    updatedAt: Date.now()
  }
}

/**
 * 删除模板
 */
export async function deleteTemplate(id) {
  const db = await initDatabase()
  await db.execute(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [id])
}

/**
 * 设置默认模板（按类型）
 */
export async function setDefaultTemplate(id, type = null) {
  const db = await initDatabase()
  const now = Date.now()

  if (type) {
    await db.execute(`UPDATE ${TABLE_NAME} SET isDefault = 0, updatedAt = $1 WHERE type = $2`, [now, type])
  } else {
    await db.execute(`UPDATE ${TABLE_NAME} SET isDefault = 0, updatedAt = $1`, [now])
  }

  await db.execute(`UPDATE ${TABLE_NAME} SET isDefault = 1, updatedAt = $1 WHERE id = $2`, [now, id])
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
        updatedAt: Date.now()
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
        updatedAt: Date.now()
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