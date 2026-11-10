import TimelineCard from './TimelineCard.vue'
import { definePlugin, components } from 'plugin-api'

export default definePlugin({
  name: 'timeline-card',
  apply() {
    components.registerCanvas('TimelineCard', TimelineCard, {
      value: 'timeline-card',
      icon: 'Clock',
      description: '节点时间线',
    })
  },
})
