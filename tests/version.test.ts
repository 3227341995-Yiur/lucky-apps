/** App 与 workspace 包必须保持同一版本（与 DSH lockstep 发布一致）。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

async function jsonVersion(path: string) {
  return JSON.parse(await readFile(path, 'utf8')).version
}

async function directManifests(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifest = join(dir, entry.name, 'package.json')
    try {
      await readFile(manifest, 'utf8')
      files.push(manifest)
    } catch {}
  }
  return files
}

async function groupedManifests(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const group of await readdir(dir, { withFileTypes: true })) {
    if (group.isDirectory()) files.push(...(await directManifests(join(dir, group.name))))
  }
  return files
}

test('App、apps 与 packages 使用同一版本', async () => {
  const version = await jsonVersion(join(root, 'package.json'))
  assert.match(version, /^\d+\.\d+\.\d+/)

  const manifests = [
    ...(await directManifests(join(root, 'apps'))),
    ...(await groupedManifests(join(root, 'packages'))),
  ]
  for (const manifest of manifests) {
    assert.equal(await jsonVersion(manifest), version, `${manifest} 版本不一致`)
  }

  const tauri = JSON.parse(await readFile(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
  assert.equal(tauri.version, version)
  const cargo = await readFile(join(root, 'src-tauri', 'Cargo.toml'), 'utf8')
  assert.match(cargo, new RegExp(`^version = "${version}"`, 'm'))
})
