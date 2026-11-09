import ProgressBoard from './ProgressBoard.vue'
import { definePlugin, components } from '@week-report/plugin-api'

export default definePlugin({
  name: 'progress-board',
  apply() {
    components.registerCanvas('ProgressBoard', ProgressBoard, {
      value: 'progress-board',
      icon: 'DataLine',
      description: '项目进度看板'
    })
  }
})