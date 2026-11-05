import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'vditor/dist/index.css'
import '@/assets/css/index.css'

import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createApp } from 'vue'

import App from '@/App.vue'
import { initTheme } from '@/composables/useTheme'
import { installExtensions } from '@/plugins'
import { pluginApi } from '@/plugins/api'

// 主题先于挂载生效，避免亮色闪烁
initTheme()

// 插件入口必须在扩展脚本加载之前挂载
window.weekReport = pluginApi

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)

app.config.errorHandler = (error, instance, info) => {
  console.error('[app] 未捕获错误:', error, info)
}

// app.use 不会等待 async install，这里显式 await，保证外部资源就绪后再挂载
await installExtensions(app)

app.mount('#app')
