import UserCell from './UserCell.vue'
import UserCellSlot from './UserCell.cslot.vue'

export default {
  name: '@lucky-apps/extension-user-cell',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerColumn('UserCell', UserCell, {
      value: 'user-cell',
      description: '成员选择',
    })
    ctx.components.registerColumnSlot('UserCell', UserCellSlot, {
      value: 'user-cell',
    })
  },
}
