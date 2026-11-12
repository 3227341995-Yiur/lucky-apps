/**
 * 品牌服务：插件通过 ctx.branding 读写程序名称/图标。
 */
import { branding, setBranding } from '@/composables/useBranding'

export const name = 'branding'

export function apply(ctx) {
  ctx.provide('branding', {
    get: () => ({ ...branding }),
    set(patch) {
      const next = setBranding(patch)
      ctx.emit('branding/changed', next)
      return next
    },
  })
}

export default { name, apply }
