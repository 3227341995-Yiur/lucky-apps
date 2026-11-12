import TimelineCard from './TimelineCard.vue'

export default {
  name: '@lucky-apps/extension-timeline-card',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('TimelineCard', TimelineCard, {
      value: 'timeline-card',
      icon: 'Clock',
      description: '节点时间线',
    })
  },
}
