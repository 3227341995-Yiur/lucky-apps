/**
 * Cordis 插件清单
 * 顺序即启动顺序：基础服务 → 扩展 → Vue 应用。
 */
import theme from './plugins/theme'
import branding from './plugins/branding'
import ui from './plugins/ui'
import db from './plugins/db'
import commands from './plugins/commands'
import registry from './plugins/registry'
import extensions from './plugins/extensions'
import app from './plugins/app'

export default [
  theme,
  branding,
  ui,
  db,
  commands,
  registry,
  extensions,
  app,
]
