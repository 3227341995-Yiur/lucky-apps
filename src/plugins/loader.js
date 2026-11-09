/**
 * 浏览器侧扩展入口。
 *
 * profile / bundle / patch 组合和真实 Cordis loader 都在 Node 服务里完成；
 * 浏览器只读取 /api/boot 清单，注入样式/脚本并加载 client bundle。
 */
import { apiGet, apiPost } from '@/services/rpc'
import {
  setExtensionResources,
  updateExtensionResource,
  addExtensionError,
  markExtensionsChanged,
  extensionState
} from '@/plugins/registry'
import { mountCordisPlugin, mountCordisPluginObject, unmountCordisPlugins } from '@/plugins/cordis'
import { getSetting } from '@/services/database'
import { emit } from '@/utils/eventBus'

export const DISABLED_EXTENSIONS_KEY = 'extensions.disabled'

const loadedStyles = new Set()
const loadedScripts = new Set()
let bootState = { modules: [], resources: [], paths: {} }
let pollTimer = null
let lastBootKey = ''

export function ensureExternalPluginDir() {
  return Promise.resolve()
}

function injectStyle(url) {
  return new Promise(resolve => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve(link)
    link.onerror = () => resolve(null)
    document.head.appendChild(link)
  })
}

function injectScript(url) {
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => resolve(script)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

function applyBoot(payload) {
  bootState = {
    modules: Array.isArray(payload?.modules) ? payload.modules : [],
    resources: Array.isArray(payload?.resources) ? payload.resources : [],
    paths: payload?.paths || {},
    profile: payload?.profile || null
  }
  extensionState.profile = bootState.profile || { bundles: [], rows: 0 }
  setExtensionResources(bootState.resources)
}

/** 扫描服务端 boot 清单，供管理界面展示 */
export async function scanExtensionResources() {
  const payload = await apiGet('/api/boot')
  applyBoot(payload)
  return bootState.resources
}

async function loadBrowserComponent(item) {
  try {
    const response = await fetch(item.url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`client bundle ${response.status}`)
    const source = await response.text()
    delete window.__wrPlugin
    const run = new Function(`${source}
;window.__wrPlugin = (typeof __wrPlugin !== 'undefined' ? __wrPlugin : undefined);`)
    run()
    const plugin = window.__wrPlugin?.default || window.__wrPlugin
    delete window.__wrPlugin
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('client bundle 没有导出 Cordis 插件对象')
    }
    await mountCordisPluginObject(`component:${item.name}`, plugin)
    updateExtensionResource(item.id, { status: 'loaded', error: '' })
    return true
  } catch (error) {
    updateExtensionResource(item.id, { status: 'error', error: error.message })
    addExtensionError(`客户端组件加载失败 ${item.package || item.name}: ${error.message}`)
    return false
  }
}

/** 加载全部扩展资源（样式 / 脚本 / client bundle） */
export async function loadExtensionResources() {
  const resources = await scanExtensionResources()
  const disabledList = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  const disabled = new Set(Array.isArray(disabledList) ? disabledList : [])

  for (const item of resources) {
    if (item.kind === 'component') {
      item.enabled = !disabled.has(item.id)
      continue
    }
    if (disabled.has(item.id)) continue
    if (item.kind === 'style') {
      const url = item.url
      if (loadedStyles.has(url)) continue
      loadedStyles.add(url)
      await mountCordisPlugin(`style:${item.file}`, async () => {
        const link = await injectStyle(url)
        if (!link) throw new Error('样式加载失败')
        return () => link.remove()
      })
      updateExtensionResource(item.id, { status: 'loaded' })
    } else if (item.kind === 'script') {
      const url = item.url
      if (loadedScripts.has(url)) continue
      loadedScripts.add(url)
      await mountCordisPlugin(`script:${item.file}`, async () => {
        const script = await injectScript(url)
        if (!script) throw new Error('脚本加载失败')
        return () => script.remove()
      })
      updateExtensionResource(item.id, { status: 'loaded' })
    }
  }

  for (const item of resources.filter(resource => resource.kind === 'component' && resource.enabled)) {
    await loadBrowserComponent(item)
  }
}

/** 重新读取服务端 profile 并热加载 client bundle */
export async function reloadExtensionComponents() {
  try { await apiPost('/api/extensions/reload') } catch (error) { console.warn('[extensions] 服务端 profile 重载失败:', error) }
  await unmountCordisPlugins('component:')
  document.querySelectorAll('style[data-extension]').forEach(style => style.remove())
  const payload = await apiGet('/api/boot')
  applyBoot(payload)
  const disabledList = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  const disabled = new Set(Array.isArray(disabledList) ? disabledList : [])

  let loaded = 0
  let failed = 0
  for (const item of bootState.resources.filter(resource => resource.kind === 'component')) {
    item.enabled = !disabled.has(item.id)
    if (!item.enabled) continue
    const ok = await loadBrowserComponent(item)
    if (ok) loaded += 1
    else failed += 1
  }
  markExtensionsChanged()
  emit('extensions:components-reloaded', { loaded, failed, total: loaded + failed })
  return { loaded, failed, total: loaded + failed }
}

/** npm 搜索组件包（设置面板使用） */
export async function searchPlugins(query) {
  return apiGet(`/api/plugins/search?q=${encodeURIComponent(query)}`)
}

/** 通过服务端安装外部组件包（设置面板使用） */
export async function installPlugin(spec) {
  const result = await apiPost('/api/plugins/install', { spec })
  await reloadExtensionComponents()
  return result
}

/** 监听服务端 profile 变化（轮询清单） */
export async function startExtensionWatcher() {
  if (pollTimer) return
  lastBootKey = JSON.stringify(bootState.modules)
  pollTimer = setInterval(async () => {
    try {
      const payload = await apiGet('/api/boot')
      const key = JSON.stringify(payload?.modules || [])
      if (key === lastBootKey) return
      lastBootKey = key
      applyBoot(payload)
      await reloadExtensionComponents()
    } catch (error) {
      console.warn('[extensions] profile 轮询失败:', error)
    }
  }, 3000)
  extensionState.watcher = 'active'
}

export async function getResourcesPath() {
  if (!bootState.paths?.resources) await scanExtensionResources()
  return bootState.paths?.resources || ''
}

export async function getPluginsPath() {
  if (!bootState.paths?.profile) await scanExtensionResources()
  return bootState.paths?.profile || ''
}
