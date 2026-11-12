import ProgressCell from './ProgressCell.vue'
import ProgressCellSlot from './ProgressCell.cslot.vue'

export default {
  name: '@lucky-apps/extension-progress-cell',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerColumn('ProgressCell', ProgressCell, {
      value: 'progress-cell',
      description: '进度条',
    })
    ctx.components.registerColumnSlot('ProgressCell', ProgressCellSlot, {
      value: 'progress-cell',
    })
  },
}
