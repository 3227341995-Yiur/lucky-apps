import Database from '@tauri-apps/plugin-sql'

let db = null

const DB_NAME = 'sqlite:week_report.db'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  dateRange TEXT NOT NULL,
  sections TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
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

export async function initDatabase() {
  if (db) return db

  try {
    console.log('[DB] Loading database:', DB_NAME)
    db = await Database.load(DB_NAME)
    console.log('[DB] Database loaded successfully')

    const statements = SCHEMA.split(';').filter(s => s.trim())
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.execute(stmt)
      }
    }
    console.log('[DB] Schema initialized')

    await migrateReportsSchema(db)
    await migrateFromLocalStorage(db)
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    throw error
  }
}

// 迁移 reports 表结构（旧 data 列拆分为 title, dateRange, sections）
async function migrateReportsSchema(database) {
  const schemaMigrated = await getMeta('migrated_reports_schema_v2')
  if (schemaMigrated) {
    console.log('[DB] Reports schema migration skipped (already migrated)')
    return
  }

  const columns = await database.select("PRAGMA table_info(reports)")
  const columnNames = columns.map(c => c.name)
  if (!columnNames.includes('data') || columnNames.includes('title')) {
    console.log('[DB] Reports schema migration skipped (new format or no data column)')
    return
  }

  try {
    // 先验证数据能正确提取
    const testRow = await database.select('SELECT id, data FROM reports LIMIT 1')
    if (testRow.length > 0) {
      const testData = testRow[0].data
      const testTitle = JSON.parse(testData).title
      const testDateRange = JSON.parse(testData).dateRange
      const testSections = JSON.parse(testData).sections
      if (!testTitle || !testDateRange || !testSections) {
        throw new Error('数据验证失败: title/dateRange/sections 字段缺失')
      }
    }

    // 创建临时表迁移数据
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

    // 验证迁移后数据条数一致
    const oldCount = await database.select('SELECT COUNT(*) as cnt FROM reports')
    const newCount = await database.select('SELECT COUNT(*) as cnt FROM reports_tmp')
    if (oldCount[0].cnt !== newCount[0].cnt) {
      throw new Error(`迁移数据条数不一致: ${oldCount[0].cnt} -> ${newCount[0].cnt}`)
    }

    // 验证sections数据一致性：随机抽一条对比原data和迁移后的sections
    const verifyRows = await database.select(`
      SELECT r.id, r.data, t.sections as newSections
      FROM reports r
      JOIN reports_tmp t ON r.id = t.id
      ORDER BY RANDOM() LIMIT 1
    `)
    if (verifyRows.length > 0) {
      const originalSections = JSON.parse(verifyRows[0].data).sections
      const migratedSections = JSON.parse(verifyRows[0].newSections)
      const originalStr = JSON.stringify(originalSections)
      const migratedStr = JSON.stringify(migratedSections)
      if (originalStr !== migratedStr) {
        throw new Error(`sections数据不一致: \n原值: ${originalStr}\n迁移后: ${migratedStr}`)
      }
    }

    await database.execute('DROP TABLE reports')
    await database.execute('ALTER TABLE reports_tmp RENAME TO reports')
    await setMeta('migrated_reports_schema_v2', 'true')
    console.log('[DB] Reports table migrated to new schema')
  } catch (e) {
    console.error('[DB] Reports migration failed:', e.message)
    try { await database.execute('DROP TABLE IF EXISTS reports_tmp') } catch {}
    throw e
  }
}

async function migrateFromLocalStorage() {
  const migrated = await getMeta('migrated_from_localStorage')
  if (migrated) {
    console.log('[DB] LocalStorage migration skipped (already migrated)')
    return
  }

  // 迁移周报数据
  const savedReports = localStorage.getItem('weeklyReports')
  if (savedReports) {
    try {
      const reports = JSON.parse(savedReports)
      for (const report of reports) {
        await saveReport(report)
      }
    } catch (e) {
      console.error('迁移周报数据失败:', e)
    }
  }

  // 迁移配置数据
  const savedConfig = localStorage.getItem('reportConfig')
  if (savedConfig) {
    await saveConfig(savedConfig)
  }

  await setMeta('migrated_from_localStorage', 'true')
}

export async function loadAllReports({ limit = 10, offset = 0 } = {}) {
  const database = await initDatabase()
  const rows = await database.select(
    'SELECT id, title, dateRange, created_at, updated_at FROM reports ORDER BY id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  )
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    dateRange: JSON.parse(row.dateRange),
    sections: [],
    created_at: row.created_at,
    updated_at: row.updated_at
  }))
}

export async function loadReportSections(id) {
  const database = await initDatabase()
  const rows = await database.select('SELECT sections FROM reports WHERE id = $1', [id])
  if (rows.length > 0) {
    return JSON.parse(rows[0].sections)
  }
  return []
}

export async function saveReport(report) {
  const database = await initDatabase()
  const now = Date.now()

  // 检查是否已存在
  const existing = await database.select(
    'SELECT id FROM reports WHERE id = $1',
    [report.id]
  )

  if (existing.length > 0) {
    await database.execute(
      'UPDATE reports SET title = $1, dateRange = $2, sections = $3, updated_at = $4 WHERE id = $5',
      [report.title, JSON.stringify(report.dateRange), JSON.stringify(report.sections), now, report.id]
    )
  } else {
    await database.execute(
      'INSERT INTO reports (id, title, dateRange, sections, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [report.id, report.title, JSON.stringify(report.dateRange), JSON.stringify(report.sections), now, now]
    )
  }
}

export async function deleteReportById(id) {
  const database = await initDatabase()
  await database.execute('DELETE FROM reports WHERE id = $1', [id])
}

export async function loadConfig() {
  const database = await initDatabase()
  const rows = await database.select('SELECT data FROM config WHERE id = 1')
  if (rows.length > 0) {
    return rows[0].data
  }
  return null
}

export async function saveConfig(configData) {
  const database = await initDatabase()
  const now = Date.now()

  await database.execute(
    `INSERT INTO config (id, data, updated_at) VALUES (1, $1, $2)
     ON CONFLICT(id) DO UPDATE SET data = $1, updated_at = $2`,
    [configData, now]
  )
}

async function getMeta(key) {
  const database = await initDatabase()
  const rows = await database.select('SELECT value FROM meta WHERE key = $1', [key])
  return rows.length > 0 ? rows[0].value : null
}

async function setMeta(key, value) {
  const database = await initDatabase()
  await database.execute(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, value]
  )
}
