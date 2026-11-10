import { definePlugin } from 'plugin-api'
import ReportsPage from './ReportsPage.vue'
import ReportsSidebar from './ReportsSidebar.vue'
import ReportsSettings from './ReportsSettings.vue'
import { createWeekReport } from './createReport'

export default definePlugin({
  name: 'reports',
  inject: ['navigation', 'settings', 'sidebar'],
  apply(ctx) {
    ctx.navigation.register({
      id: 'reports',
      label: '周报',
      icon: 'Document',
      order: 10,
      component: ReportsPage,
    })
    ctx.sidebar.registerRailAction({
      id: 'reports-create',
      order: 10,
      icon: 'Plus',
      title: '新建周报（Ctrl N）',
      onClick: () => createWeekReport(),
    })
    ctx.sidebar.registerPanel({
      id: 'reports',
      order: 10,
      component: ReportsSidebar,
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
