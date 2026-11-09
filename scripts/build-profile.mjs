/**
 * 生成真实的 Cordis profile：
 * 1. 把每个组件/core 包 pnpm pack 成 tarball
 * 2. profile/package.json 依赖这些 tarball + 系统依赖
 * 3. pnpm install 生成真实的 profile/node_modules
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const profileDir = join(root, 'profile')
const vendorDir = join(profileDir, 'vendor')

async function packageDirs(parent) {
  let entries = []
  try {
    entries = await readdir(parent, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(parent, entry.name))
}

async function readManifest(dir) {
  return JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
}

await rm(vendorDir, { recursive: true, force: true })
await mkdir(vendorDir, { recursive: true })

const candidates = [
  ...(await packageDirs(join(root, 'extensions'))),
  ...(await packageDirs(join(root, 'packages', 'core')))
].filter(dir => !dir.endsWith('plugin-api'))

const packages = []
for (const dir of candidates) {
  let manifest
  try {
    manifest = await readManifest(dir)
  } catch {
    continue
  }
  console.log(`[profile] pack ${manifest.name}@${manifest.version}`)
  execFileSync('pnpm', ['pack', '--pack-destination', vendorDir], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  packages.push({
    name: manifest.name,
    version: manifest.version,
    file: `file:./vendor/${manifest.name}-${manifest.version}.tgz`
  })
}

const profileManifestPath = join(profileDir, 'package.json')
const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
profileManifest.dependencies = {
  vue: '^3.5.44',
  'element-plus': '^2.14.7',
  '@element-plus/icons-vue': '^2.3.2',
  ...Object.fromEntries(packages.map(item => [item.name, item.file]))
}
await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)
await writeFile(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')

console.log('[profile] pnpm install')
await rm(join(profileDir, 'node_modules'), { recursive: true, force: true })
execFileSync('pnpm', ['install', '--prod', '--ignore-scripts', '--node-linker=hoisted'], {
  cwd: profileDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
console.log('[profile] done:', join(profileDir, 'node_modules'))
