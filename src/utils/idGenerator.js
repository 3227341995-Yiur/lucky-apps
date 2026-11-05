/**
 * 统一 ID 生成工具 - 生成纯数字（SQLite INTEGER 主键）
 *
 * Date.now() 毫秒级在同一毫秒内会重复，这里追加 3 位序号扩大取值空间；
 * 结果仍在 Number 安全整数范围内（约 1.7e15 < 9e15）。
 */
let sequence = 0

export function generateId() {
  sequence = (sequence + 1) % 1000
  return Date.now() * 1000 + sequence
}

// 兼容旧调用名
export const generateNumericId = generateId

export default generateId
