/**
 * 日期工具 - 统一使用本地时区，避免依赖 moment
 */

export function toDate(value) {
  if (value instanceof Date) return value
  if (value == null || value === '') return new Date(NaN)
  return new Date(value)
}

export function formatDate(value = new Date()) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(value = new Date()) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${formatDate(date)} ${hh}:${mm}`
}

/**
 * 本周范围（周一 ~ 周日）
 * @returns {[string, string]} ['YYYY-MM-DD', 'YYYY-MM-DD']
 */
export function getWeekRange(base = new Date()) {
  const today = toDate(base)
  const dayOfWeek = today.getDay()
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + offsetToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return [formatDate(monday), formatDate(sunday)]
}

/**
 * 日期是否落在 dateRange 内（区间都按字符串比较，兼容 YYYY-MM-DD）
 */
export function isDateInRange(date, range) {
  if (!Array.isArray(range) || range.length !== 2) return false
  const target = typeof date === 'string' ? date.slice(0, 10) : formatDate(date)
  return target >= String(range[0]).slice(0, 10) && target <= String(range[1]).slice(0, 10)
}

/**
 * 区间是否与另一个区间重叠
 */
export function rangesOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2) return false
  return String(a[0]) <= String(b[1]) && String(a[1]) >= String(b[0])
}

/**
 * ISO 周序号（用于侧栏周徽标）
 */
export function getIsoWeek(value = new Date()) {
  const target = toDate(value)
  if (Number.isNaN(target.getTime())) return ''
  const date = new Date(Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}
