/**
 * Cordis 插件清单
 * 顺序即启动顺序：基础服务 → API → 状态 → 扩展 → Vue 应用。
 */
import theme from './plugins/theme'
import registry from './plugins/registry'
import api from './plugins/api'
import extensions from './plugins/extensions'
import app from './plugins/app'

export default [
  theme,
  registry,
  api,
  extensions,
  app,
]
