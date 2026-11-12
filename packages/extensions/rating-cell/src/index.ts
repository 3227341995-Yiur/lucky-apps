import RatingCell from './RatingCell.vue'
import RatingCellSlot from './RatingCell.cslot.vue'

export default {
  name: '@lucky-apps/extension-rating-cell',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerColumn('RatingCell', RatingCell, {
      value: 'rating-cell',
      description: '评分',
    })
    ctx.components.registerColumnSlot('RatingCell', RatingCellSlot, {
      value: 'rating-cell',
    })
  },
}
