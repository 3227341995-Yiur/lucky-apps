import { definePlugin } from 'plugin-api'
import ImportExportPage from './ImportExportPage.vue'

export default definePlugin({
  name: 'data-io',
  apply(ctx) {
    ctx.navigation.register({
      id: 'data-io',
      label: '导入导出',
      icon: 'Sort',
      order: 40,
      component: ImportExportPage,
    })
  },
})
