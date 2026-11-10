/**
 * 周报 Cordis Node 服务。
 *
 * 使用真实的 @cordisjs/plugin-loader 加载 profile：package.json 的
 * weekReport.profile.bundles → 各 bundle 的 weekReport.bundle.patch →
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

    const mountRows = async (rows) => {
      for (const row of rows) {
        if (!row?.name) continue
        await ctx.loader.create({
          name: row.name,
          config: row.config,
          disabled: Boolean(row.disabled),
        })
      }
      await ctx.loader.await()
    }
    await mountRows(currentProfile.rows)

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
          url: `/client/${encodeURIComponent(id)}/index.js`,
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

    reloadImpl = async () => {
      for (const entry of [...ctx.loader.entries()]) {
        try { ctx.loader.remove(entry.id) } catch {}
      }
      currentProfile = await composeProfile(profileDir)
      await mountRows(currentProfile.rows)
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
