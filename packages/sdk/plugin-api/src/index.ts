/**
 * 周报外部组件 API。
 *
 * 外部组件项目直接从 npm 包 import，不再依赖 ctx.weekReport 或全局变量：
 *   import { definePlugin, components } from 'plugin-api'
 */
function resolveHost() {
  if (typeof globalThis === 'undefined') return null
  return globalThis.__WEEK_REPORT_HOST__
    || (typeof window !== 'undefined' ? window.weekReport : null)
    || null
}

export function useWeekReport() {
  return resolveHost()
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

export default { useWeekReport, definePlugin, components, navigation, settings, sidebar, branding, events, ui, commands }
