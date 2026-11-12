import ReportsPage from './ReportEditor.vue'
import ReportsSidebar from './ReportsSidebar.vue'
import ReportsSettings from './ReportsSettings.vue'
import ReportsOverlays from './ReportsOverlays.vue'
import { createWeekReport } from './createReport'
import { weekReportApi } from './api'
import { ensureDatabase } from './database'
import { useReports } from './useReports'
import { openReportsDialog } from './dialogs'
import { setReportCtx } from './ctx'

export default {
  name: '@lucky-apps/extension-reports',
  inject: ['navigation', 'settings', 'sidebar', 'overlay', 'db', 'extensions', 'ui'],
  async apply(ctx) {
    setReportCtx(ctx)
    // 数据库/表结构归周报插件所有；插件未加载时宿主不保留周报数据层。
    await ensureDatabase()
    ctx.provide('weekReport', weekReportApi)

    // 资源目录里的经典脚本（如 search.js）不是 Cordis 插件，用这个桥接对象拿周报 API。
    // 由周报插件自己提供/回收，宿主不参与。
    ctx.effect(() => {
      window.weekReport = weekReportApi
      return () => {
        if (window.weekReport === weekReportApi) delete window.weekReport
      }
    })

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

    const onKeydown = (event) => {
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        createWeekReport()
      } else if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        openReportsDialog('template')
      } else if (ctrl && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        openReportsDialog('io')
      }
    }
    ctx.effect(() => {
      window.addEventListener('keydown', onKeydown)
      return () => window.removeEventListener('keydown', onKeydown)
    })

    useReports().init()
  },
}
