import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from '@/App.vue'

export const name = 'app'
export const inject = ['extensions', 'weekReport', 'reports', 'theme']

export async function apply(ctx) {
  const app = createApp(App)
  app.use(ElementPlus)
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }
  app.provide('cordis', ctx)
  ctx.provide('vueApp', app)

  await ctx.extensions.install(app)
  app.mount('#app')
}

export default { name, inject, apply }
