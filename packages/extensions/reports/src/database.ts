/**
 * 数据访问层（SQLite / Cordis Node 服务）
 *
 * 约定：
 * - reports 使用 deleted_at 软删除，回收站之外的所有查询都必须过滤 deleted_at IS NULL
 * - 任何写操作递增 dataVersion，插件搜索缓存据此失效
 * - config 存 JSON 字符串；meta 存系统设置与迁移标记
 */
import { useWeekReport as useHost } from '@lucky-apps/plugin-api'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  dateRange TEXT NOT NULL,
  sections TEXT NOT NULL,
  layout TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'html',
  isDefault INTEGER DEFAULT 0,
  isSystem INTEGER DEFAULT 0,
  template TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`

export const database = {
  select: (sql, params) => useHost().db.select(sql, params),
  execute: (sql, params) => useHost().db.execute(sql, params),
}

export async function ensureDatabase() {
  await initDatabase()
}

export async function initDatabase() {
  try {
    for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
      await database.execute(statement)
    }

    await migrateReportsSchema()
    await migrateReportSoftDelete()
    await migrateReportLayout()
    await migrateFromLocalStorage()
    await setMeta('db_initialized_v2', 'true')
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    throw error
  }
}

// 迁移 reports 表结构（旧 data 列拆分为 title, dateRange, sections）
async function migrateReportsSchema() {
  const schemaMigrated = await getMeta('migrated_reports_schema_v2')
  if (schemaMigrated) return

  const columns = await database.select('PRAGMA table_info(reports)')
  const columnNames = columns.map(c => c.name)
  if (!columnNames.includes('data') || columnNames.includes('title')) {
    await setMeta('migrated_reports_schema_v2', 'true')
    return
  }

  try {
    // 先验证数据能正确提取
    const testRow = await database.select('SELECT id, data FROM reports LIMIT 1')
    if (testRow.length > 0) {
      const testData = JSON.parse(testRow[0].data)
      if (!testData.title || !testData.dateRange || !testData.sections) {
        throw new Error('数据验证失败: title/dateRange/sections 字段缺失')
      }
    }

    await database.execute(`
      CREATE TABLE reports_tmp (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        dateRange TEXT NOT NULL,
        sections TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    await database.execute(`
      INSERT INTO reports_tmp (id, title, dateRange, sections, created_at, updated_at)
      SELECT
        id,
        json_extract(data, '$.title'),
        json_extract(data, '$.dateRange'),
        json_extract(data, '$.sections'),
        created_at,
        updated_at
      FROM reports
    `)

    const oldCount = await database.select('SELECT COUNT(*) as cnt FROM reports')
    const newCount = await database.select('SELECT COUNT(*) as cnt FROM reports_tmp')
    if (oldCount[0].cnt !== newCount[0].cnt) {
      throw new Error(`迁移数据条数不一致: ${oldCount[0].cnt} -> ${newCount[0].cnt}`)
    }

    const verifyRows = await database.select(`
      SELECT r.id, r.data, t.sections as newSections
      FROM reports r
      JOIN reports_tmp t ON r.id = t.id
      ORDER BY RANDOM() LIMIT 1
    `)
    if (verifyRows.length > 0) {
      const original = JSON.parse(verifyRows[0].data).sections
      const migrated = JSON.parse(verifyRows[0].newSections)
      if (JSON.stringify(original) !== JSON.stringify(migrated)) {
        throw new Error('sections 数据不一致，已中止迁移')
      }
    }

    await database.execute('DROP TABLE reports')
    await database.execute('ALTER TABLE reports_tmp RENAME TO reports')
    await setMeta('migrated_reports_schema_v2', 'true')
    console.log('[DB] Reports table migrated to new schema')
  } catch (error) {
    console.error('[DB] Reports migration failed:', error.message)
    try { await database.execute('DROP TABLE IF EXISTS reports_tmp') } catch {}
    throw error
  }
}

// 软删除字段迁移（回收站）
async function migrateReportSoftDelete() {
  if (await getMeta('migrated_reports_soft_delete_v1')) return

  const columns = await database.select('PRAGMA table_info(reports)')
  const columnNames = columns.map(c => c.name)
  if (!columnNames.includes('deleted_at')) {
    await database.execute('ALTER TABLE reports ADD COLUMN deleted_at INTEGER DEFAULT NULL')
  }
  await database.execute('CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at)')
  await setMeta('migrated_reports_soft_delete_v1', 'true')
}

