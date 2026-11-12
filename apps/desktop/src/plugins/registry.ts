/**
 * 扩展注册中心
 *
 * - 组件目录：内置列组件 + 外部 .vue 组件 + 插件运行时注册的组件
 * - 扩展资源：resources/css、resources/js、cordis.yml 插件 profile 的加载状态
 *
 * 组件实例不能放进 reactive（会被 Proxy 包装），这里用普通 Map + catalog 数组。
 */
import { markRaw, reactive, ref, shallowRef } from 'vue'
import { toKebabCase, toPascalCase } from '@/plugins/naming'

export const extensionState = reactive({
  resources: [],
  loading: false,
  ready: false,
  watcher: 'idle',
  watcherError: '',
  errors: [],
})

export const componentCatalog = ref([])
export const navItemCatalog = ref([])
const navItemMap = new Map()
export const settingsSectionCatalog = ref([])
const settingsSectionMap = new Map()
// 外部组件热更新版本号：渲染层用它强制重新解析动态组件
export const extensionVersion = ref(0)

const componentMap = new Map()
let appRef = null

export function setPluginApp(app) {
  appRef = app
}

export function registerComponent(name, component, meta = {}) {
  const pascalName = toPascalCase(name)
  if (!pascalName) throw new Error('[registry] 组件名不能为空')

  componentMap.set(pascalName, component)
  appRef?.component(pascalName, component)

  const entry = {
    name: pascalName,
    value: meta.value || toKebabCase(pascalName),
    component,
    source: meta.source || 'builtin',
    scope: meta.scope === 'canvas' ? 'canvas' : 'column',
    description: meta.description || '',
    icon: meta.icon || '',
    iconSvg: meta.iconSvg || '',
  }
  const index = componentCatalog.value.findIndex(item => item.name === pascalName)
  if (index === -1) componentCatalog.value = [...componentCatalog.value, entry]
  else {
    const next = [...componentCatalog.value]
    next[index] = entry
    componentCatalog.value = next
  }
  return entry
}

export function registerColumnSlot(componentName, component, meta = {}) {
  const slotName = `${toPascalCase(componentName)}ColumnModifySlot`
  registerComponent(slotName, component, {
    ...meta,
    value: `${toKebabCase(toPascalCase(componentName))}-column-modify-slot`,
  })
  return slotName
}

/** 只移除注册时那一项，避免同名项被后来者覆盖后被误删。 */
export function unregisterComponent(name, entry) {
  const pascalName = toPascalCase(name)
  const index = componentCatalog.value.findIndex(item => item.name === pascalName)
  if (index === -1) return
  if (entry && componentCatalog.value[index] !== entry) return
  componentCatalog.value = componentCatalog.value.filter(item => item.name !== pascalName)
  componentMap.delete(pascalName)
}

export function unregisterColumnSlot(componentName, entry) {
  unregisterComponent(`${toPascalCase(componentName)}ColumnModifySlot`, entry)
}

export function getComponent(name) {
  return componentMap.get(toPascalCase(name))
}

export function hasComponent(name) {
  return componentMap.has(toPascalCase(name))
}

export function hasColumnSlot(name) {
  return componentMap.has(`${toPascalCase(name)}ColumnModifySlot`)
}

export function listComponents() {
  return componentCatalog.value
}

export function listColumnComponents() {
  return componentCatalog.value.filter(item => (
    item.scope === 'column' && !item.name.endsWith('ColumnModifySlot')
  ))
}

export function listCanvasComponents() {
  return componentCatalog.value.filter(item => (
    item.scope === 'canvas' && !item.name.endsWith('ColumnModifySlot')
  ))
}

// ============================================================
// 侧栏面板：周报插件自己维护左栏（新建入口 + 周报列表）
// ============================================================
const sidebarPanelCatalog = shallowRef([])

export function unregisterSidebarPanel(id, entry) {
  const index = sidebarPanelCatalog.value.findIndex(existing => existing.id === id)
  if (index === -1) return
  if (entry && sidebarPanelCatalog.value[index] !== entry) return
  sidebarPanelCatalog.value = sidebarPanelCatalog.value.filter(existing => existing.id !== id)
}

export function registerSidebarPanel(item = {}) {
  if (!item.id || !item.component) throw new Error('[registry] 侧栏面板需要 id 与 component')
  const entry = {
    id: item.id,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
    component: item.component,
  }
  const index = sidebarPanelCatalog.value.findIndex(existing => existing.id === entry.id)
  sidebarPanelCatalog.value = index === -1
    ? [...sidebarPanelCatalog.value, entry]
    : sidebarPanelCatalog.value.map(existing => (existing.id === entry.id ? entry : existing))
  return entry
}

const railActionCatalog = shallowRef([])

export function unregisterRailAction(id, entry) {
  const index = railActionCatalog.value.findIndex(existing => existing.id === id)
  if (index === -1) return
  if (entry && railActionCatalog.value[index] !== entry) return
  railActionCatalog.value = railActionCatalog.value.filter(existing => existing.id !== id)
}

