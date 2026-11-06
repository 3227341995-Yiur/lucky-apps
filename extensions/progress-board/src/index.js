import ProgressBoard from './ProgressBoard.vue'

export default {
  name: 'progress-board',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerCanvas('ProgressBoard', ProgressBoard, {
      value: 'progress-board',
      icon: 'DataLine',
      description: '项目进度看板'
    })
  }
}
