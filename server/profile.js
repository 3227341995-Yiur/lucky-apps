/**
 * Cordis profile 组合，语义与 DSH 一致：
 * 空根 → 各 bundle 的 weekReport.bundle.patch → profile 的 cordis.patch.yml。
 * 这里只生成 Loader 行；真正的模块解析和插件挂载交给 @cordisjs/plugin-loader。
 */
import { readFile, mkdir, cp, access } from 'node:fs/promises'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'

async function readText(path) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

async function readJson(path) {
  const text = await readText(path)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function upsert(rows, row) {
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

function applyPatch(rows, patch) {
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

function patchFilesOf(bundle) {
  const patch = bundle?.weekReport?.bundle?.patch
  if (Array.isArray(patch)) return patch
  return patch ? [patch] : []
}

/** 读取并组合 profile，返回 Loader 行 */
export async function composeProfile(profileDir) {
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

/** 首次运行把随应用携带的 profile 复制到可写的 AppData 目录 */
export async function seedProfile(sourceDir, targetDir) {
  try {
    await access(join(targetDir, 'package.json'))
    return false
  } catch {}
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: false, errorOnExist: false })
  return true
}
