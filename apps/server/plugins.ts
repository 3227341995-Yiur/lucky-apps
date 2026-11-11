import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function specName(spec: string): string {
  const text = String(spec || '').trim()
  if (/^(https?:|git\+|git@|github:|gitlab:|bitbucket:)/i.test(text)) {
    const clean = text.replace(/^git\+/, '').replace(/\.git$/i, '')
    const parts = clean.split(/[\/:]/).filter(Boolean)
    return parts[parts.length - 1] || text
  }
  const dir = resolve(text)
  const manifestPath = join(dir, 'package.json')
  if (existsSync(manifestPath)) {
    try { return readJson(manifestPath).name } catch {}
  }
  if (text.startsWith('@')) {
    const [scope, name] = text.split('/')
    return name ? `${scope}/${name}` : text
  }
  return text.split('/')[0]
}

function prepareProfile(profileDir: string): void {
  writeFileSync(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')
  const modulesDir = join(profileDir, 'node_modules')
  const metaPath = join(modulesDir, '.modules.yaml')
  if (!existsSync(metaPath)) return
  try {
    const meta = readJson(metaPath)
    const expected = resolve(modulesDir, '.pnpm').toLowerCase()
    const actual = meta.virtualStoreDir ? resolve(meta.virtualStoreDir).toLowerCase() : ''
    if (!actual || actual === expected) return
    rmSync(metaPath, { force: true })
    rmSync(join(modulesDir, '.pnpm-workspace-state-v1.json'), { force: true })
    rmSync(join(modulesDir, '.pnpm'), { recursive: true, force: true })
  } catch {}
}

function readProfilePatch(profileDir: string): any[] {
  const path = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(path)) return []
  try {
    const parsed = parseYaml(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeProfilePatch(profileDir: string, rows: any[]): void {
  const path = join(profileDir, 'cordis.patch.yml')
  writeFileSync(path, rows.length ? dumpYaml(rows, { noRefs: true, lineWidth: -1 }) : '[]\n')
}

/** 外部 Node 插件不强制自带 cordis.patch.yml，由 profile 的 patch 层挂一行。 */
function addProfilePluginRow(profileDir: string, name: string): void {
  const rows = readProfilePatch(profileDir)
  const exists = rows.some(row => row?.id === name || row?.name === name
    || (Array.isArray(row?.insert) && row.insert.some(entry => entry?.id === name || entry?.name === name)))
  if (exists) return
  const insertRow = rows.find(row => Array.isArray(row.insert))
  if (insertRow) insertRow.insert.push({ id: name, name })
  else rows.push({ insert: [{ id: name, name }] })
  writeProfilePatch(profileDir, rows)
}

function removeProfilePluginRow(profileDir: string, name: string): void {
  const rows = readProfilePatch(profileDir)
  const next = []
  for (const row of rows) {
    if (row?.id === name || row?.name === name) continue
    if (Array.isArray(row?.insert)) {
      const insert = row.insert.filter(entry => entry?.id !== name && entry?.name !== name)
      if (!insert.length) continue
      next.push({ ...row, insert })
    } else {
      next.push(row)
    }
  }
  writeProfilePatch(profileDir, next)
}

export function uninstallProfilePlugin(profileDir: string, name: string): { name: string } {
  if (!name || !String(name).trim()) throw new Error('缺少要卸载的包名')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  prepareProfile(profileDir)
  execFileSync('pnpm', ['remove', String(name).trim(), '--node-linker=hoisted'], {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const manifestPath = join(profileDir, 'package.json')
  const manifest = readJson(manifestPath)
  manifest.la ||= {}
  manifest.la.profile ||= {}
  const bundles = manifest.la.profile.bundles || []
  manifest.la.profile.bundles = bundles.filter(bundle => bundle !== name)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  removeProfilePluginRow(profileDir, name)
  return { name }
}

/** 流式卸载：pnpm remove 失败时也会继续清 manifest 和 node_modules，保证能卸载成功 */
export async function uninstallProfilePluginStream(
  profileDir: string,
  name: string,
  emit: (event: any) => void,
): Promise<{ name: string }> {
  const target = String(name || '').trim()
  if (!target) throw new Error('缺少要卸载的包名')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  prepareProfile(profileDir)
  emit({ type: 'stage', stage: 'prepare', progress: 5, message: '准备卸载…' })
  emit({ type: 'stage', stage: 'remove', progress: 15, message: `正在卸载 ${target}…` })

  await new Promise<void>((resolvePromise) => {
    const child: ChildProcess = spawn(
      'pnpm',
      ['remove', target, '--node-linker=hoisted', '--ignore-scripts', '--reporter=append-only'],
      { cwd: profileDir, shell: process.platform === 'win32' },
    )
    streamChildLogs(child, emit)
    child.on('error', (error) => {
      emit({ type: 'log', stream: 'stderr', line: `pnpm remove 无法启动：${error.message}` })
      resolvePromise()
    })
    child.on('close', (code) => {
      if (code !== 0) {
        emit({ type: 'log', stream: 'stderr', line: `pnpm remove 退出码 ${code}，继续手动清理` })
      }
      resolvePromise()
    })
  })

  emit({ type: 'stage', stage: 'cleanup', progress: 75, message: '清理 profile 清单…' })
  const manifestPath = join(profileDir, 'package.json')
  const manifest = readJson(manifestPath)
  manifest.la ||= {}
  manifest.la.profile ||= {}
  manifest.la.profile.bundles = (manifest.la.profile.bundles || []).filter(bundle => bundle !== target)
  manifest.la.profile.managed = (manifest.la.profile.managed || []).filter(item => item !== target)
  if (manifest.dependencies) delete manifest.dependencies[target]
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  removeProfilePluginRow(profileDir, target)
  try { rmSync(join(profileDir, 'node_modules', target), { recursive: true, force: true }) } catch (error) {
    emit({ type: 'log', stream: 'stderr', line: `清理 node_modules/${target} 失败：${error.message}` })
  }
  emit({ type: 'stage', stage: 'done', progress: 100, message: '卸载完成' })
  return { name: target }
}

export interface InstallResult {
  name: string
  hasBundle: boolean
  hasNode: boolean
  hasClient: boolean
}

function registerInstalledPackage(profileDir: string, spec: string, before: Record<string, string>): InstallResult {
  const after = readJson(join(profileDir, 'package.json')).dependencies || {}
  const changed = Object.keys(after).filter(key => before[key] !== after[key])
  let name = changed.find(key => existsSync(join(profileDir, 'node_modules', key, 'package.json')))
    || specName(spec)
  const installedPath = join(profileDir, 'node_modules', name, 'package.json')
  if (!existsSync(installedPath)) throw new Error(`安装后找不到包: ${name}`)
  const installed = readJson(installedPath)
  if (installed.name) name = installed.name

  const manifestPath = join(profileDir, 'package.json')
  const manifest = readJson(manifestPath)
  manifest.la ||= {}
  manifest.la.profile ||= {}
  manifest.la.profile.bundles ||= []
  const hasBundle = Boolean(installed.la?.bundle?.patch)
  const hasNode = Boolean(installed.la?.node)
  const hasClient = Boolean(installed.la?.client?.entry)
  if (hasBundle && !manifest.la.profile.bundles.includes(name)) {
    manifest.la.profile.bundles.push(name)
  }
  if (hasNode && !hasBundle) addProfilePluginRow(profileDir, name)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { name, hasBundle, hasNode, hasClient }
}

function isValidInstallSpec(spec: string): boolean {
  if (!spec) return false
  if (existsSync(resolve(spec))) return true
  if (/^(https?:\/\/|git\+https?:\/\/|git\+ssh:\/\/|git@|github:|gitlab:|bitbucket:)/i.test(spec)) return true
  return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@[a-z0-9._-]+)?$/i.test(spec)
}

export function installProfilePlugin(profileDir: string, spec: string): InstallResult {
  if (!spec || !String(spec).trim()) throw new Error('请输入包名或本地目录')
  if (!isValidInstallSpec(String(spec).trim())) throw new Error('无效的包名、Git 地址或本地目录')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  prepareProfile(profileDir)
  const before = readJson(join(profileDir, 'package.json')).dependencies || {}
  execFileSync('pnpm', ['add', spec, '--node-linker=hoisted'], {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return registerInstalledPackage(profileDir, spec, before)
}

/** 流式安装：把 pnpm 输出和阶段进度写给 NDJSON 响应 */
function streamChildLogs(child: ChildProcess, emit: (event: any) => void): () => string {
  let tail = ''
  const consume = (chunk: Buffer | string, stream: 'stdout' | 'stderr') => {
    const text = chunk.toString()
    tail = `${tail}${text}`.slice(-4000)
    for (const line of text.split(/\r?\n/)) {
      const value = line.trim()
      if (!value) continue
      // pnpm 会打印整个 profile 的依赖树，和本次安装目标无关，隐藏掉噪音
      if (/^(dependencies|devDependencies):$/.test(value)
        || /^\+ /.test(value)
        || /^Progress:/.test(value)
        || /^Packages:/.test(value)
        || /^Done in /.test(value)
        || /^Lockfile /.test(value)
        || /^Scope:/.test(value)) continue
      emit({ type: 'log', stream, line })
    }
  }
  child.stdout?.on('data', chunk => consume(chunk, 'stdout'))
  child.stderr?.on('data', chunk => consume(chunk, 'stderr'))
  return () => tail
}

export async function installProfilePluginStream(profileDir: string, spec: string, emit: (event: any) => void): Promise<InstallResult> {
  if (!spec || !String(spec).trim()) throw new Error('请输入包名或本地目录')
  if (!isValidInstallSpec(String(spec).trim())) throw new Error('无效的包名、Git 地址或本地目录')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  prepareProfile(profileDir)
  const before = readJson(join(profileDir, 'package.json')).dependencies || {}
  emit({ type: 'stage', stage: 'prepare', progress: 5, message: '准备 profile…' })
  emit({ type: 'stage', stage: 'install', progress: 15, message: '正在解析并安装依赖…' })

  await new Promise((resolvePromise, reject) => {
    const child: ChildProcess = spawn('pnpm', ['add', spec, '--node-linker=hoisted', '--reporter=append-only'], {
      cwd: profileDir,
      shell: process.platform === 'win32',
    })
    const tailText = streamChildLogs(child, emit)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolvePromise()
      const detail = tailText().trim().split(/\r?\n/).slice(-12).join('\n')
      reject(new Error(detail || `pnpm add 退出码 ${code}`))
    })
  })

  emit({ type: 'stage', stage: 'register', progress: 80, message: '已写入 profile，准备加载插件…' })
  const result = registerInstalledPackage(profileDir, spec, before)
  emit({ type: 'done', progress: 85, result })
  return result
}


export interface RegistryHit {
  name: string
  version: string
  description: string
}

/** 只搜索带 lucky-app 标签的插件包；npm 的 keywords 检索仍可能混入近似结果，再按 keywords 精确过滤一次。 */
export async function searchRegistry(query: string): Promise<RegistryHit[]> {
  const text = String(query || '').trim()
  if (!text) return []
  const response = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`${text} keywords:lucky-app`)}&size=50`,
    { headers: { accept: 'application/json' } },
  )
  if (!response.ok) throw new Error(`npm search ${response.status}`)
  const data = await response.json()
  return (data.objects || [])
    .filter(item => (item.package?.keywords || []).some(keyword => String(keyword).toLowerCase() === 'lucky-app'))
    .map(item => ({
      name: item.package?.name || '',
      version: item.package?.version || '',
      description: item.package?.description || '',
    })).filter(item => item.name)
}
