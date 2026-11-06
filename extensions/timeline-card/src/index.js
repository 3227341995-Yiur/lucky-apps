import TimelineCard from './TimelineCard.vue'

export default {
  name: 'timeline-card',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerCanvas('TimelineCard', TimelineCard, {
      value: 'timeline-card',
      icon: 'Clock',
      description: '节点时间线'
    })
  }
}
