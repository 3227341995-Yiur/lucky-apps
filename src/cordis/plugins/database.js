import * as database from '@/services/database'

export const name = 'database'

export function apply(ctx) {
  ctx.provide('database', database)
}

export default { name, apply }
