import { pluginApi } from '@/plugins/api'
import { cordis } from '@/plugins/cordis'

export const name = 'weekReport'
export const inject = ['database', 'theme']

export function apply(ctx) {
  ctx.provide('weekReport', pluginApi)
  ctx.provide('cordis', cordis)
  if (typeof window !== 'undefined') window.weekReport = pluginApi
}

export default { name, inject, apply }
