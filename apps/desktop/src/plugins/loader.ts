/**
 * 浏览器侧扩展入口。
 *
 * profile / bundle / patch 组合和真实 Cordis loader 都在 Node 服务里完成；
 * 浏览器只读取 /api/boot 清单，注入样式/脚本并加载 client bundle。
 */
import { apiGet, apiPost, apiStream } from '@/services/rpc'
import {
  setExtensionResources,
  updateExtensionResource,
  addExtensionError,
  clearExtensionErrors,
  markExtensionsChanged,
  resetPluginRegistries,
  extensionState,
} from '@/plugins/registry'
import { cordis, mountCordisPlugin, mountCordisPluginObject, unmountCordisPlugin, unmountCordisPlugins } from '@/plugins/cordis'
import { instantiateModule } from '@/plugins/modules'
import { getSetting } from '@/services/settings'

export const DISABLED_EXTENSIONS_KEY = 'extensions.disabled'

const loadedStyles = new Set()
const loadedScripts = new Set()
// 已经注册了 teardown 的脚本；重新扫描资源时用它恢复 hot 状态
const hotScripts = new Set()
let bootState = { modules: [], resources: [], paths: {} }
let pollTimer = null
let lastBootKey = ''
// 已挂载的 client 插件资源，增量同步时只动增删，避免整页状态被重建
const mountedComponents = new Map()

export function ensureExternalPluginDir() {
  return Promise.resolve()
}

function injectStyle(url) {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve(link)
    link.onerror = () => resolve(null)
    document.head.appendChild(link)
  })
}

async function fetchScriptSource(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`脚本加载失败 (${response.status})`)
  return response.text()
}

function applyBoot(payload, disabled = null) {
  bootState = {
    modules: Array.isArray(payload?.modules) ? payload.modules : [],
    resources: Array.isArray(payload?.resources) ? payload.resources : [],
    paths: payload?.paths || {},
    profile: payload?.profile || null,
  }
  extensionState.profile = bootState.profile || { bundles: [], rows: 0 }
  // 先把禁用状态合并进资源，再交给界面，避免设置面板抢跑时看到服务端的 enabled=true
  if (disabled) applyEnabledState(bootState.resources, disabled)
  setExtensionResources(bootState.resources)
  const profileError = String(bootState.profile?.error || '')
  if (profileError && !extensionState.errors.some(message => message.includes(profileError))) {
    addExtensionError(`Cordis 插件加载失败：${profileError}`)
  }
}

async function disabledIds() {
  const list = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  return new Set(Array.isArray(list) ? list : [])
}

/** 把用户保存的启停状态同步到资源列表；脚本/样式也要显示真实状态。 */
function applyEnabledState(resources, disabled) {
  for (const item of resources) {
    item.enabled = !disabled.has(item.id)
    // 禁用的资源不能沿用服务端的 loaded 状态，否则界面会显示“已加载”但开关是关的
    if (!item.enabled) item.status = 'disabled'
    if (item.kind === 'script') item.hot = hotScripts.has(item.file)
  }
}

/** 脚本是否注册了 teardown（用于界面判断能否热卸载） */
export function isScriptHot(file) {
  return hotScripts.has(file)
}

/** 扫描服务端 boot 清单，供管理界面展示 */
export async function scanExtensionResources() {
  const [payload, disabled] = await Promise.all([apiGet('/api/boot'), disabledIds()])
  applyBoot(payload, disabled)
  return bootState.resources
}

async function loadBrowserComponent(item) {
  try {
    const response = await fetch(item.url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`client bundle ${response.status}`)
    const source = await response.text()
    const id = item.package || item.name
    // client module：bundle 自己注册 factory，loader 负责 require 解析
    new Function(source)()
    const exported = instantiateModule(id)
    const plugin = exported?.default || exported
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('client bundle 没有导出 Cordis 插件对象')
    }
    await mountCordisPluginObject(`component:${item.name}`, plugin)
    mountedComponents.set(item.id, item)
    updateExtensionResource(item.id, { status: 'loaded', error: '' })
    return true
  } catch (error) {
    // 资源卡片已经展示该错误，不再往全局错误列表重复写一份。
    updateExtensionResource(item.id, { status: 'error', error: error.message })
    return false
  }
}

async function mountStyleResource(item) {
  const url = item.url
  if (loadedStyles.has(url)) return
  loadedStyles.add(url)
  await mountCordisPlugin(`style:${item.file}`, async () => {
    const link = await injectStyle(url)
    if (!link) throw new Error('样式加载失败')
    return () => { link.remove(); loadedStyles.delete(url) }
  })
  updateExtensionResource(item.id, { status: 'loaded' })
}

/** 第三方脚本没有 teardown，卸载时清掉它们挂到 window 的全局。 */
const SCRIPT_GLOBAL_CLEANUP = {
  'marked.min.js': () => { delete (window as any).marked },
  'sweetalert2.min.js': () => { delete (window as any).Sweetalert2 },
  'driver.min.js': () => { delete (window as any).Driver },
}

