import ProgressCell from './ProgressCell.vue'
import ProgressCellSlot from './ProgressCell.cslot.vue'
import { definePlugin, components } from 'plugin-api'

export default definePlugin({
  name: 'progress-cell',
  apply() {
    components.registerColumn('ProgressCell', ProgressCell, {
      value: 'progress-cell',
      description: '进度条',
    })
    components.registerColumnSlot('ProgressCell', ProgressCellSlot, {
      value: 'progress-cell',
    })
  },
})
