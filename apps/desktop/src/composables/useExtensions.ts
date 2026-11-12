/**
 * 扩展资源管理：读取扫描结果、启停（下次启动生效）、复制资源路径
 */
import { computed } from 'vue'
import { extensionState } from '@/plugins/registry'
import {
  scanExtensionResources,
  reloadExtensionComponents,
  syncExtensionResource,
  getResourcesPath,
  getPluginsPath,
  DISABLED_EXTENSIONS_KEY,
} from '@/plugins/loader'
import { getSetting, setSetting } from '@/services/settings'

const GROUP_LABELS = {
  style: '样式表',
  script: '插件脚本',
  'component-canvas': '画布组件',
  'component-column': '列组件',
  'component-feature': '功能组件',
  'component-other': '其他组件',
}

const GROUP_HINTS = {
  style: '运行时注入的 CSS 文件',
  script: '按文件名排序加载的插件脚本；启停会重新加载界面',
  'component-canvas': '拖入自由画布的组件',
  'component-column': '表格单元格 / 列编辑组件',
  'component-feature': '侧边栏入口、页面与后台功能',
  'component-other': '未声明 la.kind 的组件包',
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
  // Cordis 生命周期直接挂载/卸载，不再要求用户重启应用。
  await syncExtensionResource(resource, nextEnabled)
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
      'component-canvas': [],
      'component-column': [],
      'component-feature': [],
      'component-other': [],
    }
    for (const resource of extensionState.resources) {
      if (resource.kind === 'component') {
        const key = `component-${resource.componentKind || 'other'}`
        ;(result[key] || result['component-other']).push(resource)
      } else if (result[resource.kind]) {
        result[resource.kind].push(resource)
      }
    }
    return result
  })

  const enabledCount = computed(() =>
    extensionState.resources.filter(item => item.enabled).length,
  )

  const errorCount = computed(() =>
    extensionState.resources.filter(item => item.status === 'error').length,
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
    reloadApp,
  }
}

export default useExtensions