async function mountScriptResource(item) {
  const url = item.url
  if (loadedScripts.has(url)) return
  loadedScripts.add(url)
  let hot = false
  await mountCordisPlugin(`script:${item.file}`, async () => {
    const disposers: Array<() => void> = []
    // 脚本以 Function('ctx', source) 执行，和 Cordis 插件一样拿到 ctx.effect 注册卸载。
    const scriptCtx = {
      file: item.file,
      effect: (execute: () => void | (() => void)) => {
        const dispose = execute()
        if (typeof dispose === 'function') disposers.push(dispose)
        return dispose
      },
    }
    const source = await fetchScriptSource(url)
    try {
      const runner = new Function('ctx', `${source}\n//# sourceURL=${url}`)
      runner.call(window, scriptCtx)
    } catch (error) {
      loadedScripts.delete(url)
      throw error
    }
    const globalCleanup = (SCRIPT_GLOBAL_CLEANUP as Record<string, (() => void) | undefined>)[item.file]
    hot = disposers.length > 0 || Boolean(globalCleanup)
    if (hot) hotScripts.add(item.file)
    return () => {
      for (const dispose of disposers.reverse()) {
        try { dispose() } catch (error) { console.warn(`[extensions] 脚本清理失败 ${item.file}:`, error) }
      }
      try { globalCleanup?.() } catch (error) { console.warn(`[extensions] 全局清理失败 ${item.file}:`, error) }
      hotScripts.delete(item.file)
      loadedScripts.delete(url)
    }
  })
  updateExtensionResource(item.id, { status: 'loaded', hot })
}

/** 加载全部扩展资源（样式 / 脚本 / client bundle） */
export async function loadExtensionResources() {
  clearExtensionErrors()
  const resources = await scanExtensionResources()
  const disabled = await disabledIds()

  for (const item of resources) {
    if (item.kind === 'component') continue
    if (disabled.has(item.id)) continue
    if (item.kind === 'style') await mountStyleResource(item)
    else if (item.kind === 'script') await mountScriptResource(item)
  }

  for (const item of resources.filter(resource => resource.kind === 'component' && resource.enabled)) {
    await loadBrowserComponent(item)
  }
}

/** 单个资源启停：按 Cordis 生命周期挂载/卸载，不用重载页面或应用。 */
export async function syncExtensionResource(item, enabled) {
  if (item.kind === 'component') {
    if (enabled) return loadBrowserComponent(item)
    await unmountCordisPlugin(`component:${item.name}`)
    mountedComponents.delete(item.id)
    document.querySelector(`style[data-extension="${item.package || item.name}"]`)?.remove()
    updateExtensionResource(item.id, { status: 'disabled' })
    return
  }
  if (enabled) {
    if (item.kind === 'style') return mountStyleResource(item)
    if (item.kind === 'script') return mountScriptResource(item)
    return
  }
  await unmountCordisPlugin(`${item.kind}:${item.file}`)
  updateExtensionResource(item.id, { status: 'disabled' })
}

/** 重新读取服务端 profile 并热加载 client bundle */
async function performReloadExtensionComponents() {
  clearExtensionErrors()
  try { await apiPost('/api/extensions/reload') } catch (error) { console.warn('[extensions] 服务端 profile 重载失败:', error) }
  // 正常注册项随 fiber dispose 撤销；全量重载时再兜底清一次，消除竞态残留。
  await unmountCordisPlugins('component:')
  mountedComponents.clear()
  resetPluginRegistries()
  document.querySelectorAll('style[data-extension]').forEach(style => style.remove())
  const [payload, disabled] = await Promise.all([apiGet('/api/boot'), disabledIds()])
  applyBoot(payload, disabled)

  let loaded = 0
  let failed = 0
  for (const item of bootState.resources.filter(resource => resource.kind === 'component')) {
    if (!item.enabled) continue
    const ok = await loadBrowserComponent(item)
    if (ok) loaded += 1
    else failed += 1
  }
  markExtensionsChanged()
  cordis.emit('extensions/components-reloaded', { loaded, failed, total: loaded + failed })
  return { loaded, failed, total: loaded + failed }
}

let clientBusy = false
let pendingFull = false
let pendingSync = false
let clientChain = Promise.resolve()

/** 安装/卸载和 boot 监听都走串行队列，避免旧 boot 把已卸载插件挂回去。 */
function runClientQueue(first) {
  if (clientBusy) {
    if (first === 'full') pendingFull = true
    else pendingSync = true
    return clientChain
  }
  clientBusy = true
  clientChain = (async () => {
    try {
      let result
      let mode = first
      do {
        pendingFull = false
        pendingSync = false
        result = mode === 'full'
          ? await performReloadExtensionComponents()
          : await performSyncExtensionComponents()
        mode = pendingFull ? 'full' : (pendingSync ? 'sync' : null)
      } while (mode)
      return result
    } finally {
      clientBusy = false
    }
  })()
  return clientChain
}

