/**
 * 周报 Cordis Node 服务。
 *
 * 使用真实的 @cordisjs/plugin-loader 加载 profile：package.json 的
 * la.profile.bundles → 各 bundle 的 la.bundle.patch →
 * profile 的 cordis.patch.yml。浏览器只负责显示和客户端插件 bundle。
 */
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { watch } from 'node:fs'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import { composeProfile, seedProfile } from './profile.ts'
import { createHttpServer } from './http.ts'

const here = dirname(fileURLToPath(import.meta.url))
// 开发布局在 apps/server（或 apps/server/dist），仓库根需再上一层；安装布局 resources/server/dist 的上级即根
const fallbackRoot = here.endsWith('dist') ? resolve(here, '../..') : resolve(here, '..')
const projectRoot = process.env.WR_APP_ROOT
  || (['apps', 'server'].includes(basename(fallbackRoot)) ? resolve(fallbackRoot, '..') : fallbackRoot)

function appDataRoot() {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
}

export interface StartServerOptions {
  distDir?: string
  resourcesDir?: string
  bundledProfileDir?: string
  profileDir?: string
  port?: number
}

export async function startServer(options: StartServerOptions = {}) {
  const distDir = options.distDir || process.env.WR_DIST_DIR || join(projectRoot, 'dist')
  const resourcesDir = options.resourcesDir || process.env.WR_RESOURCES_DIR || join(projectRoot, 'resources')
  const bundledProfileDir = options.bundledProfileDir || process.env.WR_BUNDLED_PROFILE_DIR || join(projectRoot, 'profile')
  const profileDir = options.profileDir || process.env.WR_PROFILE_DIR || join(appDataRoot(), 'com.lu.lucky-apps', 'profile')
  const port = Number(options.port ?? process.env.WR_PORT ?? 0)

  // 与壳进程绑定生命周期：父进程结束时 stdin 管道关闭，立即退出；
  // PID 轮询作为兜底，避免留下孤儿 Node 占用 SQLite / 端口。
  const parentPid = Number(process.env.WR_PARENT_PID || 0)
  if (parentPid) {
    const quit = () => process.exit(0)
    process.stdin.resume()
    process.stdin.on('end', quit)
    process.stdin.on('close', quit)
    process.stdin.on('error', quit)
    setInterval(() => {
      try { process.kill(parentPid, 0) } catch { quit() }
    }, 2000)
  }

  const ctx = new Context()
  let currentProfile = { bundles: [], rows: [] }
  let resolveReady = () => {}
  const readyPromise = new Promise((resolve) => { resolveReady = resolve })
  let reloadImpl = async () => currentProfile

  // 安装插件时 pnpm 写 profile 会触发文件监听；把重载串行化，避免
  // watcher 和手动“热加载”同时操作 Cordis loader。
  let reloadQueue = Promise.resolve()
  let reloadBarrier = Promise.resolve()
  const requestReload = () => {
    const run = reloadQueue.then(() => reloadImpl())
    reloadBarrier = run.catch(() => {})
    reloadQueue = reloadBarrier
    return run
  }
  let setupError = null

  // 先启动 HTTP 并打印 ready，让 Tauri 立即创建窗口；profile 升级/插件挂载
  // 再异步完成，API 请求在 readyPromise 上等待。这样插件再慢也不会没有窗口。
  const http = await createHttpServer({
    ctx,
    distDir,
    resourcesDir,
    profileDir,
    bundledProfileDir,
    getProfile: () => currentProfile,
    getProfileError: () => setupError?.message || '',
    reload: requestReload,
    waitForReload: () => reloadBarrier,
    ready: () => readyPromise,
    port,
  })
  console.log(`[server] ready ${http.url} (profile: ${profileDir})`)

  let watcher = null
  let reloadTimer = null

  const startup = async () => {
    await mkdir(dirname(profileDir), { recursive: true })
    const profileState = await seedProfile(bundledProfileDir, profileDir)
    if (profileState) console.log(`[server] profile ${profileState}:`, profileDir)

    currentProfile = await composeProfile(profileDir)
    await ctx.plugin(Loader, { baseUrl: pathToFileURL(`${profileDir}/`).href })

    // 行 id 固定用 row.id / name，重载时按 id 做增量 diff：
    // 只卸载消失的、挂载新增的，未变化的插件保持挂载（Cordis loader 的形态）。
    const rowOptions = row => ({
      id: String(row.id || row.name),
      name: row.name,
      config: row.config,
      disabled: Boolean(row.disabled),
    })

    const mountRows = async (rows) => {
      for (const row of rows) {
        if (!row?.name) continue
        await ctx.loader.create(rowOptions(row))
      }
      await ctx.loader.await()
    }
    await mountRows(currentProfile.rows)

    // 包可以在 package.json 里自己声明 la.client.entry，无需强制 index.js 或 Node half。
    const registerClientEntries = async () => {
      const manifestPath = join(profileDir, 'package.json')
      let manifest = {}
      try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch {}
      const deps = new Set(Object.keys(manifest.dependencies || {}))
      for (const dep of deps) {
        const pkgDir = join(profileDir, 'node_modules', dep)
        const pkgPath = join(pkgDir, 'package.json')
        if (!existsSync(pkgPath)) continue
        let pkg = {}
        try { pkg = JSON.parse(await readFile(pkgPath, 'utf8')) } catch { continue }
        const entry = pkg.la?.client?.entry
        if (!entry) continue
        const id = pkg.name || dep
        if (ctx.clientModules.get(id)) continue
        const file = resolve(pkgDir, String(entry).replace(/^\.\//, ''))
        if (!existsSync(file)) continue
        ctx.clientModules.register({
          id,
          package: id,
          file,
          url: `/client/${encodeURIComponent(id)}/index.js`,
        })
      }
      // 卸载后清掉已经不在 manifest 里的 client 模块（含插件 node half 自己登记的）。
      for (const module of ctx.clientModules.list()) {
        if (!deps.has(module.package)) ctx.clientModules.remove(module.id)
      }
    }
    const annotateClientKinds = async () => {
      for (const module of ctx.clientModules.list()) {
        const pkgPath = join(profileDir, 'node_modules', module.package, 'package.json')
        if (!existsSync(pkgPath)) continue
        try {
          const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
          module.kind = pkg.la?.kind || 'component'
        } catch {}
      }
    }
    await registerClientEntries()
    await annotateClientKinds()

    reloadImpl = async () => {
      currentProfile = await composeProfile(profileDir)
      const desired = new Map()
      for (const row of currentProfile.rows) {
        if (row?.name) desired.set(String(row.id || row.name), rowOptions(row))
      }
      const existing = new Map([...ctx.loader.entries()].map(entry => [entry.id, entry]))

      // loader.remove 只触发 dispose，不等它完成；直接重新 create 会撞上
      // “service already registered”。先等所有被移除的 fiber 撤销完。
      const disposing = []
      for (const [id, entry] of existing) {
        if (desired.has(id)) continue
        try { ctx.loader.remove(id) } catch {}
        if (entry.fiber) disposing.push(entry.fiber.dispose())
      }
      await Promise.allSettled(disposing)

      // 按 id 增量：没变化的插件保持挂载，不重启它的 Node half / 端口 / 连接。
      for (const [id, options] of desired) {
        const entry = existing.get(id)
        const unchanged = entry
          && entry.options.name === options.name
          && JSON.stringify(entry.options.config ?? null) === JSON.stringify(options.config ?? null)
          && Boolean(entry.options.disabled) === options.disabled
        if (unchanged) continue
        if (entry) {
          try { ctx.loader.remove(id) } catch {}
          await entry.fiber?.dispose?.()
        }
        await ctx.loader.create(options)
      }
      await ctx.loader.await()
      await registerClientEntries()
      await annotateClientKinds()
      return currentProfile
    }
  }

  const watchdog = setTimeout(() => {
    console.error('[server] profile startup timeout, serving partial state')
    resolveReady()
  }, 30000)

  try {
    await startup()
  } catch (error) {
    setupError = error
    console.error('[server] startup failed:', error)
  } finally {
    clearTimeout(watchdog)
    resolveReady()
  }

  // profile / node_modules 变化后重新组合并挂载；浏览器轮询 boot 清单热加载 client bundle。
  if (!setupError) {
    watcher = watch(profileDir, { recursive: true }, () => {
      clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        requestReload()
          .then(() => console.log('[server] profile reloaded'))
          .catch(error => console.warn('[server] profile reload failed:', error))
      }, 600)
    })
  }

  return {
    ctx,
    http,
    url: http.url,
    token: http.token,
    profileDir,
    ready: readyPromise,
    setupError,
    close: async () => {
      watcher?.close()
      clearTimeout(reloadTimer)
      await http.close()
      await ctx.loader?.dispose?.()
    },
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error('[server] failed:', error)
    process.exit(1)
  })
}
