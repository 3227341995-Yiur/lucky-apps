import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/assets/css/index.css'

import { createApp } from 'vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import TrayMenu from '@/components/tray/TrayMenu.vue'

const app = createApp(TrayMenu)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#tray-menu')
