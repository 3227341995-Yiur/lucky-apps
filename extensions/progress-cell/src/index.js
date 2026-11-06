import ProgressCell from './ProgressCell.vue'
import ProgressCellSlot from './ProgressCell.cslot.vue'

export default {
  name: 'progress-cell',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerColumn('ProgressCell', ProgressCell, {
      value: 'progress-cell',
      description: '进度条'
    })
    ctx.weekReport.components.registerColumnSlot('ProgressCell', ProgressCellSlot, {
      value: 'progress-cell'
    })
  }
}
