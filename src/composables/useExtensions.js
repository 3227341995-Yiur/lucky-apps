/**
 * 扩展资源管理：读取扫描结果、启停（下次启动生效）、复制资源路径
 */
import { computed } from 'vue'
import { extensionState } from '@/plugins/registry'
import {
  scanExtensionResources,
  reloadExtensionComponents,
  getResourcesPath,
  getPluginsPath,
  DISABLED_EXTENSIONS_KEY
} from '@/plugins/loader'
import { getSetting, setSetting } from '@/services/database'

const GROUP_LABELS = {
  style: '样式表',
  script: '插件脚本',
  'component-module': '外部组件包 (.js)'
}

const GROUP_HINTS = {
  style: '运行时注入的 CSS 文件',
  script: '按文件名排序加载的插件脚本',
  'component-module': 'Cordis 组件包，运行时注册组件与列插槽'
}

async function readDisabled() {
  const value = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  return new Set(Array.isArray(value) ? value : [])
}

async function writeDisabled(disabledSet) {
  await setSetting(DISABLED_EXTENSIONS_KEY, [...disabledSet])
}

async function toggleResource(id) {
  const resource = extensionState.resources.find(item => item.id === id)
  if (!resource) return null

  const disabled = await readDisabled()
  const nextEnabled = !resource.enabled
  if (nextEnabled) disabled.delete(id)
  else disabled.add(id)
  await writeDisabled(disabled)

  resource.enabled = nextEnabled
  resource.status = nextEnabled ? 'pending' : 'disabled'
  resource.error = ''
  return nextEnabled
}

async function rescan() {
  extensionState.loading = true
  try {
    return await scanExtensionResources()
  } finally {
    extensionState.loading = false
  }
}

async function hotReloadComponents() {
  extensionState.loading = true
  try {
    return await reloadExtensionComponents()
  } finally {
    extensionState.loading = false
  }
}

async function copyResourcesPath() {
  const path = await getResourcesPath()
  await navigator.clipboard.writeText(path)
  return path
}

async function copyPluginsPath() {
  const path = await getPluginsPath()
  await navigator.clipboard.writeText(path)
  return path
}

function reloadApp() {
  window.location.reload()
}

export function useExtensions() {
  const groups = computed(() => {
    const result = {
      style: [],
      script: [],
      'component-module': []
    }
    for (const resource of extensionState.resources) {
      if (resource.kind === 'component') result['component-module'].push(resource)
      else result[resource.kind]?.push(resource)
    }
    return result
  })

  const enabledCount = computed(() =>
    extensionState.resources.filter(item => item.enabled).length
  )

  const errorCount = computed(() =>
    extensionState.resources.filter(item => item.status === 'error').length
  )

  return {
    extensionState,
    groups,
    groupLabels: GROUP_LABELS,
    groupHints: GROUP_HINTS,
    enabledCount,
    errorCount,
    toggleResource,
    rescan,
    hotReloadComponents,
    copyResourcesPath,
    copyPluginsPath,
    reloadApp
  }
}

export default useExtensions
