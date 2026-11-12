/**
 * 宿主系统设置：只属于宿主，存 localStorage，不依赖任何插件的数据库。
 */
const STORAGE_KEY = 'lucky-apps.settings'

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export async function getSetting(key, fallback = null) {
  const all = readAll()
  return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback
}

export async function setSetting(key, value) {
  const all = readAll()
  all[key] = value
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
