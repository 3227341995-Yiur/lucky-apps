/**
 * 外部资源加载器（运行时热加载）
 *
 * resources/
 *   css/   样式表，按名称排序注入 <link>
 *   js/    插件脚本，按名称排序串行加载（依赖用数字前缀或字母序保证）
 *   cordis.yml 内置组件包 profile，条目只写 node_modules 包名
 *   node_modules/@week-report/... 独立构建的组件包
 *
 * AppData/plugins/ 是用户运行时插件目录：
 *   cordis.yml         外部 profile，条目只写 node_modules 包名
 *   node_modules/...   用户安装的组件包
 *
 * 启停状态存于 meta 表的 extensions.disabled，修改后下次启动生效。
 * 单文件失败只记录状态，不中断其他扩展。
 */
import { readDir, readTextFile, writeTextFile, mkdir, exists, watchImmediate, BaseDirectory } from '@tauri-apps/plugin-fs'
import { resourceDir, appDataDir } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import { load as parseYaml } from 'js-yaml'
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

const loadedScripts = new Set()
const loadedStyles = new Set()


function cleanPath(path) {
  return String(path).replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, '').replace(/\\/g, '/')
}

async function toAssetUrl(relativePath) {
  const resDir = await resourceDir()
  return convertFileSrc(cleanPath(`${resDir}/${relativePath}`))
}

async function readResourceDir(relativeDir) {
  try {
    return await readDir(relativeDir, { baseDir: BaseDirectory.Resource })
  } catch (error) {
    console.warn(`[loader] ${relativeDir} 目录不存在，跳过:`, error)
    return []
  }
}

let pluginDirReady = null

/** 首次运行时创建 AppData/plugins 与空 profile，用户可直接往里装包 */
export function ensureExternalPluginDir() {
  if (pluginDirReady) return pluginDirReady
  pluginDirReady = (async () => {
    await mkdir('plugins', { baseDir: BaseDirectory.AppData, recursive: true })
    const profile = 'plugins/cordis.yml'
    if (await exists(profile, { baseDir: BaseDirectory.AppData })) return
    await writeTextFile(
      profile,
      [
        '# 外部 Cordis 组件包 profile',
        '# 包安装到 plugins/node_modules，条目只写包名；',
        '# 宿主读取 package.json 的 exports / module / main 解析入口。',
        '#',
        '# - id: my-widget',
        '#   name: "@acme/my-widget"',
        '[]',
        ''
      ].join('\n'),
      { baseDir: BaseDirectory.AppData }
    )
  })().catch(error => {
    console.warn('[loader] 初始化插件目录失败:', error)
  })
  return pluginDirReady
}

/** 按 node_modules 语义解析包入口：读取 package.json 的 exports / module / main */
async function resolvePackageModule(entry, nodeModulesDir, baseDir) {
  const name = String(entry?.name || '').trim()
  if (!name) return ''
  const base = `${nodeModulesDir}/${name}`
  try {
    const raw = await readTextFile(`${base}/package.json`, { baseDir })
    const pkg = JSON.parse(raw)
    const exp = pkg.exports
    const root = typeof exp === 'string'
      ? exp
      : exp?.['.']?.import || exp?.['.']?.default || exp?.['.']
    const rel = typeof root === 'string' ? root : pkg.module || pkg.main || 'index.js'
    return `${base}/${String(rel).replace(/^\.\//, '')}`
  } catch {
    return ''
  }
}

/**
 * 扫描 resources 下的所有扩展资源（不加载），供管理界面展示
 */
