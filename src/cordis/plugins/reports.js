import { useReports } from '@/composables/useReports'

export const name = 'reports'

export function apply(ctx) {
  ctx.provide('reports', useReports())
}

export default { name, apply }
