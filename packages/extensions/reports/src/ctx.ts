/**
 * 周报插件自己的 Cordis Context。
 * apply(ctx) 时绑定；业务模块用它发事件、取宿主服务。
 */
let current = null

export function setReportCtx(ctx) {
  current = ctx
}

export function reportCtx() {
  if (!current) throw new Error('[reports] Cordis context 尚未绑定')
  return current
}
