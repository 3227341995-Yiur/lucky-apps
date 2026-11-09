/**
 * 宿主插件：Node 端 SQLite 服务。浏览器通过 /api/db/* RPC 调用。
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'week-report-database'

function dbPath() {
  if (process.env.WR_DB_PATH) return process.env.WR_DB_PATH
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(appData, 'com.lu.week-report', 'week_report.db')
}

export function apply(ctx) {
  const file = dbPath()
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

  // 前端沿用 Tauri SQL 的 $1/$2 占位符；node:sqlite 的位置参数用 ?，
  // 这里按占位符出现顺序展开成参数数组。
  const prepare = (sql, params) => {
    if (Array.isArray(params) && /\$\d+/.test(sql)) {
      const ordered = []
      const text = sql.replace(/\$(\d+)/g, (_match, index) => {
        ordered.push(params[Number(index) - 1])
        return '?'
      })
      return { sql: text, params: ordered }
    }
    if (Array.isArray(params)) return { sql, params }
    if (params && typeof params === 'object') return { sql, params }
    return { sql, params: [] }
  }

  ctx.provide('database', {
    select(sql, params = []) {
      const query = prepare(sql, params)
      try {
        return db.prepare(query.sql).all(...query.params)
      } catch (error) {
        console.error('[database] select failed:', query.sql, query.params, error.message)
        throw error
      }
    },
    execute(sql, params = []) {
      const query = prepare(sql, params)
      let result
      try {
        result = db.prepare(query.sql).run(...query.params)
      } catch (error) {
        console.error('[database] execute failed:', query.sql, query.params, error.message)
        throw error
      }
      return {
        rowsAffected: Number(result.changes ?? 0),
        lastInsertId: Number(result.lastInsertRowid ?? 0)
      }
    }
  })

  ctx.on('dispose', () => db.close())
}

export default { name, apply }
