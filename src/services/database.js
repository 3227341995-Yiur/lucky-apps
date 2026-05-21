import Database from '@tauri-apps/plugin-sql'

let db = null

const DB_NAME = 'sqlite:week_report.db'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
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

    // 迁移 templates 表（添加新列）
    try {
      await db.execute(`ALTER TABLE templates ADD COLUMN type TEXT DEFAULT 'html'`)
      await db.execute(`ALTER TABLE templates ADD COLUMN isSystem INTEGER DEFAULT 0`)
      await db.execute(`ALTER TABLE templates ADD COLUMN template TEXT NOT NULL`)
    } catch (e) {
      console.log('[DB] Table migration skipped (columns may already exist)')
    }

    // 检查是否需要从localStorage迁移
    const migrated = await getMeta('migrated_from_localStorage')
    if (!migrated) {
      console.log('[DB] Running migration from localStorage')
      await migrateFromLocalStorage()
      await setMeta('migrated_from_localStorage', 'true')
    } else {
      console.log('[DB] Migration already completed')
    }

    return db
  } catch (error) {
    console.error('[DB] Error initializing database:', error)
    throw error
  }
}

async function migrateFromLocalStorage() {
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
}

export async function loadAllReports() {
  const database = await initDatabase()
  const rows = await database.select('SELECT * FROM reports ORDER BY id DESC')
  return rows.map(row => JSON.parse(row.data))
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
      'UPDATE reports SET data = $1, updated_at = $2 WHERE id = $3',
      [JSON.stringify(report), now, report.id]
    )
  } else {
    await database.execute(
      'INSERT INTO reports (id, data, created_at, updated_at) VALUES ($1, $2, $3, $4)',
      [report.id, JSON.stringify(report), now, now]
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
