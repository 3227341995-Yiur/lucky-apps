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

// ponytail: 宿主没有暴露设置读写 API，复制设置只能存在插件本地；
// 宿主复制周报仍读自己的 DB 设置，接入 settings API 后改回持久化到宿主。
const COPY_SETTINGS_KEY = 'template-designer:copy-settings'

export function getCopySettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(COPY_SETTINGS_KEY) || '{}')
    return {
      enabled: stored.enabled !== false,
      defaultType: typeof stored.defaultType === 'string' && stored.defaultType ? stored.defaultType : 'html'
    }
  } catch {
    return { enabled: true, defaultType: 'html' }
  }
}

export function saveCopySettings(patch = {}) {
  const next = { ...getCopySettings(), ...patch }
  try {
    localStorage.setItem(COPY_SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // localStorage 不可用时仅当前会话生效
  }
  return next
}
