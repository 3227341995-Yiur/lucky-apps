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
const profileDir = join(root, 'src-tauri', 'target', 'profile')
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
  ...(await packageDirs(join(root, 'packages', 'extensions'))),
  ...(await packageDirs(join(root, 'packages', 'bundle'))),
  ...(await packageDirs(join(root, 'packages', 'client'))),
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
  // Windows 上 pnpm 为 workspace 依赖建的 junction 可能无法遍历；pack 不需要 devDependencies。
  const manifestPath = join(dir, 'package.json')
  const originalText = await readFile(manifestPath, 'utf8')
  let stripped = false
  if (manifest.devDependencies?.['@lucky-apps/plugin-api']) {
    const temp = { ...manifest, devDependencies: { ...manifest.devDependencies } }
    delete temp.devDependencies['@lucky-apps/plugin-api']
    await writeFile(manifestPath, `${JSON.stringify(temp, null, 2)}
`)
    stripped = true
  }
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', vendorDir], {
      cwd: dir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  } finally {
    if (stripped) await writeFile(manifestPath, originalText)
  }
  packages.push({
    name: manifest.name,
    version: manifest.version,
    file: `file:./vendor/${manifest.name.replace(/^@/, '').replace(/\//g, '-')}-${manifest.version}.tgz`,
    hasBundle: Boolean(manifest.la?.bundle?.patch),
  })
}

await mkdir(profileDir, { recursive: true })
const bundleNames = packages
  .filter(item => item.hasBundle)
  .map(item => item.name)
  .sort((a, b) => (a === '@lucky-apps/base' ? -1 : b === '@lucky-apps/base' ? 1 : a.localeCompare(b)))
const appManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
// Vue / Element Plus / 图标只用于浏览器端，已由主程序的 Vite 构建内联到 dist；
// profile 里的 Node 插件不需要它们。之前重复携带整棵 EP 依赖树（1.1 万个文件、89MB），
// 导致安装/卸载极慢。
const profileManifest = {
  name: 'profile',
  private: true,
  dependencies: Object.fromEntries(packages.map(item => [item.name, item.file])),
  la: {
    profile: {
      version: appManifest.version,
      // 同一版本内插件包也会变化：构建指纹不同就重新播种 bundled profile
      build: `${Date.now().toString(36)}-${process.pid.toString(36)}`,
      bundles: bundleNames,
      // 随包分发的受管包清单：升级时据此清理已移除的内置插件
      managed: packages.map(item => item.name),
    },
  },
}
await writeFile(join(profileDir, 'package.json'), `${JSON.stringify(profileManifest, null, 2)}\n`)
await writeFile(join(profileDir, 'cordis.yml'), '[]\n')
await writeFile(join(profileDir, 'cordis.patch.yml'), '[]\n')
await writeFile(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')

console.log('[profile] pnpm install')
await rm(join(profileDir, 'node_modules'), { recursive: true, force: true })
execFileSync('pnpm', ['install', '--prod', '--ignore-scripts', '--node-linker=hoisted'], {
  cwd: profileDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
console.log('[profile] done:', join(profileDir, 'node_modules'))
