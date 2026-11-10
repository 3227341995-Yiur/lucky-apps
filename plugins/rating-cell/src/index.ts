import RatingCell from './RatingCell.vue'
import RatingCellSlot from './RatingCell.cslot.vue'
import { definePlugin, components } from 'plugin-api'

export default definePlugin({
  name: 'rating-cell',
  apply() {
    components.registerColumn('RatingCell', RatingCell, {
      value: 'rating-cell',
      description: '评分',
    })
    components.registerColumnSlot('RatingCell', RatingCellSlot, {
      value: 'rating-cell',
    })
  },
})
