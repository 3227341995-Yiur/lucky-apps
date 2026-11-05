/**
 * 扩展资源管理：读取扫描结果、启停（下次启动生效）、复制资源路径
 */
import { computed } from 'vue'
import { extensionState } from '@/plugins/registry'
import {
  scanExtensionResources,
  reloadExtensionComponents,
  getResourcesPath,
  DISABLED_EXTENSIONS_KEY
} from '@/plugins/loader'
import { getSetting, setSetting } from '@/services/database'

const GROUP_LABELS = {
  style: '样式表',
  script: '插件脚本',
  'component-vue': '列组件 (.vue)',
  'component-slot': '列属性插槽 (.cslot.vue)',
  'component-module': 'JS 组件模块 (.js)'
}

const GROUP_HINTS = {
  style: '运行时注入的 CSS 文件',
  script: '按文件名排序加载的插件脚本',
  'component-vue': '可在周报列中使用的外部编辑器组件',
  'component-slot': '与同名 .vue 配套，用于编辑列属性',
  'component-module': '默认导出 Vue 组件的 ES Module'
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

function reloadApp() {
  window.location.reload()
}

export function useExtensions() {
  const groups = computed(() => {
    const result = {
      style: [],
      script: [],
      'component-vue': [],
      'component-slot': [],
      'component-module': []
    }
    for (const resource of extensionState.resources) {
      if (resource.kind !== 'component') {
        result[resource.kind]?.push(resource)
        continue
      }
      if (resource.subtype === 'column-slot') result['component-slot'].push(resource)
      else if (resource.subtype === 'module') result['component-module'].push(resource)
      else result['component-vue'].push(resource)
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
    reloadApp
  }
}

export default useExtensions
