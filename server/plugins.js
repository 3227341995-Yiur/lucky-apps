import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function specName(spec) {
  const dir = resolve(spec)
  const manifestPath = join(dir, 'package.json')
  if (existsSync(manifestPath)) {
    try { return readJson(manifestPath).name } catch {}
  }
  if (spec.startsWith('@')) {
    const [scope, name] = spec.split('/')
    return name ? `${scope}/${name}` : spec
  }
  return spec.split('/')[0]
}

export function installProfilePlugin(profileDir, spec) {
  if (!spec || !String(spec).trim()) throw new Error('请输入包名或本地目录')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  writeFileSync(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')
  execFileSync('pnpm', ['add', spec, '--node-linker=hoisted'], {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  let name = specName(spec)
  const installedPath = join(profileDir, 'node_modules', name, 'package.json')
  if (!existsSync(installedPath)) throw new Error(`安装后找不到包: ${name}`)
  const installed = readJson(installedPath)
  if (installed.name) name = installed.name

  const manifestPath = join(profileDir, 'package.json')
  const manifest = readJson(manifestPath)
  manifest.weekReport ||= {}
  manifest.weekReport.profile ||= {}
  manifest.weekReport.profile.bundles ||= []
  const hasBundle = Boolean(installed.weekReport?.bundle?.patch)
  if (hasBundle && !manifest.weekReport.profile.bundles.includes(name)) {
    manifest.weekReport.profile.bundles.push(name)
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { name, hasBundle }
}
