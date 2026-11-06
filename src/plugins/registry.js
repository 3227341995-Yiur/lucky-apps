/**
 * 扩展注册中心
 *
 * - 组件目录：内置列组件 + 外部 .vue 组件 + 插件运行时注册的组件
 * - 扩展资源：resources/css、resources/js、cordis.yml 插件 profile 的加载状态
 *
 * 组件实例不能放进 reactive（会被 Proxy 包装），这里用普通 Map + catalog 数组。
 */
import { reactive, ref } from 'vue'
import { toKebabCase, toPascalCase } from '@/plugins/naming'

export const extensionState = reactive({
  resources: [],
  loading: false,
  ready: false,
  watcher: 'idle',
  watcherError: '',
  errors: []
})

export const componentCatalog = ref([])
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
    iconSvg: meta.iconSvg || ''
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
    value: `${toKebabCase(toPascalCase(componentName))}-column-modify-slot`
  })
  return slotName
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
