import MoneyCell from './MoneyCell.vue'
import MoneyCellSlot from './MoneyCell.cslot.vue'

export default {
  name: '@lucky-apps/extension-money-cell',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerColumn('MoneyCell', MoneyCell, {
      value: 'money-cell',
      description: '金额',
    })
    ctx.components.registerColumnSlot('MoneyCell', MoneyCellSlot, {
      value: 'money-cell',
    })
  },
}
