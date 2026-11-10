import TimelineCard from './TimelineCard.vue'
import { definePlugin } from 'plugin-api'

export default definePlugin({
  name: 'timeline-card',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('TimelineCard', TimelineCard, {
      value: 'timeline-card',
      icon: 'Clock',
      description: '节点时间线',
    })
  },
})
