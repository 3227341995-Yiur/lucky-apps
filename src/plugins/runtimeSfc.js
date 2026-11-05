/**
 * 外部 Vue SFC 运行时热加载
 *
 * 编译：直接使用 Vue 官方团队 SFC Playground 的 @vue/repl/core `compileFile`
 *      （内部调用官方 vue/compiler-sfc 浏览器构建，含 TS/JSX 转换与 scoped CSS）。
 * 模块解析：使用浏览器原生 Import Map（与 @vue/repl 的官方做法一致），
 *      把 vue / element-plus 等裸模块映射到全局模块的 ESM shim，不自行改写导入。
 * 本文件只负责：读取文件、调用官方 compileFile、生成导入映射、注册组件。
 *
 * resources/comps 下的文件在应用启动时读取；保存后由 loader 自动热加载，无需构建或重启。
 */
import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { resourceDir } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'

// 外部组件可直接 import 的模块 -> 运行时全局对象
export const GLOBAL_MODULES = {
  'vue': 'Vue',
  'element-plus': 'ElementPlus',
  '@element-plus/icons-vue': 'ElementPlusIconsVue',
  '@tauri-apps/api': 'TauriApi',
  '@tauri-apps/api/core': 'TauriCore',
  '@tauri-apps/api/path': 'TauriPath',
  '@tauri-apps/api/event': 'TauriEvent',
  '@tauri-apps/api/window': 'TauriWindow',
  '@tauri-apps/plugin-fs': 'TauriFs',
  '@tauri-apps/plugin-sql': 'TauriSql',
  'handlebars': 'Handlebars',
  'moment': 'moment',
  'lodash': '_',
  'vditor': 'VditorModule'
}

const VALID_IDENTIFIER = /^[A-Za-z_$][\w$]*$/

const shimUrls = new Map()
const styleTags = new Map()
let replPromise = null
let compilerPromise = null
let compileStore = null
let importMapInstalled = false

function cleanPath(path) {
  return String(path).replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, '').replace(/\\/g, '/')
}

function getShimUrl(specifier) {
  if (shimUrls.has(specifier)) return shimUrls.get(specifier)

  const globalName = GLOBAL_MODULES[specifier]
  const namespace = globalName ? window[globalName] : null
  if (!namespace) return null

  const exportNames = Object.keys(namespace)
    .filter(name => name !== 'default' && VALID_IDENTIFIER.test(name))

  const lines = [
    `const M = window[${JSON.stringify(globalName)}];`,
    'export default (M && M.default !== undefined) ? M.default : M;',
    ...exportNames.map(name => `export const ${name} = M[${JSON.stringify(name)}];`)
  ]

  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/javascript' }))
  shimUrls.set(specifier, url)
  return url
}

/**
 * 安装原生 Import Map：外部 SFC 编译产物中的裸模块统一由此解析。
 * 必须在加载外部组件之前调用（main → installExtensions）。
 */
export function installRuntimeImportMap() {
  if (importMapInstalled || typeof document === 'undefined') return
  importMapInstalled = true

  const imports = {}
  for (const specifier of Object.keys(GLOBAL_MODULES)) {
    const url = getShimUrl(specifier)
    if (url) imports[specifier] = url
  }

  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify({ imports })
  document.head.appendChild(script)
}

function loadRepl() {
  if (!replPromise) replPromise = import('@vue/repl/core')
  return replPromise
}

function loadCompiler() {
  if (!compilerPromise) compilerPromise = import('vue/compiler-sfc')
  return compilerPromise
}

async function getCompileStore() {
  if (compileStore) return compileStore
  const compiler = await loadCompiler()
  compileStore = {
    compiler,
    sfcOptions: {},
    errors: [],
    files: {},
    activeFile: null,
    mainFile: 'main.vue'
  }
  return compileStore
}

/**
 * 解析 @resources/... 导入为 asset URL（仅支持 JS 模块）
 */
async function resolveResourceImports(code) {
  const regex = /(\bfrom\s*|\bimport\s*)(['"])(@resources\/[^'"]+)\2/g
  const matches = [...code.matchAll(regex)]
  if (matches.length === 0) return code

  const resDir = await resourceDir()
  let next = code

  for (const match of matches) {
    const [whole, prefix, quote, specifier] = match
    const rest = specifier.replace(/^@resources\/?/, '')
    if (!/\.(m?js)$/i.test(rest)) {
      throw new Error(`@resources 仅支持导入 JS 模块，组件中请勿直接导入静态资源：${specifier}`)
    }
    const assetUrl = convertFileSrc(cleanPath(`${resDir}/resources/${rest}`))
    next = next.split(whole).join(`${prefix}${quote}${assetUrl}${quote}`)
  }

  return next
}

function injectComponentStyles(fileName, css) {
  if (!css || css.startsWith('/* No <style>')) return
  const existing = styleTags.get(fileName)
  if (existing?.isConnected) existing.textContent = css
  else {
    const el = document.createElement('style')
    el.setAttribute('data-runtime-sfc-style', fileName)
    el.textContent = css
    document.head.appendChild(el)
    styleTags.set(fileName, el)
  }
}

/**
 * 用官方 @vue/repl compileFile 编译 .vue / .js（含 TS）并返回可 import 的 Blob URL
 */
export async function compileRuntimeComponent(fileName, content) {
  const [{ File, compileFile }, store] = await Promise.all([loadRepl(), getCompileStore()])
  store.errors = []

  const file = new File(fileName, content)
  const errors = await compileFile(store, file)
  const styleErrors = Array.isArray(store.errors) ? store.errors : []
  const allErrors = [...errors, ...styleErrors]

  if (allErrors.length > 0) {
    const message = allErrors
      .map(error => (error && error.message) ? error.message : String(error))
      .join('\n')
    throw new Error(message)
  }

  const js = file.compiled?.js
  if (!js) throw new Error('编译结果为空')

  injectComponentStyles(fileName, file.compiled.css)

  let code = await resolveResourceImports(js)
  return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
}

/**
 * 读取 resources/comps 下的组件源码（供 loader 调用）
 */
export async function readComponentSource(file) {
  return readTextFile(`resources/comps/${file}`, { baseDir: BaseDirectory.Resource })
}

export default compileRuntimeComponent
