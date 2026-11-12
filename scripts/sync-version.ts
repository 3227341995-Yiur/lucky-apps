/**
 * 统一版本：App 与所有 workspace 包共用同一个版本号（与 DSH 的 lockstep 发布一致）。
 *
 *   pnpm version:sync 3.2.6
 *
 * 不带参数时读取根 package.json 的版本并同步到其余位置。
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootPkgPath = join(root, 'package.json')
const rootPkg = JSON.parse(await readFile(rootPkgPath, 'utf8'))
const version = String(process.argv[2] || rootPkg.version || '').trim()
if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) {
  throw new Error(`版本号无效: ${version || '(empty)'}`)
}

async function writeJsonVersion(path: string) {
  const pkg = JSON.parse(await readFile(path, 'utf8'))
  if (pkg.version !== version) {
    pkg.version = version
    await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}

async function directManifests(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifest = join(dir, entry.name, 'package.json')
    try { await readFile(manifest, 'utf8'); files.push(manifest) } catch {}
  }
  return files
}

async function groupedManifests(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const group of await readdir(dir, { withFileTypes: true })) {
    if (!group.isDirectory()) continue
    files.push(...(await directManifests(join(dir, group.name))))
  }
  return files
}

await writeJsonVersion(rootPkgPath)
for (const manifest of [
  ...(await groupedManifests(join(root, 'packages'))),
  ...(await directManifests(join(root, 'apps'))),
]) {
  await writeJsonVersion(manifest)
}

const tauriConfPath = join(root, 'src-tauri', 'tauri.conf.json')
const tauriConf = JSON.parse(await readFile(tauriConfPath, 'utf8'))
tauriConf.version = version
await writeFile(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`)

const cargoTomlPath = join(root, 'src-tauri', 'Cargo.toml')
const cargoToml = await readFile(cargoTomlPath, 'utf8')
await writeFile(cargoTomlPath, cargoToml.replace(/^version = "[^"]+"/m, `version = "${version}"`))

const cargoLockPath = join(root, 'src-tauri', 'Cargo.lock')
const cargoLock = await readFile(cargoLockPath, 'utf8')
await writeFile(
  cargoLockPath,
  cargoLock.replace(/(\[\[package\]\]\nname = "lucky-apps"\nversion = ")[^"]+(")/, `$1${version}$2`),
)

const readmePath = join(root, 'README.md')
const readme = await readFile(readmePath, 'utf8')
await writeFile(readmePath, readme.replace(/^# Lucky Apps v[^\n]+/m, `# Lucky Apps v${version}`))

console.log(`[version] ${version} synced`)
