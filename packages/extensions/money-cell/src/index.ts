import MoneyCell from './MoneyCell.vue'
import MoneyCellSlot from './MoneyCell.cslot.vue'
import { definePlugin } from '@lucky-apps/plugin-api'

export default definePlugin({
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
})
