import MoneyCell from './MoneyCell.vue'
import MoneyCellSlot from './MoneyCell.cslot.vue'
import { definePlugin, components } from '@week-report/plugin-api'

export default definePlugin({
  name: 'money-cell',
  apply() {
    components.registerColumn('MoneyCell', MoneyCell, {
      value: 'money-cell',
      description: '金额'
    })
    components.registerColumnSlot('MoneyCell', MoneyCellSlot, {
      value: 'money-cell'
    })
  }
})