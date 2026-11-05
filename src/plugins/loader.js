/**
 * 外部资源加载器（运行时热加载）
 *
 * resources/
 *   css/   样式表，按名称排序注入 <link>
 *   js/    插件脚本，按名称排序串行加载（依赖用数字前缀或字母序保证）
 *   comps/ Vue SFC（.vue / .cslot.vue）使用官方 @vue/compiler-sfc 运行时编译，
 *          .js 作为 ES Module 加载；文件更新后自动热加载，无需重新构建或重启。
 *
 * 启停状态存于 meta 表的 extensions.disabled，修改后下次启动生效。
 * 单文件失败只记录状态，不中断其他扩展。
 */
import { readDir, watchImmediate, BaseDirectory } from '@tauri-apps/plugin-fs'
import { resourceDir } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import {
  setExtensionResources,
  updateExtensionResource,
  addExtensionError,
  registerComponent,
  registerColumnSlot,
  markExtensionsChanged,
  extensionState
} from '@/plugins/registry'
import { stripComponentExtension, toKebabCase, toPascalCase } from '@/plugins/naming'
import { compileRuntimeComponent, readComponentSource } from '@/plugins/runtimeSfc'
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

/**
 * 扫描 resources 下的所有扩展资源（不加载），供管理界面展示
 */
export async function scanExtensionResources() {
  const disabledList = await getSetting(DISABLED_EXTENSIONS_KEY, [])
  const disabled = new Set(Array.isArray(disabledList) ? disabledList : [])

  const [cssFiles, jsFiles, compFiles] = await Promise.all([
    readResourceDir('resources/css'),
    readResourceDir('resources/js'),
    readResourceDir('resources/comps')
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

  for (const file of [...compFiles].sort((a, b) => a.name.localeCompare(b.name))) {
    const isCslot = file.name.endsWith('.cslot.vue')
    const isVue = file.name.endsWith('.vue')
    const isModule = file.name.endsWith('.js')
    if (!isCslot && !isVue && !isModule) continue
    const id = `component:${file.name}`
    resources.push({
      id,
      kind: 'component',
      subtype: isCslot ? 'column-slot' : isVue ? 'vue' : 'module',
      name: stripComponentExtension(file.name),
      file: file.name,
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
    link.onload = () => resolve(true)
    link.onerror = () => resolve(false)
    document.head.appendChild(link)
  })
}

function injectScript(url) {
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

/**
 * 加载全部启用的扩展资源
 */
export async function loadExtensionResources() {
  const resources = await scanExtensionResources()
  const enabled = resources.filter(item => item.enabled)

  // 1. 样式
  for (const item of enabled.filter(item => item.kind === 'style')) {
    try {
      const url = await toAssetUrl(`resources/css/${item.file}`)
      if (!loadedStyles.has(url)) {
        loadedStyles.add(url)
        const ok = await injectStyle(url)
        if (!ok) {
          updateExtensionResource(item.id, { status: 'error', error: '样式加载失败' })
          addExtensionError(`样式加载失败: ${item.file}`)
          continue
        }
      }
      updateExtensionResource(item.id, { status: 'loaded', error: '' })
    } catch (error) {
      updateExtensionResource(item.id, { status: 'error', error: error.message })
      addExtensionError(`样式加载异常 ${item.file}: ${error.message}`)
    }
  }

  // 2. 脚本（串行，保证顺序）
  for (const item of enabled.filter(item => item.kind === 'script')) {
    try {
      const url = await toAssetUrl(`resources/js/${item.file}`)
      if (!loadedScripts.has(url)) {
        loadedScripts.add(url)
        const ok = await injectScript(url)
        if (!ok) {
          updateExtensionResource(item.id, { status: 'error', error: '脚本加载失败' })
          addExtensionError(`脚本加载失败: ${item.file}`)
          continue
        }
      }
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
    const content = await readComponentSource(item.file)
    const url = await compileRuntimeComponent(item.file, content)

    const module = await import(/* @vite-ignore */ url)
    const component = module.default || module
    if (!component) throw new Error('组件没有 default 导出')

    if (item.subtype === 'column-slot') {
      registerColumnSlot(item.name, component, {
        source: `runtime:${item.file}`,
        value: toKebabCase(toPascalCase(item.name))
      })
    } else {
      registerComponent(item.name, component, {
        source: `runtime:${item.file}`,
        value: toKebabCase(toPascalCase(item.name)),
        description: '运行时组件'
      })
    }

    updateExtensionResource(item.id, { status: 'loaded', error: '' })
    return true
  } catch (error) {
    updateExtensionResource(item.id, { status: 'error', error: error.message })
    addExtensionError(`组件加载失败 ${item.file}: ${error.message}`)
    return false
  }
}

/**
 * 热加载 resources/comps：重新编译并注册所有启用的组件（无需重启、无需构建）
 */
export async function reloadExtensionComponents() {
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
 * 监听 resources/comps 变化并自动热加载（Tauri 环境）
 */
export async function startExtensionWatcher() {
  if (unwatch) return
  try {
    unwatch = await watchImmediate('resources/comps', events => {
      console.info('[loader] resources/comps changed:', events)
      clearTimeout(watchTimer)
      watchTimer = setTimeout(() => {
        reloadExtensionComponents()
          .then(result => console.info('[loader] 组件热加载完成:', result))
          .catch(error => console.error('[loader] 组件热加载失败:', error))
      }, 350)
    }, { baseDir: BaseDirectory.Resource, recursive: true })
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
