import RatingCell from './RatingCell.vue'
import RatingCellSlot from './RatingCell.cslot.vue'
import { definePlugin } from 'plugin-api'

export default definePlugin({
  name: 'rating-cell',
  apply(ctx) {
    ctx.components.registerColumn('RatingCell', RatingCell, {
      value: 'rating-cell',
      description: '评分',
    })
    ctx.components.registerColumnSlot('RatingCell', RatingCellSlot, {
      value: 'rating-cell',
    })
  },
})
