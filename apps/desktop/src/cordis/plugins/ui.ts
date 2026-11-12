/**
 * 宿主 UI 服务：插件通过 ctx.ui 打开设置、跳转插件页、弹提示。
 * activeView 是 Vue ref，当前激活的插件页 id（null = 没有插件页）。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export const name = 'ui'

export function apply(ctx) {
  const activeView = ref(null)
  let handlers = {}

  ctx.provide('ui', {
    activeView,
    setActiveView(view) {
      activeView.value = view || null
    },
    bind(impl = {}) {
      handlers = { ...handlers, ...impl }
    },
    navigate(id) {
      return handlers.navigate?.(id) ?? false
    },
    openSettings() {
      return handlers.openSettings?.() ?? false
    },
    toast(message, type = 'info') {
      const fn = ElMessage[type]
      if (typeof fn === 'function') fn(message)
      else ElMessage(String(message))
    },
  })
}

export default { name, apply }
