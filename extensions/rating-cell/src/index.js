import RatingCell from './RatingCell.vue'
import RatingCellSlot from './RatingCell.cslot.vue'

export default {
  name: 'rating-cell',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerColumn('RatingCell', RatingCell, {
      value: 'rating-cell',
      description: '评分'
    })
    ctx.weekReport.components.registerColumnSlot('RatingCell', RatingCellSlot, {
      value: 'rating-cell'
    })
  }
}
