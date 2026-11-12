import { useTheme } from '@/composables/useTheme'
import { events } from '@/utils/eventBus'

export const name = 'theme'

export function apply(ctx) {
  const theme = useTheme()
  ctx.provide('theme', {
    modes: theme.modes,
    labels: theme.labels,
    get: () => ({ mode: theme.themeMode.value, resolved: theme.resolvedTheme.value }),
    set: mode => theme.setTheme(mode),
    cycle: theme.cycleTheme,
    onChange: fn => events.on('theme:changed', fn),
  })
}

export default { name, apply }
