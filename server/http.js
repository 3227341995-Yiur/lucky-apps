/**
 * 本地 HTTP 服务：静态前端、/api/db RPC、/api/boot 客户端模块清单。
 * 只绑定 127.0.0.1，并用启动时生成的 token 保护 API。
 */
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { installProfilePlugin, searchRegistry } from './plugins.js'
import { getAutostart, setAutostart } from './system.js'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

async function listFiles(dir, suffix) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith(suffix))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(body)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function safeJoin(root, relative) {
  const target = normalize(join(root, relative))
  return target.startsWith(resolve(root)) ? target : ''
}

export async function createHttpServer({
  ctx,
  distDir,
  resourcesDir,
  profileDir,
  getProfile = () => ({ bundles: [], rows: [] }),
  reload,
  port = 0,
  host = '127.0.0.1'
}) {
  const token = randomBytes(16).toString('hex')
  let indexHtml = ''

  const loadIndex = async () => {
    if (indexHtml) return indexHtml
    const raw = await readFile(join(distDir, 'index.html'), 'utf8')
    indexHtml = raw.replace(
      '</head>',
      `<script>window.__WR_TOKEN__=${JSON.stringify(token)}</script></head>`
    )
    return indexHtml
  }

  const bootPayload = async () => {
    const profile = getProfile()
    const modules = ctx.clientModules?.list?.() || []
    const styles = await listFiles(join(resourcesDir, 'css'), '.css')
    const scripts = await listFiles(join(resourcesDir, 'js'), '.js')
    const resources = [
      ...styles.map(name => ({
        id: `style:${name}`,
        kind: 'style',
        name,
        file: name,
        url: `/extensions/css/${encodeURIComponent(name)}`,
        enabled: true,
        status: 'loaded',
        error: ''
      })),
      ...scripts.map(name => ({
        id: `script:${name}`,
        kind: 'script',
        name,
        file: name,
        url: `/extensions/js/${encodeURIComponent(name)}`,
        enabled: true,
        status: 'loaded',
        error: ''
      })),
      ...modules.map(module => ({
        id: `plugin:${module.id}`,
        kind: 'component',
        componentKind: module.kind || 'component',
        subtype: 'plugin',
        name: module.id,
        package: module.package,
        file: module.file,
        url: module.url,
        enabled: true,
        status: module.status || 'loaded',
        error: module.error || ''
      }))
    ]
    return {
      token,
      modules,
      resources,
      profile: {
        dir: profileDir,
        bundles: profile.bundles || [],
        rows: (profile.rows || []).map(row => ({ id: row.id, name: row.name }))
      },
      paths: {
        resources: resourcesDir,
        profile: profileDir
      }
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      const pathname = decodeURIComponent(url.pathname)

      if (pathname.startsWith('/api/')) {
        if (req.headers['x-wr-token'] !== token) {
          return sendJson(res, 403, { error: 'forbidden' })
        }
        if (pathname === '/api/boot' && req.method === 'GET') {
          return sendJson(res, 200, await bootPayload())
        }
        if (pathname === '/api/db/select' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const rows = ctx.database.select(String(body.sql || ''), body.params || [])
          return sendJson(res, 200, rows)
        }
        if (pathname === '/api/db/execute' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const result = ctx.database.execute(String(body.sql || ''), body.params || [])
          return sendJson(res, 200, result)
        }
        if (pathname === '/api/extensions/reload' && req.method === 'POST') {
          if (typeof reload !== 'function') return sendJson(res, 501, { error: 'reload unavailable' })
          await reload()
          return sendJson(res, 200, await bootPayload())
        }
        if (pathname === '/api/app/autostart' && req.method === 'GET') {
          return sendJson(res, 200, getAutostart())
        }
        if (pathname === '/api/app/autostart' && req.method === 'POST') {
          const body = await readJsonBody(req)
          return sendJson(res, 200, setAutostart(Boolean(body.enabled)))
        }
        if (pathname === '/api/plugins/search' && req.method === 'GET') {
          try {
            return sendJson(res, 200, await searchRegistry(url.searchParams.get('q') || ''))
          } catch (error) {
            return sendJson(res, 502, { error: error.message })
          }
        }
        if (pathname === '/api/plugins/install' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const result = installProfilePlugin(profileDir, String(body.spec || ''))
          if (typeof reload === 'function') await reload()
          return sendJson(res, 200, result)
        }
        if (pathname === '/api/health') {
          return sendJson(res, 200, { ok: true })
        }
        return sendJson(res, 404, { error: 'not found' })
      }

      const clientMatch = /^\/client\/(.+)\/index\.js$/.exec(pathname)
      if (clientMatch && req.method === 'GET') {
        const module = ctx.clientModules?.get?.(decodeURIComponent(clientMatch[1]))
        if (!module?.file) return sendJson(res, 404, { error: 'client module not found' })
        const data = await readFile(module.file)
        res.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-store'
        })
        return res.end(data)
      }

      const extensionMatch = /^\/extensions\/(css|js)\/([^/]+)$/.exec(pathname)
      if (extensionMatch && req.method === 'GET') {
        const file = safeJoin(join(resourcesDir, extensionMatch[1]), extensionMatch[2])
        if (!file) return sendJson(res, 400, { error: 'bad path' })
        const data = await readFile(file)
        res.writeHead(200, {
          'content-type': MIME[extname(file)] || 'application/octet-stream',
          'cache-control': 'no-store'
        })
        return res.end(data)
      }

      const isDocsPath = pathname === '/docs' || pathname.startsWith('/docs/')
      let file = safeJoin(distDir, pathname === '/' ? 'index.html' : pathname.slice(1))
      let info = file ? await stat(file).catch(() => null) : null
      if (!info?.isFile()) {
        file = isDocsPath
          ? join(distDir, 'docs', 'index.html')
          : join(distDir, 'index.html')
        info = await stat(file).catch(() => null)
      }
      if (!info?.isFile()) {
        res.writeHead(404)
        return res.end('Not found')
      }
      if (file === join(distDir, 'index.html')) {
        const html = await loadIndex()
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
        return res.end(html)
      }
      const data = await readFile(file)
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-cache'
      })
      res.end(data)
    } catch (error) {
      console.error('[http]', error)
      if (!res.headersSent) sendJson(res, 500, { error: error.message })
      else res.end()
    }
  })

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolvePromise)
  })

  const actualPort = server.address().port
  return {
    server,
    token,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise(resolvePromise => server.close(resolvePromise))
  }
}
