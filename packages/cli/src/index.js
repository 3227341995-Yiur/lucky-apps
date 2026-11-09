/**
 * 外部 Cordis 组件安装命令，对齐 dsh plugin 的用法：
 *
 *   week-report plugin add <包名|本地目录> [--profile <dir> | --user]
 *   week-report plugin remove <包名> [--profile <dir> | --user]
 *   week-report plugin list [--profile <dir> | --user]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')

function appDataRoot() {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
}

function defaultProfileDir() {
  return join(appDataRoot(), 'com.lu.week-report', 'profile')
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
    if (existsSync(join(dir, 'profile', 'package.json'))) return join(dir, 'profile')
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(packageRoot, '..', '..', 'profile')
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
    shell: process.platform === 'win32'
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
    console.log('用法: week-report plugin <add|remove|list> [包名|目录] [--profile <dir>|--user]')
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
    writeFileSync(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')
    pnpm(['add', spec, '--node-linker=hoisted'], profileDir)

    let name = specName(spec)
    const installed = readInstalledManifest(profileDir, name)
    if (installed?.name) name = installed.name
    if (!installed) throw new Error(`安装后找不到包: ${name}`)

    const hasBundle = Boolean(installed.weekReport?.bundle?.patch)
    const manifest = readProfile(profileDir)
    manifest.weekReport ||= {}
    manifest.weekReport.profile ||= {}
    manifest.weekReport.profile.bundles ||= []
    if (hasBundle && !manifest.weekReport.profile.bundles.includes(name)) {
      manifest.weekReport.profile.bundles.push(name)
    }
    writeProfile(profileDir, manifest)
    console.log(`[week-report] installed ${name}`)
    if (!hasBundle) console.warn('[week-report] 包没有 weekReport.bundle.patch，只作为普通依赖安装，不会进入 profile 组合')
    return
  }

  if (action === 'remove') {
    if (!spec) throw new Error('缺少包名')
    pnpm(['remove', spec], profileDir)
    const manifest = readProfile(profileDir)
    const bundles = manifest.weekReport?.profile?.bundles || []
    manifest.weekReport.profile.bundles = bundles.filter(name => name !== spec)
    writeProfile(profileDir, manifest)
    console.log(`[week-report] removed ${spec}`)
    return
  }

  throw new Error(`未知命令: ${action}`)
}
