/**
 * 日期工具（本地时区，与宿主 utils/date 保持一致）
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

/**
 * 区间是否与另一个区间重叠
 */
export function rangesOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2) return false
  return String(a[0]) <= String(b[1]) && String(a[1]) >= String(b[0])
}
