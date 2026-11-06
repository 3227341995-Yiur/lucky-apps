import { useTheme } from '@/composables/useTheme'

export const name = 'theme'

export function apply(ctx) {
  ctx.provide('theme', useTheme())
}

export default { name, apply }
