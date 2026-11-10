import { definePlugin } from 'plugin-api'
import ReportsPage from './ReportsPage.vue'
import ReportsSidebar from './ReportsSidebar.vue'
import ReportsSettings from './ReportsSettings.vue'
import ReportsOverlays from './ReportsOverlays.vue'
import { createWeekReport } from './createReport'

export default definePlugin({
  name: 'reports',
  inject: ['navigation', 'settings', 'sidebar', 'overlay'],
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
    ctx.overlay.register({
      id: 'reports',
      order: 10,
      component: ReportsOverlays,
    })
    ctx.settings.register({
      id: 'reports',
      label: '周报',
      icon: 'Document',
      order: 60,
      component: ReportsSettings,
    })
  },
})
