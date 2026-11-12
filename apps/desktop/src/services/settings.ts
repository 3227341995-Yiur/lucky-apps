/**
 * 宿主系统设置（meta 表）。
 *
 * 只属于宿主：扩展启停等设置由宿主读写，不依赖周报业务库。
 */
import { dbExecute, dbSelect } from '@/services/rpc'

let schemaReady = null

function ensureSchema() {
  schemaReady ||= dbExecute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    .catch((error) => {
      schemaReady = null
      throw error
    })
  return schemaReady
}

export async function getMeta(key) {
  await ensureSchema()
  const rows = await dbSelect('SELECT value FROM meta WHERE key = $1', [key])
  return rows.length > 0 ? rows[0].value : null
}

export async function setMeta(key, value) {
  await ensureSchema()
  await dbExecute(
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
