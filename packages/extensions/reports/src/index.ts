import { definePlugin } from 'plugin-api'
import ReportsPage from './ReportsPage.vue'
import ReportsSettings from './ReportsSettings.vue'

export default definePlugin({
  name: 'reports',
  apply(ctx) {
    ctx.navigation.register({
      id: 'reports',
      label: '周报',
      icon: 'Document',
      order: 10,
      component: ReportsPage,
    })
    ctx.settings.register({
      id: 'reports-components',
      label: '周报组件',
      icon: 'Grid',
      order: 60,
      component: ReportsSettings,
    })
  },
})
