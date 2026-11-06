import KpiCard from './KpiCard.vue'

export default {
  name: 'kpi-card',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡'
    })
  }
}
