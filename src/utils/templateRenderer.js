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
    // 去掉模板开头的注释行（# xxx Template）
    const cleanTemplate = templateString.replace(/^#.*\n/, '')
    const compiler = Handlebars.compile(cleanTemplate)
    return compiler(report)
  } catch (e) {
    console.error('Handlebars 渲染失败:', e)
    return `<div class="render-error">渲染错误: ${e.message}</div>`
  }
}

/**
 * 渲染 HTML 格式报告
 */
export function renderHtml(report, templateString) {
  return renderReport(report, templateString)
}

/**
 * 渲染 Markdown 格式报告
 */
export function renderMarkdown(report, templateString) {
  return renderReport(report, templateString)
}

export default {
  renderReport,
  renderHtml,
  renderMarkdown
}