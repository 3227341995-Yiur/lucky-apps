/**
 * 执行周报里的 JS 表达式。兼容 {{ report.title }} 写法和多行脚本。
 */
export function evaluateJsExpression(expression, report, fallback = '') {
  let code = String(expression || '').trim()
  if (!code) return fallback
  const wrapped = /^\{\{([\s\S]*)\}\}$/.exec(code)
  if (wrapped) code = wrapped[1].trim()
  const moment = typeof window !== 'undefined' ? window.moment : undefined
  try {
    let result
    try {
      result = new Function('report', 'moment', `"use strict"; return (${code});`)(report, moment)
    } catch {
      result = new Function('report', 'moment', `"use strict";\n${code}`)(report, moment)
    }
    if (result === undefined || result === null || result === '') return fallback
    return String(result)
  } catch (error) {
    console.warn('[expression] 执行失败:', code, error)
    return fallback
  }
}

export default evaluateJsExpression
