/**
 * 外部 Cordis 组件安装命令，对齐 dsh plugin 的用法：
 *
 *   lucky-apps plugin add <包名|本地目录> [--profile <dir> | --user]
 *   lucky-apps plugin remove <包名> [--profile <dir> | --user]
 *   lucky-apps plugin list [--profile <dir> | --user]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')

function appDataRoot() {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
}

function defaultProfileDir() {
  return join(appDataRoot(), 'com.lu.lucky-apps', 'profile')
}

function parseArgs(argv) {
  const args = [...argv]
  const options = { profile: '', user: false, build: false }
  const rest = []
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--user') options.user = true
    else if (arg === '--build') options.build = true
    else if (arg === '--profile') options.profile = args[++i] || ''
    else rest.push(arg)
  }
  return { options, rest }
}

function repoProfileDir() {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'src-tauri', 'target', 'profile', 'package.json'))) return join(dir, 'src-tauri', 'target', 'profile')
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(packageRoot, '..', '..', 'src-tauri', 'target', 'profile')
}

function profileDirOf(options) {
  if (options.profile) return resolve(options.profile)
  if (options.user) return defaultProfileDir()
  return repoProfileDir()
}

function pnpm(args, cwd) {
  execFileSync('pnpm', args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

function readProfile(dir) {
  const path = join(dir, 'package.json')
  if (!existsSync(path)) throw new Error(`profile 不存在: ${dir}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeProfile(dir, manifest) {
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

/** profile 从别的机器复制过来时，node_modules 里记着源目录的虚拟仓库路径，pnpm 会拒绝继续安装。 */
function prepareProfile(profileDir) {
  writeFileSync(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')
  const modulesDir = join(profileDir, 'node_modules')
  const metaPath = join(modulesDir, '.modules.yaml')
  if (!existsSync(metaPath)) return
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const expected = resolve(modulesDir, '.pnpm').toLowerCase()
    const actual = meta.virtualStoreDir ? resolve(meta.virtualStoreDir).toLowerCase() : ''
    if (!actual || actual === expected) return
    rmSync(metaPath, { force: true })
    rmSync(join(modulesDir, '.pnpm-workspace-state-v1.json'), { force: true })
    rmSync(join(modulesDir, '.pnpm'), { recursive: true, force: true })
  } catch {}
}

function readProfilePatch(profileDir) {
  const path = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(path)) return []
  try {
    const parsed = parseYaml(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeProfilePatch(profileDir, rows) {
  const path = join(profileDir, 'cordis.patch.yml')
  writeFileSync(path, rows.length ? dumpYaml(rows, { noRefs: true, lineWidth: -1 }) : '[]\n')
}

function addProfilePluginRow(profileDir, name) {
  const rows = readProfilePatch(profileDir)
  const exists = rows.some(row => row?.id === name || row?.name === name
    || (Array.isArray(row?.insert) && row.insert.some(entry => entry?.id === name || entry?.name === name)))
  if (exists) return
  const insertRow = rows.find(row => Array.isArray(row.insert))
  if (insertRow) insertRow.insert.push({ id: name, name })
  else rows.push({ insert: [{ id: name, name }] })
  writeProfilePatch(profileDir, rows)
}

function removeProfilePluginRow(profileDir, name) {
  const rows = readProfilePatch(profileDir)
  const next = []
  for (const row of rows) {
    if (row?.id === name || row?.name === name) continue
    if (Array.isArray(row?.insert)) {
      const insert = row.insert.filter(entry => entry?.id !== name && entry?.name !== name)
      if (!insert.length) continue
      next.push({ ...row, insert })
    } else {
      next.push(row)
    }
  }
  writeProfilePatch(profileDir, next)
}

function readInstalledManifest(profileDir, name) {
  const path = join(profileDir, 'node_modules', name, 'package.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function manifestName(spec) {
  if (spec.startsWith('@')) {
    const [scope, name] = spec.split('/')
    return name ? `${scope}/${name}` : spec
  }
  return spec.split('/')[0]
}

function specName(spec) {
  const maybeDir = resolve(spec)
  const manifestPath = join(maybeDir, 'package.json')
  if (existsSync(manifestPath)) {
    try {
      return JSON.parse(readFileSync(manifestPath, 'utf8')).name || manifestName(spec)
    } catch {}
  }
  return manifestName(spec)
}

export async function run(argv) {
  const [group, action, spec, ...rest] = argv
  if (group !== 'plugin') {
    console.log('用法: lucky-apps plugin <add|remove|list> [包名|目录] [--profile <dir>|--user]')
    return
  }
  const { options } = parseArgs([spec, ...rest].filter(Boolean))
  const profileDir = profileDirOf(options)

  if (action === 'list' || !action) {
    const manifest = readProfile(profileDir)
    console.log(`profile: ${profileDir}`)
    console.log('dependencies:')
    for (const [name, version] of Object.entries(manifest.dependencies || {})) {
      console.log(`  ${name}  ${version}`)
    }
    console.log('bundles:')
    for (const name of manifest.weekReport?.profile?.bundles || []) console.log(`  ${name}`)
    return
  }

  if (action === 'add') {
    if (!spec) throw new Error('缺少包名或目录')
    if (!existsSync(profileDir)) throw new Error(`profile 不存在: ${profileDir}`)
    prepareProfile(profileDir)
    const before = readProfile(profileDir).dependencies || {}
    pnpm(['add', spec, '--node-linker=hoisted'], profileDir)

    const after = readProfile(profileDir).dependencies || {}
    const changed = Object.keys(after).filter(key => before[key] !== after[key])
    let name = changed.find(key => existsSync(join(profileDir, 'node_modules', key, 'package.json')))
      || specName(spec)
    const installed = readInstalledManifest(profileDir, name)
    if (installed?.name) name = installed.name
    if (!installed) throw new Error(`安装后找不到包: ${name}`)

    const hasBundle = Boolean(installed.weekReport?.bundle?.patch)
    const hasNode = Boolean(installed.weekReport?.node)
    const hasClient = Boolean(installed.weekReport?.client?.entry)
    const manifest = readProfile(profileDir)
    manifest.weekReport ||= {}
    manifest.weekReport.profile ||= {}
    manifest.weekReport.profile.bundles ||= []
    if (hasBundle && !manifest.weekReport.profile.bundles.includes(name)) {
      manifest.weekReport.profile.bundles.push(name)
    }
    if (hasNode && !hasBundle) addProfilePluginRow(profileDir, name)
    writeProfile(profileDir, manifest)
    console.log(`[lucky-apps] installed ${name}`)
    if (!hasBundle && !hasNode && !hasClient) {
      console.warn('[lucky-apps] 包没有 weekReport.node / client 声明，只作为普通依赖安装')
    }
    return
  }

  if (action === 'remove') {
    if (!spec) throw new Error('缺少包名')
    prepareProfile(profileDir)
    pnpm(['remove', spec, '--node-linker=hoisted'], profileDir)
    const manifest = readProfile(profileDir)
    const bundles = manifest.weekReport?.profile?.bundles || []
    manifest.weekReport.profile.bundles = bundles.filter(name => name !== spec)
    writeProfile(profileDir, manifest)
    removeProfilePluginRow(profileDir, spec)
    console.log(`[lucky-apps] removed ${spec}`)
    return
  }

  throw new Error(`未知命令: ${action}`)
}
