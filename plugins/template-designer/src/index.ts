import { definePlugin, navigation } from '@week-report/plugin-api'
import TemplateDesignerPage from './TemplateDesignerPage.vue'

export default definePlugin({
  name: 'template-designer',
  apply() {
    navigation.register({
      id: 'template-designer',
      label: '模板设计',
      icon: 'Document',
      order: 50,
      component: TemplateDesignerPage
    })
  }
})
