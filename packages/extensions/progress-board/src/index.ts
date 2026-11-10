import ProgressBoard from './ProgressBoard.vue'
import { definePlugin } from 'plugin-api'

export default definePlugin({
  name: 'progress-board',
  apply(ctx) {
    ctx.components.registerCanvas('ProgressBoard', ProgressBoard, {
      value: 'progress-board',
      icon: 'DataLine',
      description: '项目进度看板',
    })
  },
})
