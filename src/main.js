import '@/assets/css/index.css'
import 'element-plus/dist/index.css'
import 'vditor/dist/index.css'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Components from '@/components'
import DynamicComponentService from '@/services/modal'
import Contextmenu from '@/directives/contextmenu'
import HorizontalScroll from '@/directives/horizontal-scroll'

import App from '@/App.vue'

import { createApp } from 'vue'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(Components)
app.use(DynamicComponentService)
app.directive('Contextmenu', Contextmenu)
app.directive('HorizontalScroll', HorizontalScroll)
app.mount('#app')
