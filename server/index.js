/**
 * 周报 Cordis Node 服务。
 *
 * 使用真实的 @cordisjs/plugin-loader 加载 profile：package.json 的
 * weekReport.profile.bundles → 各 bundle 的 weekReport.bundle.patch →
 * profile 的 cordis.patch.yml。浏览器只负责显示和客户端插件 bundle。
 */
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { watch } from 'node:fs'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import { composeProfile, seedProfile } from './profile.js'
import { createHttpServer } from './http.js'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = process.env.WR_APP_ROOT || (here.endsWith('dist') ? resolve(here, '../..') : resolve(here, '..'))

function appDataRoot() {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
}

export async function startServer(options = {}) {
  const distDir = options.distDir || process.env.WR_DIST_DIR || join(projectRoot, 'dist')
  const resourcesDir = options.resourcesDir || process.env.WR_RESOURCES_DIR || join(projectRoot, 'resources')
  const bundledProfileDir = options.bundledProfileDir || process.env.WR_BUNDLED_PROFILE_DIR || join(projectRoot, 'profile')
  const profileDir = options.profileDir || process.env.WR_PROFILE_DIR || join(appDataRoot(), 'com.lu.week-report', 'profile')
  const dbPath = options.dbPath || process.env.WR_DB_PATH || join(appDataRoot(), 'com.lu.week-report', 'week_report.db')
  const port = Number(options.port ?? process.env.WR_PORT ?? 0)

  await mkdir(dirname(profileDir), { recursive: true })
  const seeded = await seedProfile(bundledProfileDir, profileDir)
  if (seeded) console.log('[server] profile seeded:', profileDir)

  process.env.WR_DB_PATH = dbPath

  // 壳进程被强制结束时回收后台服务，避免孤儿 Node 进程占用 SQLite。
  const parentPid = Number(process.env.WR_PARENT_PID || 0)
  if (parentPid) {
    setInterval(() => {
      try { process.kill(parentPid, 0) } catch { process.exit(0) }
    }, 2000)
  }

  const profile = await composeProfile(profileDir)

  const ctx = new Context()
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(`${profileDir}/`).href })

  let currentProfile = profile
  const mountRows = async rows => {
    for (const row of rows) {
      if (!row?.name) continue
      await ctx.loader.create({
        name: row.name,
        config: row.config,
        disabled: Boolean(row.disabled)
      })
    }
    await ctx.loader.await()
  }
  await mountRows(profile.rows)

  // 包可以在 package.json 里自己声明 weekReport.client.entry，无需强制 index.js 或 Node half。
  const registerClientEntries = async () => {
    const manifestPath = join(profileDir, 'package.json')
    let manifest = {}
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch {}
    for (const dep of Object.keys(manifest.dependencies || {})) {
      const pkgDir = join(profileDir, 'node_modules', dep)
      const pkgPath = join(pkgDir, 'package.json')
      if (!existsSync(pkgPath)) continue
      let pkg = {}
      try { pkg = JSON.parse(await readFile(pkgPath, 'utf8')) } catch { continue }
      const entry = pkg.weekReport?.client?.entry
      if (!entry) continue
      const id = pkg.name || dep
      if (ctx.clientModules.get(id)) continue
      const file = resolve(pkgDir, String(entry).replace(/^\.\//, ''))
      if (!existsSync(file)) continue
      ctx.clientModules.register({
        id,
        package: id,
        file,
        url: `/client/${encodeURIComponent(id)}/index.js`
      })
    }
  }
  const annotateClientKinds = async () => {
    for (const module of ctx.clientModules.list()) {
      const pkgPath = join(profileDir, 'node_modules', module.package, 'package.json')
      if (!existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
        module.kind = pkg.weekReport?.kind || 'component'
      } catch {}
    }
  }
  await registerClientEntries()
  await annotateClientKinds()

  const reload = async () => {
    for (const entry of [...ctx.loader.entries()]) {
      try { ctx.loader.remove(entry.id) } catch {}
    }
    currentProfile = await composeProfile(profileDir)
    await mountRows(currentProfile.rows)
    await registerClientEntries()
    await annotateClientKinds()
    return currentProfile
  }

  const http = await createHttpServer({
    ctx,
    distDir,
    resourcesDir,
    profileDir,
    getProfile: () => currentProfile,
    reload,
    port
  })

  // profile / node_modules 变化后重新组合并挂载；浏览器轮询 boot 清单热加载 client bundle。
  let reloadTimer = null
  const watcher = watch(profileDir, { recursive: true }, () => {
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      reload().then(() => console.log('[server] profile reloaded')).catch(error => console.warn('[server] profile reload failed:', error))
    }, 400)
  })

  console.log(`[server] ready ${http.url} (profile: ${profileDir})`)
  return {
    ctx,
    http,
    url: http.url,
    token: http.token,
    profileDir,
    close: async () => {
      watcher.close()
      clearTimeout(reloadTimer)
      await http.close()
      await ctx.loader.dispose?.()
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch(error => {
    console.error('[server] failed:', error)
    process.exitCode = 1
  })
}
