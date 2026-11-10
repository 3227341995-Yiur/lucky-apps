/**
 * Handlebars 模板渲染器
 */
import Handlebars from 'handlebars'

/**
 * 渲染报告 - 直接使用报告数据
 * @param {object} report - 周报数据 { title, dateRange, sections }
 * @param {string} templateString - Handlebars 模板字符串
 * @returns {string} 渲染后的内容
 */
export function renderReport(report, templateString) {
  if (!templateString) return ''

  try {
    // 只去掉旧式模板注释行（# Markdown Template），保留正文的 # 标题
    const cleanTemplate = templateString.replace(/^#\s*(?:HTML|Markdown)\s+Template[^\n]*\n/i, '')
    const compiler = Handlebars.compile(cleanTemplate)
    return compiler(report)
  } catch (e) {
    console.error('Handlebars 渲染失败:', e)
    return `<div class="render-error">渲染错误: ${e.message}</div>`
  }
}
