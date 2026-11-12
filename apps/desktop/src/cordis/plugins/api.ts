import { pluginApi } from '@/plugins/api'
import { cordis } from '@/plugins/cordis'

export const name = 'luckyApps'
export const inject = ['database', 'theme']

export function apply(ctx) {
  ctx.provide('luckyApps', pluginApi)
  ctx.provide('cordis', cordis)
}

export default { name, inject, apply }
