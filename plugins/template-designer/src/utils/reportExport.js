/**
 * 模板设计器用到的导出/复制相关工具
 */

/**
 * 格式化日期范围显示
 * @param {string|string[]} dateRange
 * @returns {string}
 */
export function formatDateRange(dateRange) {
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return dateRange.join(' ~ ')
  }
  return dateRange
}
