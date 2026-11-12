import KpiCard from './KpiCard.vue'

export default {
  name: '@lucky-apps/extension-kpi-card',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡',
    })
  },
}
