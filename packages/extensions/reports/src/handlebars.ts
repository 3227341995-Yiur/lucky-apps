/**
 * reports 插件只消费宿主唯一的 Handlebars 实例。
 *
 * 实例由宿主挂到 window.Handlebars；helper 由 resources/js/registerHelper.js
 * 统一注册。插件不打包、不注册第二份。
 */
export function getHandlebars(): any {
  const host = (globalThis as any).Handlebars
  if (!host) throw new Error('宿主 Handlebars 尚未就绪')
  return host.default || host
}