// 自由画布布局字段迁移
async function migrateReportLayout() {
  if (await getMeta('migrated_reports_layout_v1')) return
  const columns = await database.select('PRAGMA table_info(reports)')
  if (!columns.map(c => c.name).includes('layout')) {
    await database.execute('ALTER TABLE reports ADD COLUMN layout TEXT')
  }
  await setMeta('migrated_reports_layout_v1', 'true')
}

async function migrateFromLocalStorage() {
  if (await getMeta('migrated_from_localStorage')) return

  const savedReports = localStorage.getItem('weeklyReports')
  if (savedReports) {
    try {
      for (const report of JSON.parse(savedReports)) {
        await saveReport(report)
      }
    } catch (error) {
      console.error('[DB] 迁移周报数据失败:', error)
    }
  }

  // 旧版默认结构存在 localStorage；原样存入 config，读取时做兼容解析
  const savedConfig = localStorage.getItem('reportConfig')
  const existingConfig = await database.select('SELECT id FROM config WHERE id = 1')
  if (savedConfig && existingConfig.length === 0) {
    await saveConfig(savedConfig)
  }

  await setMeta('migrated_from_localStorage', 'true')
}

// ============================================================
// 统计
// ============================================================
export async function getTotalReportCount() {
  const result = await database.select('SELECT COUNT(*) as count FROM reports WHERE deleted_at IS NULL')
  return Number(result[0]?.count) || 0
}

export async function getTrashCount() {
  const result = await database.select('SELECT COUNT(*) as count FROM reports WHERE deleted_at IS NOT NULL')
  return Number(result[0]?.count) || 0
}

export async function getTotalWorkItemCount() {
  const rows = await database.select('SELECT sections FROM reports WHERE deleted_at IS NULL')
  let total = 0
  for (const row of rows) {
    try {
      for (const section of JSON.parse(row.sections) || []) {
        total += section.items?.length || 0
      }
    } catch {
      // 单条数据损坏不影响整体统计
    }
  }
  return total
}

export async function getReportStats() {
  const [reportCount, trashCount, workItemCount, templateCount] = await Promise.all([
    getTotalReportCount(),
    getTrashCount(),
    getTotalWorkItemCount(),
    database.select('SELECT COUNT(*) as count FROM templates')
      .then(rows => Number(rows[0]?.count) || 0)
      .catch(() => 0),
  ])
  return {
    reports: reportCount,
    workItems: workItemCount,
    trash: trashCount,
    templates: templateCount,
  }
}

// ============================================================
// 周报读取
// ============================================================
const REPORT_META_FIELDS = 'id, title, dateRange, created_at, updated_at, deleted_at'

