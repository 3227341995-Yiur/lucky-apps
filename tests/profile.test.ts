import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { seedProfile } from '../apps/server/profile.ts'

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

test('seedProfile upgrades bundled packages and keeps user plugins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wr-profile-test-'))
  const bundled = join(root, 'bundled')
  const target = join(root, 'target')

  try {
    await mkdir(join(bundled, 'vendor'), { recursive: true })
    await writeFile(join(bundled, 'vendor', 'base.tgz'), 'new-core')
    await mkdir(join(bundled, 'node_modules', 'base'), { recursive: true })
    await writeFile(join(bundled, 'node_modules', 'base', 'index.js'), 'new')
    await writeFile(join(bundled, 'node_modules', 'trash-bin.js'), 'new-plugin')
    await writeJson(join(bundled, 'package.json'), {
      name: 'profile',
      dependencies: { 'base': 'file:./vendor/base.tgz', 'trash-bin': 'file:./vendor/trash.tgz' },
      weekReport: { profile: { version: '2.0.1', bundles: ['base', 'trash-bin'] } },
    })

    await mkdir(join(target, 'node_modules', 'my-plugin'), { recursive: true })
    await writeFile(join(target, 'node_modules', 'my-plugin', 'index.js'), 'user')
    await writeFile(join(target, 'node_modules', 'base.js'), 'old')
    await mkdir(join(target, 'node_modules', '.pnpm'), { recursive: true })
    await mkdir(join(target, 'node_modules', 'vue'), { recursive: true })
    await writeFile(join(target, 'node_modules', 'vue', 'index.js'), 'legacy browser dep')
    await writeFile(join(target, 'node_modules', '.pnpm', 'lock.yaml'), 'old')
    await writeFile(join(target, 'node_modules', '.modules.yaml'), 'old virtualStoreDir')
    await writeFile(join(target, 'node_modules', '.pnpm-workspace-state-v1.json'), '{}')
    await writeFile(join(target, 'cordis.patch.yml'), 'user patch')
    await writeJson(join(target, 'package.json'), {
      name: 'profile',
      dependencies: {
        'base': 'file:./vendor/base.tgz',
        'my-plugin': 'link:../my-plugin',
        vue: '^3.5.0',
      },
      weekReport: { profile: { version: '2.0.0', bundles: ['base', 'my-plugin'] } },
    })

    assert.equal(await seedProfile(bundled, target), 'upgraded')

    const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
    assert.equal(manifest.weekReport.profile.version, '2.0.1')
    assert.deepEqual(manifest.weekReport.profile.bundles, ['base', 'trash-bin', 'my-plugin'])
    assert.equal(manifest.dependencies['my-plugin'], 'link:../my-plugin')
    assert.equal(await readFile(join(target, 'node_modules', 'base', 'index.js'), 'utf8'), 'new')
    assert.equal(await readFile(join(target, 'node_modules', 'my-plugin', 'index.js'), 'utf8'), 'user')
    assert.equal(manifest.dependencies.vue, undefined)
    assert.equal(existsSync(join(target, 'node_modules', 'vue')), false)
    assert.equal(await readFile(join(target, 'cordis.patch.yml'), 'utf8'), 'user patch')
    assert.ok(existsSync(join(target, 'vendor', 'base.tgz')))
    assert.equal(existsSync(join(target, 'node_modules', '.modules.yaml')), false)
    assert.equal(existsSync(join(target, 'node_modules', '.pnpm-workspace-state-v1.json')), false)
    assert.equal(existsSync(join(target, 'node_modules', '.pnpm')), false)

    assert.equal(await seedProfile(bundled, target), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('seedProfile copies bundled profile on first run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wr-profile-seed-test-'))
  const bundled = join(root, 'bundled')
  const target = join(root, 'target')
  try {
    await mkdir(bundled, { recursive: true })
    await writeJson(join(bundled, 'package.json'), {
      name: 'profile',
      weekReport: { profile: { version: '2.0.1', bundles: [] } },
    })
    assert.equal(await seedProfile(bundled, target), 'seeded')
    assert.ok(existsSync(join(target, 'package.json')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
