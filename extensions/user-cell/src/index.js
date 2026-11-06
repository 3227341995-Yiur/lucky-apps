import UserCell from './UserCell.vue'
import UserCellSlot from './UserCell.cslot.vue'

export default {
  name: 'user-cell',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerColumn('UserCell', UserCell, {
      value: 'user-cell',
      description: '成员选择'
    })
    ctx.weekReport.components.registerColumnSlot('UserCell', UserCellSlot, {
      value: 'user-cell'
    })
  }
}