export function registerRailAction(item = {}) {
  if (!item.id || typeof item.onClick !== 'function') {
    throw new Error('[registry] rail 动作需要 id 与 onClick')
  }
  const entry = {
    id: item.id,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
    icon: item.icon || 'Plus',
    title: item.title || '',
    onClick: item.onClick,
  }
  const index = railActionCatalog.value.findIndex(existing => existing.id === entry.id)
  railActionCatalog.value = index === -1
    ? [...railActionCatalog.value, entry]
    : railActionCatalog.value.map(existing => (existing.id === entry.id ? entry : existing))
  return entry
}

const overlayCatalog = shallowRef([])

export function unregisterOverlay(id, entry) {
  const index = overlayCatalog.value.findIndex(existing => existing.id === id)
  if (index === -1) return
  if (entry && overlayCatalog.value[index] !== entry) return
  overlayCatalog.value = overlayCatalog.value.filter(existing => existing.id !== id)
}

export function registerOverlay(item = {}) {
  if (!item.id || !item.component) throw new Error('[registry] overlay 需要 id 与 component')
  const entry = {
    id: item.id,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
    component: item.component,
  }
  const index = overlayCatalog.value.findIndex(existing => existing.id === entry.id)
  overlayCatalog.value = index === -1
    ? [...overlayCatalog.value, entry]
    : overlayCatalog.value.map(existing => (existing.id === entry.id ? entry : existing))
  return entry
}

export function listOverlays() {
  return [...overlayCatalog.value].sort((a, b) => a.order - b.order)
}

export function listRailActions() {
  return [...railActionCatalog.value].sort((a, b) => a.order - b.order)
}

export function listSidebarPanels() {
  return [...sidebarPanelCatalog.value].sort((a, b) => a.order - b.order)
}

export function registerNavItem(item) {
  if (!item?.id || !item?.label || (!item?.component && !item?.hostView)) {
    throw new Error('[registry] 导航项需要 id、label 与 component 或 hostView')
  }
  if (item.component) navItemMap.set(item.id, item.component)
  const entry = {
    id: item.id,
    label: item.label,
    // hostView：宿主内置视图（如周报编辑器），插件不提供组件
    hostView: item.hostView || '',
    icon: item.icon || 'Grid',
    iconSvg: item.iconSvg || '',
    // 组件图标可以被外部插件用来渲染徽标、动态状态等
    iconComponent: item.iconComponent ? markRaw(item.iconComponent) : null,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
  }
  const index = navItemCatalog.value.findIndex(existing => existing.id === item.id)
  if (index === -1) navItemCatalog.value = [...navItemCatalog.value, entry]
  else {
    const next = [...navItemCatalog.value]
    next[index] = entry
    navItemCatalog.value = next
  }
  return entry
}

export function unregisterNavItem(id, entry) {
  const index = navItemCatalog.value.findIndex(existing => existing.id === id)
  if (index === -1) return
  if (entry && navItemCatalog.value[index] !== entry) return
  navItemCatalog.value = navItemCatalog.value.filter(existing => existing.id !== id)
  navItemMap.delete(id)
}

export function listNavItems() {
  return [...navItemCatalog.value].sort((a, b) => a.order - b.order)
}

export function getNavItemComponent(id) {
  return navItemMap.get(id) || null
}

export function registerSettingsSection(item) {
  if (!item?.id || !item?.label || !item?.component) {
    throw new Error('[registry] 设置面板需要 id、label、component')
  }
  settingsSectionMap.set(item.id, item.component)
  const entry = {
    id: item.id,
    label: item.label,
    icon: item.icon || 'Setting',
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
  }
  const index = settingsSectionCatalog.value.findIndex(existing => existing.id === item.id)
  if (index === -1) settingsSectionCatalog.value = [...settingsSectionCatalog.value, entry]
  else {
    const next = [...settingsSectionCatalog.value]
    next[index] = entry
    settingsSectionCatalog.value = next
  }
  return entry
}

export function unregisterSettingsSection(id, entry) {
  const index = settingsSectionCatalog.value.findIndex(existing => existing.id === id)
  if (index === -1) return
  if (entry && settingsSectionCatalog.value[index] !== entry) return
  settingsSectionCatalog.value = settingsSectionCatalog.value.filter(existing => existing.id !== id)
  settingsSectionMap.delete(id)
}

export function listSettingsSections() {
  return [...settingsSectionCatalog.value].sort((a, b) => a.order - b.order)
}

export function getSettingsSectionComponent(id) {
  return settingsSectionMap.get(id) || null
}

// ============================================================
// 扩展资源状态
// ============================================================
export function setExtensionResources(resources) {
  extensionState.resources = resources
}

export function updateExtensionResource(id, patch) {
  const resource = extensionState.resources.find(item => item.id === id)
  if (!resource) return
  Object.assign(resource, patch)
}

export function addExtensionError(message) {
  extensionState.errors = [...extensionState.errors, message]
  console.error('[extensions]', message)
}

export function markExtensionsReady() {
  extensionState.ready = true
  extensionState.loading = false
}

export function markExtensionsChanged() {
  extensionVersion.value += 1
}
