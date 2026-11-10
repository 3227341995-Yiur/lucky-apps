import UserCell from './UserCell.vue'
import UserCellSlot from './UserCell.cslot.vue'
import { definePlugin } from 'plugin-api'

export default definePlugin({
  name: 'user-cell',
  apply(ctx) {
    ctx.components.registerColumn('UserCell', UserCell, {
      value: 'user-cell',
      description: '成员选择',
    })
    ctx.components.registerColumnSlot('UserCell', UserCellSlot, {
      value: 'user-cell',
    })
  },
})
