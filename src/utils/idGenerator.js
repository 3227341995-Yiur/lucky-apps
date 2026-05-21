/**
 * 统一 ID 生成工具 - 生成纯数字
 */

/**
 * 生成唯一 ID (纯数字)
 * @returns {number}
 */
export function generateId() {
  return Date.now()
}

/**
 * 生成数字 ID（用于数据库主键）
 * @returns {number}
 */
export function generateNumericId() {
  return Date.now()
}