/** 手动全量热重载（设置面板按钮） */
export function reloadExtensionComponents() {
  return runClientQueue('full')
}

/** 安装/卸载、boot 监听的增量热更新：保留其它插件与页面状态 */
export function syncExtensionComponents() {
  return runClientQueue('sync')
}

/**
 * 增量同步 client 插件：只卸载消失的、挂载新增的。
 * 安装/卸载其它插件时，当前页面和已有插件的模块状态保持不动。
 */
async function performSyncExtensionComponents() {
  clearExtensionErrors()
  try { await apiPost('/api/extensions/reload') } catch (error) { console.warn('[extensions] 服务端 profile 重载失败:', error) }
  const [payload, disabled] = await Promise.all([apiGet('/api/boot'), disabledIds()])
  applyBoot(payload, disabled)
  const next = bootState.resources.filter(resource => resource.kind === 'component')
  const nextById = new Map(next.map(item => [item.id, item]))

  let removed = 0
  for (const [id, item] of [...mountedComponents]) {
    const stillThere = nextById.get(id)
    if (stillThere && !disabled.has(id)) continue
    await unmountCordisPlugin(`component:${item.name}`)
    mountedComponents.delete(id)
    document.querySelector(`style[data-extension="${item.package || item.name}"]`)?.remove()
    if (stillThere) updateExtensionResource(id, { status: 'disabled' })
    removed += 1
  }

  let added = 0
  for (const item of next) {
    if (!item.enabled || mountedComponents.has(item.id)) continue
    if (await loadBrowserComponent(item)) added += 1
  }
  if (removed || added) markExtensionsChanged()
  return { removed, added }
}

/** npm 搜索组件包（设置面板使用） */
export async function searchPlugins(query) {
  return apiGet(`/api/packages/extensions/search?q=${encodeURIComponent(query)}`)
}

/** 通过服务端安装外部组件包，流式接收 pnpm 进度与错误（设置面板使用） */
export async function installPlugin(spec, onEvent = () => {}, approvedBuilds = [], signal = undefined) {
  const response = await apiStream('/api/packages/extensions/install', { spec, approvedBuilds }, signal)
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).error || '' } catch {}
    throw new Error(detail || `安装请求失败 (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let streamError = ''
  let pendingBuilds = []

  const consume = (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      let event
      try { event = JSON.parse(line) } catch { continue }
      if (event.type === 'error') {
        streamError = event.error || '安装失败'
        pendingBuilds = Array.isArray(event.pendingBuilds) ? event.pendingBuilds : []
      } else if (event.type === 'done') result = event.result
      onEvent(event)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    consume(decoder.decode(value, { stream: true }))
  }
  consume(decoder.decode())
  if (streamError) {
    const error = new Error(streamError)
    error.pendingBuilds = pendingBuilds
    throw error
  }

  onEvent({ type: 'stage', stage: 'reload', progress: 88, message: '重新加载插件…' })
  await syncExtensionComponents()
  onEvent({ type: 'stage', stage: 'done', progress: 100, message: '安装完成' })
  return result
}

/** 流式卸载外部组件包，进度与 pnpm 日志通过 NDJSON 返回 */
export async function uninstallPluginStream(name, onEvent = () => {}) {
  const response = await apiStream('/api/packages/extensions/remove', { name })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).error || '' } catch {}
    throw new Error(detail || `卸载请求失败 (${response.status})`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let streamError = ''
  const consume = (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      let event
      try { event = JSON.parse(line) } catch { continue }
      if (event.type === 'error') streamError = event.error || '卸载失败'
      else if (event.type === 'done') result = event.result
      onEvent(event)
    }
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    consume(decoder.decode(value, { stream: true }))
  }
  consume(decoder.decode())
  if (streamError) throw new Error(streamError)
  onEvent({ type: 'stage', stage: 'reload', progress: 92, message: '刷新扩展…' })
  await syncExtensionComponents()
  onEvent({ type: 'stage', stage: 'done', progress: 100, message: '卸载完成' })
  return result
}

/** 兼容旧调用：卸载并等待完成 */
export async function uninstallPlugin(name) {
  return uninstallPluginStream(name)
}

/** 监听服务端 profile 变化（轮询清单） */
export async function startExtensionWatcher() {
  if (pollTimer) return
  lastBootKey = JSON.stringify([bootState.modules, bootState.resources])
  pollTimer = setInterval(async () => {
    try {
      const payload = await apiGet('/api/boot')
      const key = JSON.stringify([payload?.modules || [], payload?.resources || []])
      if (key === lastBootKey) return
      lastBootKey = key
      await syncExtensionComponents()
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