export async function scanExtensionResources() {
  const disabledList = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  const disabled = new Set(Array.isArray(disabledList) ? disabledList : [])

  const [cssFiles, jsFiles] = await Promise.all([
    readResourceDir('resources/css'),
    readResourceDir('resources/js')
  ])

  const resources = []

  for (const file of [...cssFiles].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.name.endsWith('.css')) continue
    const id = `style:${file.name}`
    resources.push({
      id,
      kind: 'style',
      name: file.name,
      file: file.name,
      enabled: !disabled.has(id),
      status: disabled.has(id) ? 'disabled' : 'pending',
      error: ''
    })
  }

  for (const file of [...jsFiles].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.name.endsWith('.js')) continue
    const id = `script:${file.name}`
    resources.push({
      id,
      kind: 'script',
      name: file.name,
      file: file.name,
      enabled: !disabled.has(id),
      status: disabled.has(id) ? 'disabled' : 'pending',
      error: ''
    })
  }

  const readProfile = async (relative, baseDir) => {
    try {
      const text = await readTextFile(relative, { baseDir })
      return parseYaml(text) || []
    } catch {
      return []
    }
  }

  await ensureExternalPluginDir()
  const [bundledProfile, externalProfile] = await Promise.all([
    readProfile('resources/cordis.yml', BaseDirectory.Resource),
    readProfile('plugins/cordis.yml', BaseDirectory.AppData)
  ])

  for (const entry of Array.isArray(bundledProfile) ? bundledProfile : []) {
    if (!entry?.name) continue
    const id = `plugin:${entry.id || entry.name}`
    const module = await resolvePackageModule(entry, 'resources/node_modules', BaseDirectory.Resource)
    if (!module) {
      resources.push({
        id,
        kind: 'component',
        subtype: 'plugin',
        name: entry.id || entry.name,
        package: entry.name,
        file: '',
        enabled: !disabled.has(id),
        status: 'error',
        error: '内置包缺少入口，请检查 resources/node_modules 下的 package.json'
      })
      continue
    }
    const moduleUrl = await toAssetUrl(module)
    resources.push({
      id,
      kind: 'component',
      subtype: 'plugin',
      name: entry.id || entry.name,
      package: entry.name,
      file: module.replace(/^resources\//, ''),
      moduleUrl,
      enabled: !disabled.has(id),
      status: disabled.has(id) ? 'disabled' : 'pending',
      error: ''
    })
  }

  const appData = await appDataDir()
  for (const entry of Array.isArray(externalProfile) ? externalProfile : []) {
    if (!entry?.name) continue
    const id = `external:${entry.id || entry.name}`
    const module = await resolvePackageModule(entry, 'plugins/node_modules', BaseDirectory.AppData)
    if (!module) {
      resources.push({
        id,
        kind: 'component',
        subtype: 'plugin',
        name: entry.id || entry.name,
        package: entry.name,
        file: '',
        enabled: !disabled.has(id),
        status: 'error',
        error: '找不到包入口，请检查 node_modules 是否安装、package.json 是否有 module/main/exports'
      })
      continue
    }
    const moduleUrl = convertFileSrc(cleanPath(`${appData}/${module}`))
    resources.push({
      id,
      kind: 'component',
      subtype: 'plugin',
      name: entry.id || entry.name,
      package: entry.name,
      file: module,
      moduleUrl,
      enabled: !disabled.has(id),
      status: disabled.has(id) ? 'disabled' : 'pending',
      error: ''
    })
  }

  setExtensionResources(resources)
  return resources
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

/**
 * 加载全部启用的扩展资源
 */
export async function loadExtensionResources() {
  const resources = await scanExtensionResources()
  const enabled = resources.filter(item => item.enabled)

  // 1. 样式（Cordis 管理生命周期）
  for (const item of enabled.filter(item => item.kind === 'style')) {
    try {
      const url = await toAssetUrl(`resources/css/${item.file}`)
      await mountCordisPlugin(`style:${item.file}`, async () => {
        if (loadedStyles.has(url)) return undefined
        loadedStyles.add(url)
        const link = await injectStyle(url)
        if (!link) throw new Error('样式加载失败')
        return () => link.remove()
      })
      updateExtensionResource(item.id, { status: 'loaded', error: '' })
    } catch (error) {
      updateExtensionResource(item.id, { status: 'error', error: error.message })
      addExtensionError(`样式加载异常 ${item.file}: ${error.message}`)
    }
  }

  // 2. 脚本（串行，保证顺序；Cordis 管理生命周期）
  for (const item of enabled.filter(item => item.kind === 'script')) {
    try {
      const url = await toAssetUrl(`resources/js/${item.file}`)
      await mountCordisPlugin(`script:${item.file}`, async () => {
        if (loadedScripts.has(url)) return undefined
        loadedScripts.add(url)
        const script = await injectScript(url)
        if (!script) throw new Error('脚本加载失败')
        return () => script.remove()
      })
      updateExtensionResource(item.id, { status: 'loaded', error: '' })
    } catch (error) {
      updateExtensionResource(item.id, { status: 'error', error: error.message })
      addExtensionError(`脚本加载异常 ${item.file}: ${error.message}`)
    }
  }

  // 3. 组件（运行时编译/加载，无需重新构建）
  for (const item of enabled.filter(item => item.kind === 'component')) {
    await loadComponentResource(item)
  }
}

async function loadComponentResource(item) {
  try {
    if (!item.moduleUrl) throw new Error('插件缺少入口')
    // 加版本参数绕开 ESM 缓存，热加载才能拿到新构建的包
    const url = `${item.moduleUrl}${item.moduleUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
    const module = await import(/* @vite-ignore */ url)
    const plugin = module.default || module
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('插件包必须默认导出 Cordis 插件对象')
    }
    await mountCordisPluginObject(`component:${item.name}`, plugin)

    updateExtensionResource(item.id, { status: 'loaded', error: '' })
    return true
  } catch (error) {
    updateExtensionResource(item.id, { status: 'error', error: error.message })
    addExtensionError(`插件加载失败 ${item.package || item.name}: ${error.message}`)
    return false
  }
}

/**
 * 热加载 cordis.yml 中的外部组件包（无需重启）
 */
export async function reloadExtensionComponents() {
  await unmountCordisPlugins('component:')
  // 插件包把 CSS 内联注入 <style data-extension>，重新 import 前先清掉旧样式
  document.querySelectorAll('style[data-extension]').forEach(style => style.remove())
  const resources = await scanExtensionResources()
  const enabled = resources.filter(item => item.kind === 'component' && item.enabled)

  let loaded = 0
  let failed = 0
  for (const item of enabled) {
    const ok = await loadComponentResource(item)
    if (ok) loaded += 1
    else failed += 1
  }

  markExtensionsChanged()
  emit('extensions:components-reloaded', { loaded, failed, total: enabled.length })
  return { loaded, failed, total: enabled.length }
}

let unwatch = null
let watchTimer = null

/**
 * 监听 AppData/plugins 变化并自动热加载（Tauri 环境）
 */
export async function startExtensionWatcher() {
  if (unwatch) return
  await ensureExternalPluginDir()
  try {
    unwatch = await watchImmediate('plugins', events => {
      console.info('[loader] appdata plugins changed:', events)
      clearTimeout(watchTimer)
      watchTimer = setTimeout(() => {
        reloadExtensionComponents()
          .then(result => console.info('[loader] 组件热加载完成:', result))
          .catch(error => console.error('[loader] 组件热加载失败:', error))
      }, 350)
    }, { baseDir: BaseDirectory.AppData, recursive: true })
    extensionState.watcher = 'active'
    extensionState.watcherError = ''
    console.info('[loader] 组件热监听已启用')
  } catch (error) {
    extensionState.watcher = 'error'
    extensionState.watcherError = error?.message || String(error)
    console.warn('[loader] 组件热监听不可用，使用“热加载组件”手动触发:', error)
  }
}

/**
 * 资源目录绝对路径（管理界面展示/复制）
 */
export async function getResourcesPath() {
  const resDir = await resourceDir()
  return cleanPath(`${resDir}/resources`)
}

/** 用户运行时插件目录绝对路径 */
export async function getPluginsPath() {
  await ensureExternalPluginDir()
  const appData = await appDataDir()
  return cleanPath(`${appData}/plugins`)
}
