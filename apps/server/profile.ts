/**
 * Cordis profile 组合，语义与 DSH 一致：
 * 空根 → 各 bundle 的 weekReport.bundle.patch → profile 的 cordis.patch.yml。
 * 这里只生成 Loader 行；真正的模块解析和插件挂载交给 @cordisjs/plugin-loader。
 */
import { readFile, writeFile, readdir, mkdir, cp, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

async function readJson(path: string): Promise<any> {
  const text = await readText(path)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function upsert(rows: any[], row: any): void {
  if (!row || typeof row !== 'object') return
  const id = row.id || row.name
  if (!id) return
  const next = { ...row }
  const index = rows.findIndex(item => (item.id || item.name) === id)
  if (index === -1) {
    rows.push(next)
    return
  }
  const merged = { ...rows[index], ...next }
  if ('config' in next) merged.config = next.config
  rows[index] = merged
}

function applyPatch(rows: any[], patch: any): void {
  if (!Array.isArray(patch)) return
  for (const item of patch) {
    if (!item || typeof item !== 'object') continue
    if (Array.isArray(item.insert)) {
      for (const row of item.insert) upsert(rows, row)
      continue
    }
    if (item.id) upsert(rows, item)
  }
}

function patchFilesOf(bundle: any): string[] {
  const patch = bundle?.weekReport?.bundle?.patch
  if (Array.isArray(patch)) return patch
  return patch ? [patch] : []
}

/** 读取并组合 profile，返回 Loader 行 */
export async function composeProfile(profileDir: string): Promise<{ manifest: any; bundles: string[]; rows: any[] }> {
  const manifest = await readJson(join(profileDir, 'package.json'))
  const bundles = Array.isArray(manifest?.weekReport?.profile?.bundles)
    ? manifest.weekReport.profile.bundles
    : []

  const rows = []
  const rootText = await readText(join(profileDir, 'cordis.yml'))
  if (rootText) {
    try {
      const root = parseYaml(rootText)
      if (Array.isArray(root)) for (const row of root) upsert(rows, row)
    } catch (error) {
      console.warn(`[profile] cordis.yml 解析失败: ${error.message}`)
    }
  }

  for (const bundleName of bundles) {
    const bundleDir = join(profileDir, 'node_modules', bundleName)
    const bundle = await readJson(join(bundleDir, 'package.json'))
    if (!bundle) {
      console.warn(`[profile] bundle 不存在: ${bundleName}`)
      continue
    }
    for (const patchFile of patchFilesOf(bundle)) {
      const text = await readText(join(bundleDir, String(patchFile).replace(/^\.\//, '')))
      if (!text) continue
      try {
        applyPatch(rows, parseYaml(text))
      } catch (error) {
        console.warn(`[profile] patch 解析失败 ${bundleName}/${patchFile}: ${error.message}`)
      }
    }
  }

  const userPatch = await readText(join(profileDir, 'cordis.patch.yml'))
  if (userPatch) {
    try {
      applyPatch(rows, parseYaml(userPatch))
    } catch (error) {
      console.warn(`[profile] cordis.patch.yml 解析失败: ${error.message}`)
    }
  }

  return { manifest, bundles, rows }
}

// 旧 profile 曾把浏览器依赖也装进 Node profile，占用 1.1 万个文件。
// 现在只保留真正的 Cordis 插件包；这三个包由宿主 dist 提供。
const LEGACY_BROWSER_DEPS = ['vue', 'element-plus', '@element-plus/icons-vue']

function mergeProfileManifest(bundled: any, installed: any): any {
  const bundledBundles = bundled?.weekReport?.profile?.bundles || []
  const installedBundles = installed?.weekReport?.profile?.bundles || []
  const bundles = [
    ...bundledBundles,
    ...installedBundles.filter(name => !bundledBundles.includes(name)),
  ]
  const dependencies = {
    ...(installed?.dependencies || {}),
    ...(bundled?.dependencies || {}),
  }
  for (const name of LEGACY_BROWSER_DEPS) {
    if (!bundled?.dependencies?.[name]) delete dependencies[name]
  }
  return {
    ...installed,
    ...bundled,
    dependencies,
    weekReport: {
      ...installed?.weekReport,
      ...bundled?.weekReport,
      profile: {
        ...installed?.weekReport?.profile,
        ...bundled?.weekReport?.profile,
        bundles,
      },
    },
  }
}

/**
 * 应用升级后同步随包携带的 profile：
 * - 覆盖核心包和系统依赖；
 * - 保留用户自己安装的包与 bundle；
 * - 用 weekReport.profile.version 标记，避免每次启动都复制。
 */
/** 只复制 manifest 里声明的包，避免安装目录里历史遗留的整套浏览器依赖被再次搬运。 */
async function copyBundledModules(sourceDir: string, targetDir: string, bundled: any): Promise<void> {
  const sourceModules = join(sourceDir, 'node_modules')
  const targetModules = join(targetDir, 'node_modules')
  await mkdir(targetModules, { recursive: true })
  for (const name of Object.keys(bundled?.dependencies || {})) {
    const from = join(sourceModules, name)
    try {
      await access(from)
      await cp(from, join(targetModules, name), { recursive: true, force: true })
    } catch {}
  }
}

async function copyProfileFiles(sourceDir: string, targetDir: string, bundled: any): Promise<void> {
  await mkdir(targetDir, { recursive: true })
  for (const file of ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-lock.yaml']) {
    const from = join(sourceDir, file)
    try {
      await access(from)
      await cp(from, join(targetDir, file), { force: true })
    } catch {}
  }
  await cp(join(sourceDir, 'vendor'), join(targetDir, 'vendor'), {
    recursive: true,
    force: true,
  }).catch(() => {})
  await copyBundledModules(sourceDir, targetDir, bundled)
}

/** 清掉随包 profile 里旧版本遗留、但 manifest 已不声明的包（主要是一次性的 EP 依赖树）。 */
async function pruneBundledModules(sourceDir: string, bundled: any): Promise<void> {
  const modulesDir = join(sourceDir, 'node_modules')
  const keep = new Set(Object.keys(bundled?.dependencies || {}))
  let entries
  try {
    entries = await readdir(modulesDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (!entry.name.startsWith('@')) {
      if (!keep.has(entry.name)) await rm(join(modulesDir, entry.name), { recursive: true, force: true }).catch(() => {})
      continue
    }
    const scopeDir = join(modulesDir, entry.name)
    let children = []
    try { children = await readdir(scopeDir) } catch { continue }
    for (const child of children) {
      if (!keep.has(`${entry.name}/${child}`)) await rm(join(scopeDir, child), { recursive: true, force: true }).catch(() => {})
    }
  }
}

async function upgradeProfile(sourceDir: string, targetDir: string): Promise<boolean> {
  const bundled = await readJson(join(sourceDir, 'package.json'))
  const installed = await readJson(join(targetDir, 'package.json'))
  const bundledVersion = String(bundled?.weekReport?.profile?.version || '')
  const installedVersion = String(installed?.weekReport?.profile?.version || '')
  if (!bundled || !installed || !bundledVersion || bundledVersion === installedVersion) return false

  await cp(join(sourceDir, 'vendor'), join(targetDir, 'vendor'), {
    recursive: true,
    force: true,
  }).catch(() => {})
  await copyBundledModules(sourceDir, targetDir, bundled)
  // 复制来的 node_modules 记录了打包机的虚拟仓库绝对路径；
  // 删掉这些元数据，pnpm 之后才能在该 profile 里正常 add，否则会报
  // ERR_PNPM_UNEXPECTED_VIRTUAL_STORE。
  for (const name of ['.modules.yaml', '.pnpm-workspace-state-v1.json']) {
    await rm(join(targetDir, 'node_modules', name), { force: true })
  }
  await rm(join(targetDir, 'node_modules', '.pnpm'), { recursive: true, force: true })
  for (const name of LEGACY_BROWSER_DEPS) {
    if (!bundled?.dependencies?.[name]) {
      await rm(join(targetDir, 'node_modules', name), { recursive: true, force: true })
    }
  }
  await writeFile(
    join(targetDir, 'package.json'),
    `${JSON.stringify(mergeProfileManifest(bundled, installed), null, 2)}\n`,
  )
  return true
}

/** 首次运行复制随包 profile；升级时覆盖核心包并保留用户插件 */
export async function seedProfile(sourceDir: string, targetDir: string): Promise<false | 'seeded' | 'upgraded'> {
  const bundled = await readJson(join(sourceDir, 'package.json'))
  // 安装目录可能保留着旧版本 profile；先清掉 manifest 已不声明的大包。
  await pruneBundledModules(sourceDir, bundled)

  try {
    await access(join(targetDir, 'package.json'))
  } catch {
    await copyProfileFiles(sourceDir, targetDir, bundled)
    return 'seeded'
  }

  try {
    const upgraded = await upgradeProfile(sourceDir, targetDir)
    return upgraded ? 'upgraded' : false
  } catch (error) {
    console.warn('[profile] 升级失败，保留当前 profile:', error.message)
    return false
  }
}
