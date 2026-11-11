import Handlebars from 'handlebars'

/**
 * reports 插件只消费宿主唯一的 Handlebars 实例。
 *
 * 构建时 handlebars 标为 external，由 client module loader 注入；
 * helper 由 resources/js/registerHelper.js 统一注册。插件不打包、不注册第二份。
 */
export function getHandlebars(): typeof Handlebars {
  return Handlebars
}
