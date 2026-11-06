import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'vditor/dist/index.css'
import '@/assets/css/index.css'

import { ctx } from '@/cordis/context'
import plugins from '@/cordis/config'
import { initTheme } from '@/composables/useTheme'
import { startStartupLoader } from '@/startupLoader'

// 主题先于挂载生效，避免亮色闪烁
initTheme()
startStartupLoader()

try {
  // Cordis 按顺序加载：基础服务 → API → 状态 → 扩展 → Vue 应用
  for (const plugin of plugins) {
    await ctx.plugin(plugin)
  }
} finally {
  window.__startupLoader?.finish()
}
