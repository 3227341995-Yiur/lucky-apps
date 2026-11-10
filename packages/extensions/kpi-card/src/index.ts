import KpiCard from './KpiCard.vue'
import { definePlugin } from 'plugin-api'

export default definePlugin({
  name: 'kpi-card',
  apply(ctx) {
    ctx.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡',
    })
  },
})
