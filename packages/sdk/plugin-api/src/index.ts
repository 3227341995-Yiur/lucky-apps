/**
 * 周报外部组件 API。
 *
 * 外部组件项目直接从 npm 包 import，不再依赖 ctx.weekReport 或全局变量：
 *   import { definePlugin, components } from '@lucky-apps/plugin-api'
 */
// client bundle 通过 require('@lucky-apps/plugin-api') 拿到宿主静态模块，
// 宿主在 installModuleRegistry 时把实现绑定进来；不使用 window 全局。
let boundHost = null

export function setHost(value) {
  boundHost = value
}

/** 宿主能力入口；周报业务 API 由周报插件自己提供，不在这里。 */
export function useHost() {
  return boundHost
}

/** @deprecated 旧名，等价 useHost。 */
export const useWeekReport = useHost

function resolveHost() {
  return boundHost
}

export function definePlugin(plugin) {
  return plugin
}

function requireHost() {
  const host = resolveHost()
  if (!host) throw new Error('[lucky-apps] 宿主 API 尚未就绪')
  return host
}

export const components = {
  register(name, component, meta) {
    return requireHost().components.register(name, component, meta)
  },
  registerColumn(name, component, meta) {
    return requireHost().components.registerColumn(name, component, meta)
  },
  registerCanvas(name, component, meta) {
    return requireHost().components.registerCanvas(name, component, meta)
  },
  registerColumnSlot(name, component, meta) {
    return requireHost().components.registerColumnSlot(name, component, meta)
  },
  list() {
    return requireHost().components.list()
  },
  listColumns() {
    return requireHost().components.listColumns()
  },
  listCanvas() {
    return requireHost().components.listCanvas()
  },
  has(name) {
    return requireHost().components.has(name)
  },
}

export const branding = {
  get() {
    return requireHost().branding.get()
  },
  set(patch) {
    return requireHost().branding.set(patch)
  },
  onChange(handler) {
    return requireHost().branding.onChange(handler)
  },
}

export const navigation = {
  register(item) {
    return requireHost().navigation.register(item)
  },
  list() {
    return requireHost().navigation.list()
  },
  open(id) {
    return requireHost().navigation.open(id)
  },
}

export const overlay = {
  register(item) {
    return requireHost().overlay.register(item)
  },
  list() {
    return requireHost().overlay.list()
  },
}

export const sidebar = {
  registerPanel(item) {
    return requireHost().sidebar.registerPanel(item)
  },
  list() {
    return requireHost().sidebar.list()
  },
  registerRailAction(item) {
    return requireHost().sidebar.registerRailAction(item)
  },
  listRailActions() {
    return requireHost().sidebar.listRailActions()
  },
}

export const settings = {
  register(item) {
    return requireHost().settings.register(item)
  },
  list() {
    return requireHost().settings.list()
  },
}

export const events = {
  on(name, handler) {
    return requireHost().events.on(name, handler)
  },
  once(name, handler) {
    return requireHost().events.once(name, handler)
  },
  off(name, handler) {
    return requireHost().events.off(name, handler)
  },
}

export const ui = {
  toast(message, type) {
    return requireHost().ui.toast(message, type)
  },
  selectReport(id) {
    return requireHost().ui.selectReport(id)
  },
  isReportsVisible() {
    return requireHost().ui.isReportsVisible()
  },
  openSettings() {
    return requireHost().ui.openSettings()
  },
  openImportExport() {
    return requireHost().ui.openImportExport()
  },
  openDesigner() {
    return requireHost().ui.openDesigner()
  },
  openTemplates() {
    return requireHost().ui.openTemplates()
  },
}

export const commands = {
  register(id, handler, meta) {
    return requireHost().commands.register(id, handler, meta)
  },
  run(id, ...args) {
    return requireHost().commands.run(id, ...args)
  },
  list() {
    return requireHost().commands.list()
  },
}

export default { useHost, useWeekReport, definePlugin, components, navigation, settings, sidebar, overlay, branding, events, ui, commands }
