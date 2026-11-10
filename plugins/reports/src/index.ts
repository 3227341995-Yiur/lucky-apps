import { definePlugin, navigation, settings } from '@week-report/plugin-api'
import ReportsPage from './ReportsPage.vue'
import ReportsSettings from './ReportsSettings.vue'

export default definePlugin({
  name: 'reports',
  apply() {
    navigation.register({
      id: 'reports',
      label: '周报',
      icon: 'Document',
      order: 10,
      component: ReportsPage
    })
    settings.register({
      id: 'reports-components',
      label: '周报组件',
      icon: 'Grid',
      order: 60,
      component: ReportsSettings
    })
  }
})