function mapReportRow(row, withSections = false) {
  const report = {
    id: row.id,
    title: row.title,
    dateRange: safeParse(row.dateRange, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  if (row.deleted_at != null) report.deleted_at = row.deleted_at
  if (withSections) {
    report.sections = safeParse(row.sections, [])
    report.layout = row.layout ? safeParse(row.layout, null) : null
  } else {
    report.sections = []
  }
  return report
}

export async function loadAllReports({ limit = 10, offset = 0 } = {}) {
  const rows = await database.select(
    `SELECT ${REPORT_META_FIELDS} FROM reports
     WHERE deleted_at IS NULL
     ORDER BY id DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map(row => mapReportRow(row))
}

export async function loadDeletedReports({ limit = 100, offset = 0 } = {}) {
  const rows = await database.select(
    `SELECT ${REPORT_META_FIELDS} FROM reports
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map(row => mapReportRow(row))
}

export async function getRecentReports(limit = 5) {
  return loadAllReports({ limit, offset: 0 })
}

export async function loadReportSections(id) {
  const rows = await database.select(
    'SELECT sections FROM reports WHERE id = $1 AND deleted_at IS NULL',
    [id],
  )
  return rows.length > 0 ? safeParse(rows[0].sections, []) : []
}

/**
 * 全量周报（含 sections）
 * @param {{ includeDeleted?: boolean }} options
 */
export async function loadAllReportsFull({ includeDeleted = false } = {}) {
  const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL'
  const rows = await database.select(
    `SELECT id, title, dateRange, sections, layout, created_at, updated_at, deleted_at
     FROM reports ${where} ORDER BY id DESC`,
  )
  return rows.map(row => mapReportRow(row, true))
}

export async function getReportById(id, { includeDeleted = false } = {}) {
  const where = includeDeleted ? '' : 'AND deleted_at IS NULL'
  const rows = await database.select(
    `SELECT id, title, dateRange, sections, layout, created_at, updated_at, deleted_at
     FROM reports WHERE id = $1 ${where}`,
    [id],
  )
  return rows.length === 0 ? null : mapReportRow(rows[0], true)
}

// ============================================================
// 周报写入
// ============================================================
export async function saveReport(report) {
  if (!report?.id) throw new Error('saveReport 缺少 report.id')
  const now = Date.now()

  const existing = await database.select(
    'SELECT id, deleted_at FROM reports WHERE id = $1',
    [report.id],
  )

  if (existing.length > 0) {
    if (existing[0].deleted_at != null) {
      throw new Error('该周报已在回收站中，请先恢复后再保存')
    }
    await database.execute(
      `UPDATE reports SET title = $1, dateRange = $2, sections = $3, layout = $4, updated_at = $5
       WHERE id = $6 AND deleted_at IS NULL`,
      [
        report.title,
        JSON.stringify(report.dateRange || []),
        JSON.stringify(report.sections || []),
        report.layout ? JSON.stringify(report.layout) : null,
        now,
        report.id,
      ],
    )
  } else {
    await database.execute(
      `INSERT INTO reports (id, title, dateRange, sections, layout, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        report.id,
        report.title,
        JSON.stringify(report.dateRange || []),
        JSON.stringify(report.sections || []),
        report.layout ? JSON.stringify(report.layout) : null,
        now,
        now,
      ],
    )
  }
  dataVersion++
}

/**
 * 软删除：移入回收站
 */
export async function deleteReportById(id) {
  const result = await database.execute(
    'UPDATE reports SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL',
    [Date.now(), id],
  )
  dataVersion++
  return (result?.rowsAffected ?? 0) > 0
}

export async function restoreReportById(id) {
  const result = await database.execute(
    'UPDATE reports SET deleted_at = NULL, updated_at = $1 WHERE id = $2 AND deleted_at IS NOT NULL',
    [Date.now(), id],
  )
  dataVersion++
  return (result?.rowsAffected ?? 0) > 0
}

export async function deleteReportPermanently(id) {
  const result = await database.execute(
    'DELETE FROM reports WHERE id = $1 AND deleted_at IS NOT NULL',
    [id],
  )
  dataVersion++
  return (result?.rowsAffected ?? 0) > 0
}

export async function emptyTrash() {
  const result = await database.execute('DELETE FROM reports WHERE deleted_at IS NOT NULL')
  dataVersion++
  return result?.rowsAffected ?? 0
}

// ============================================================
// 默认结构配置
// ============================================================
export async function loadConfig() {
  const rows = await database.select('SELECT data FROM config WHERE id = 1')
  return rows.length > 0 ? rows[0].data : null
}

export async function saveConfig(configData) {
  const now = Date.now()
  await database.execute(
    `INSERT INTO config (id, data, updated_at) VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET data = $1, updated_at = $2`,
    [typeof configData === 'string' ? configData : JSON.stringify(configData), now],
  )
}

export async function clearConfig() {
  await database.execute('DELETE FROM config WHERE id = 1')
}

// ============================================================
// 系统设置（meta）
// ============================================================
export async function getMeta(key) {
  const rows = await database.select('SELECT value FROM meta WHERE key = $1', [key])
  return rows.length > 0 ? rows[0].value : null
}

export async function setMeta(key, value) {
  await database.execute(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, String(value)],
  )
}

export async function getSetting(key, fallback = null) {
  const raw = await getMeta(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function setSetting(key, value) {
  await setMeta(key, JSON.stringify(value))
}

// ============================================================
// 数据版本（搜索缓存失效）
// ============================================================
let dataVersion = 0

export function getDataVersion() {
  return dataVersion
}

function safeParse(text, fallback) {
  try {
    const value = JSON.parse(text)
    return value ?? fallback
  } catch (error) {
    console.error('[DB] JSON 解析失败:', error)
    return fallback
  }
}
