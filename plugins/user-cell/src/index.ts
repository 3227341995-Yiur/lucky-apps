import UserCell from './UserCell.vue'
import UserCellSlot from './UserCell.cslot.vue'
import { definePlugin, components } from '@week-report/plugin-api'

export default definePlugin({
  name: 'user-cell',
  apply() {
    components.registerColumn('UserCell', UserCell, {
      value: 'user-cell',
      description: '成员选择'
    })
    components.registerColumnSlot('UserCell', UserCellSlot, {
      value: 'user-cell'
    })
  }
})