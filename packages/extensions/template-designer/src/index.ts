import { definePlugin } from 'plugin-api'
import TemplateDesignerPage from './TemplateDesignerPage.vue'

export default definePlugin({
  name: 'template-designer',
  inject: ['navigation'],
  apply(ctx) {
    ctx.navigation.register({
      id: 'template-designer',
      label: '模板设计',
      icon: 'Document',
      order: 50,
      component: TemplateDesignerPage,
    })
  },
})
