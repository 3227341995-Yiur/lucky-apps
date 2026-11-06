import MoneyCell from './MoneyCell.vue'
import MoneyCellSlot from './MoneyCell.cslot.vue'

export default {
  name: 'money-cell',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerColumn('MoneyCell', MoneyCell, {
      value: 'money-cell',
      description: '金额'
    })
    ctx.weekReport.components.registerColumnSlot('MoneyCell', MoneyCellSlot, {
      value: 'money-cell'
    })
  }
}
