import ProgressBoard from './ProgressBoard.vue'
import { definePlugin } from '@lucky-apps/plugin-api'

export default definePlugin({
  name: '@lucky-apps/extension-progress-board',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('ProgressBoard', ProgressBoard, {
      value: 'progress-board',
      icon: 'DataLine',
      description: '项目进度看板',
    })
  },
})
