import Handlebars from 'handlebars'

/**
 * reports 构建时把 handlebars 标为 external，指向宿主 window.Handlebars，
 * 全应用只有这一份实例；helper 由 resources/js/registerHelper.js 统一注册。
 */
export function getHandlebars(): typeof Handlebars {
  return Handlebars
}
