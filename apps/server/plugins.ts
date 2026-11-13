import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'

const isWindows = process.platform === 'win32'
let managerCache: 'pnpm' | 'npm' | null = null

function commandExists(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore', shell: isWindows })
    return true
  } catch {
    return false
  }
}

/** 有 pnpm 用 pnpm；没有就用 Node 自带的 npm，不要求用户额外装包管理器。 */
function packageManager(): 'pnpm' | 'npm' {
  if (!managerCache) managerCache = commandExists('pnpm') ? 'pnpm' : 'npm'
  return managerCache
}

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

/** profile 是插件沙箱：构建脚本按包授权（allowBuilds），不做整体放行。 */
function prepareProfile(profileDir: string): void {
  if (packageManager() === 'npm') {
    // npm 不认识 pnpm 的 node-linker，清掉以免每次 install 都告警
    const npmrc = join(profileDir, '.npmrc')
    try {
      if (readFileSync(npmrc, 'utf8').includes('node-linker')) rmSync(npmrc, { force: true })
    } catch {}
    return
  }
  writeFileSync(join(profileDir, '.npmrc'), 'node-linker=hoisted\n')
  // 旧版本整体放行过构建脚本；保留会绕过逐个包的授权，升级时清掉。
  const policyPath = join(profileDir, 'pnpm-workspace.yaml')
  if (existsSync(policyPath)) {
    try {
      const policy: any = parseYaml(readFileSync(policyPath, 'utf8')) || {}
      if (policy && typeof policy === 'object' && 'dangerouslyAllowAllBuilds' in policy) {
        delete policy.dangerouslyAllowAllBuilds
        writeFileSync(policyPath, dumpYaml(policy, { noRefs: true, lineWidth: -1 }))
      }
    } catch {}
  }
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

const PENDING_BUILD_VALUE = 'set this to true or false'

/** pnpm 12 把未授权的安装脚本留在 profile 的 allowBuilds 里，值是这个哨兵。 */
function readPendingBuilds(profileDir: string): string[] {
  const policyPath = join(profileDir, 'pnpm-workspace.yaml')
  if (!existsSync(policyPath)) return []
  try {
    const policy: any = parseYaml(readFileSync(policyPath, 'utf8')) || {}
    const builds = policy?.allowBuilds
    if (!builds || typeof builds !== 'object') return []
    return Object.keys(builds).filter(name => builds[name] === PENDING_BUILD_VALUE)
  } catch {
    return []
  }
}

/**
 * pnpm 12 在无终端（服务进程）里不再往 allowBuilds 写占位项，
 * 改用 `pnpm ignored-builds` 读取本次安装被拦截的包名。
 */
function readBlockedBuilds(profileDir: string): string[] {
  try {
    const output = execFileSync('pnpm', ['ignored-builds'], {
      cwd: profileDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: isWindows,
    })
    const names = []
    for (const line of String(output).replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
      const match = /^\s{2}(\S+)$/.exec(line)
      if (match && !match[1].startsWith('hint:')) names.push(match[1])
    }
    return [...new Set(names)]
  } catch {
    return []
  }
}

/** 持久化授权：只把待授权的包改成 true，不运行脚本。 */
function approveBuilds(profileDir: string, names: string[]): void {
  const policyPath = join(profileDir, 'pnpm-workspace.yaml')
  let policy: any = {}
  try { policy = parseYaml(readFileSync(policyPath, 'utf8')) || {} } catch {}
  policy.allowBuilds ||= {}
  for (const name of names) policy.allowBuilds[name] = true
  writeFileSync(policyPath, dumpYaml(policy, { noRefs: true, lineWidth: -1 }))
}

class BuildApprovalRequired extends Error {
  pendingBuilds: string[]

  constructor(names: string[]) {
    super(`以下包需要允许运行安装脚本：${names.join(', ')}`)
    this.pendingBuilds = names
  }
}

/**
 * 本地目录先打成 tarball 再装。pnpm 对目录依赖建 junction，Windows 上遍历会报
 * os error 448（untrusted mount point）；tarball 走 store 硬链接，没有这个问题。
 */
function packLocalDir(profileDir: string, dir: string, emit?: (event: any) => void): string {
  const manifest = readJson(join(dir, 'package.json'))
  const file = `${String(manifest.name || 'plugin').replace(/^@/, '').replace(/\//g, '-')}-${manifest.version || '0.0.0'}.tgz`
  const vendorDir = join(profileDir, 'vendor')
  mkdirSync(vendorDir, { recursive: true })
  rmSync(join(vendorDir, file), { force: true })
  emit?.({ type: 'stage', stage: 'pack', progress: 8, message: `正在打包本地插件 ${manifest.name || file}…` })
  const out = join(vendorDir, file)
  const pm = packageManager()
  const command = pm === 'pnpm' ? 'pnpm' : 'npm'
  const target = pm === 'pnpm' ? out : vendorDir
  const args = pm === 'pnpm'
    ? ['pack', '--out', target, '--reporter=append-only']
    : ['pack', '--pack-destination', target]
  if (isWindows) {
    const index = args.indexOf(target)
    if (index !== -1) args[index] = `"${target}"`
  }
  try {
    execFileSync(command, args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    })
  } catch (error: any) {
    const detail = String(error.stderr || error.stdout || error.message || '').trim().split(/\r?\n/).slice(-12).join('\n')
    throw new Error(detail || `本地插件打包失败: ${manifest.name || dir}`)
  }
  return `file:./vendor/${file}`
}

function resolveInstallSpec(profileDir: string, spec: string, emit?: (event: any) => void): string {
  const dir = resolve(spec)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return spec
  return packLocalDir(profileDir, dir, emit)
}

/**
 * 已装过的 Git 插件再装一次时 pnpm add 会复用 lockfile 里的旧 commit（不重新解析），
 * 用 update 才会拉最新提交并重跑 prepare。
 */
function installInvocation(target: string, before: Record<string, string>, registry?: string) {
  const isGit = /^(?:https?:\/\/|git\+|git@|github:|gitlab:|bitbucket:)/i.test(target)
  const name = specName(target)
  const registryArgs = registry ? [`--registry=${registry}`] : []
  if (packageManager() === 'npm') {
    // npm 默认会直接跑脚本；先拦住，等用户在看得到的安装窗口里授权后再 rebuild。
    const args = isGit && name && before[name]
      ? ['update', name, '--ignore-scripts', '--no-audit', '--no-fund']
      : ['install', target, '--ignore-scripts', '--no-audit', '--no-fund']
    return { command: 'npm', args: [...args, ...registryArgs], shell: isWindows }
  }
  const args = isGit && name && before[name]
    ? ['update', name, '--node-linker=hoisted']
    : ['add', target, '--node-linker=hoisted']
  return { command: 'pnpm', args: [...args, ...registryArgs], shell: isWindows }
}

function removeInvocation(name: string, extra: string[] = []) {
  if (packageManager() === 'npm') {
    return { command: 'npm', args: ['uninstall', name, '--no-audit', '--no-fund'], shell: isWindows }
  }
  return { command: 'pnpm', args: ['remove', name, '--node-linker=hoisted', ...extra], shell: isWindows }
}

/** 旧版本把本地插件装成 link:（junction）。残留在 manifest 里会让之后每次 pnpm 操作都报 448，这里改回 tarball。 */
function normalizeProfileLinks(profileDir: string, emit?: (event: any) => void): void {
  if (process.platform !== 'win32') return
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) return
  const manifest = readJson(manifestPath)
  const deps = manifest.dependencies || {}
  let changed = false
  for (const [name, value] of Object.entries(deps)) {
    if (typeof value !== 'string' || !value.startsWith('link:')) continue
    const dir = resolve(profileDir, value.slice('link:'.length))
    if (existsSync(join(dir, 'package.json'))) deps[name] = packLocalDir(profileDir, dir, emit)
    else {
      delete deps[name]
      emit?.({ type: 'log', stream: 'stderr', line: `插件源目录不存在，已从 profile 移除 ${name}` })
    }
    changed = true
  }
  if (changed) {
    manifest.dependencies = deps
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  // 失败安装可能留下 manifest 里已不存在的 junction，pnpm 遍历时同样报 448，先清掉。
  const modulesDir = join(profileDir, 'node_modules')
  if (!existsSync(modulesDir)) return
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue
    rmSync(join(modulesDir, entry.name), { recursive: true, force: true })
    emit?.({ type: 'log', stream: 'stderr', line: `已清理残留目录链接 node_modules/${entry.name}` })
  }
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
    const invocation = removeInvocation(target, ['--reporter=append-only'])
    const child: ChildProcess = spawn(
      invocation.command,
      invocation.args,
      { cwd: profileDir, shell: invocation.shell },
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

/** 本次安装实际写入的包：profile 里新增/变化的依赖，退回包名。 */
function installedPackage(profileDir: string, spec: string, before: Record<string, string>) {
  const after = readJson(join(profileDir, 'package.json')).dependencies || {}
  const changed = Object.keys(after).filter(key => before[key] !== after[key])
  let name = changed.find(key => existsSync(join(profileDir, 'node_modules', key, 'package.json')))
    || specName(spec)
  const installedPath = join(profileDir, 'node_modules', name, 'package.json')
  if (!existsSync(installedPath)) throw new Error(`安装后找不到包: ${name}`)
  const manifest = readJson(installedPath)
  if (manifest.name) name = manifest.name
  return { name, manifest }
}

function registerInstalledPackage(profileDir: string, spec: string, before: Record<string, string>): InstallResult {
  const { name, manifest: installed } = installedPackage(profileDir, spec, before)

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

class InstallCancelled extends Error {
  cancelled = true

  constructor() {
    super('安装已取消')
    this.name = 'InstallCancelled'
  }
}

function killChildTree(child: ChildProcess) {
  if (!child.pid) return
  if (isWindows) {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      return
    } catch {}
  }
  child.kill('SIGTERM')
}

async function runStreamed(
  profileDir: string,
  invocation: { command: string, args: string[], shell: boolean },
  emit: (event: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    if (signal?.aborted) {
      reject(new InstallCancelled())
      return
    }
    const child: ChildProcess = spawn(invocation.command, invocation.args, {
      cwd: profileDir,
      shell: invocation.shell,
    })
    const tailText = streamChildLogs(child, emit)
    const onAbort = () => {
      killChildTree(child)
      reject(new InstallCancelled())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.on('error', (error) => {
      signal?.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) return reject(new InstallCancelled())
      if (code === 0) return resolvePromise()
      const detail = tailText().trim().split(/\r?\n/).slice(-12).join('\n')
      reject(new Error(detail || `${invocation.command} 退出码 ${code}`))
    })
  })
}

function isRegistryTarget(target: string): boolean {
  return !/^(file:|link:|https?:\/\/|git\+|git@|github:|gitlab:|bitbucket:)/i.test(target)
    && !/^[A-Za-z]:[\\/]/.test(target)
    && !/^\.{1,2}[\\/]/.test(target)
    && !target.endsWith('.tgz')
}

function readConfiguredRegistry(profileDir: string, manager: 'pnpm' | 'npm'): string {
  try {
    return execFileSync(manager, ['config', 'get', 'registry'], {
      cwd: profileDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: isWindows,
    }).trim()
  } catch {
    return ''
  }
}

/** 主 registry 失败后依次尝试官方源和镜像；本地包/Git 包不参与回退。 */
function registryPlan(profileDir: string, manager: 'pnpm' | 'npm', target: string): Array<string | undefined> {
  if (!isRegistryTarget(target)) return [undefined]
  const configured = readConfiguredRegistry(profileDir, manager)
  return [...new Set([
    configured || undefined,
    'https://registry.npmjs.org/',
    'https://registry.npmmirror.com/',
  ].filter(Boolean))] as string[]
}

function isRegistryFailure(message: string): boolean {
  return /ERR_PNPM_FETCH|E404|404 Not Found|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network timeout|ERR_SOCKET_TIMEOUT|getaddrinfo/i.test(String(message || ''))
}

/** 极简 semver 范围判断，覆盖插件 engines.node 常见写法。 */
function nodeSatisfies(version: string, range: string): boolean {
  const current = version.split('.').map(part => Number(part) || 0)
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < 3; i += 1) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0)
    }
    return 0
  }
  const parse = (part: string) => {
    const match = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(part.trim())
    if (!match) return null
    return {
      op: match[1] || '=',
      version: [Number(match[2]), Number(match[3] || 0), Number(match[4] || 0)],
    }
  }
  return range.split('||').some(group => group.trim().split(/\s+/).filter(Boolean).every((token) => {
    if (token === '*' || token === 'x') return true
    const item = parse(token)
    if (!item) return true
    const [major, minor] = item.version
    const diff = compare(current, item.version)
    switch (item.op) {
      case '^': return diff >= 0 && current[0] === major
      case '~': return diff >= 0 && current[0] === major && current[1] === minor
      case '>=': return diff >= 0
      case '>': return diff > 0
      case '<=': return diff <= 0
      case '<': return diff < 0
      default: return diff === 0
    }
  }))
}

function registryPackageName(spec: string): string {
  const match = /^(@[^/]+\/[^@]+|[^@]+)(?:@.*)?$/.exec(spec)
  return match?.[1] || spec
}

/** 安装前读取包元数据，检查 Node 版本要求；读不到元数据就交给安装器判断。 */
async function preflightCompatibility(spec: string, registry: string | undefined, emit: (event: any) => void): Promise<void> {
  const dir = resolve(spec)
  let manifest: any = null
  if (existsSync(join(dir, 'package.json'))) {
    try { manifest = readJson(join(dir, 'package.json')) } catch {}
  } else if (!/^(https?:\/\/|git\+|git@|github:|gitlab:|bitbucket:)/i.test(spec)) {
    const name = registryPackageName(spec)
    const base = (registry || 'https://registry.npmjs.org/').replace(/\/$/, '')
    try {
      const response = await fetch(`${base}/${name.startsWith('@') ? name.replace('/', '%2F') : name}`, {
        headers: { accept: 'application/json' },
      })
      if (response.ok) {
        const meta: any = await response.json()
        const latest = meta['dist-tags']?.latest
        manifest = meta.versions?.[latest] || null
      }
    } catch {}
  }
  const range = String(manifest?.engines?.node || '').trim()
  if (!range) return
  if (!nodeSatisfies(process.versions.node, range)) {
    throw new Error(`插件要求 Node ${range}，当前运行的是 Node ${process.versions.node}`)
  }
  emit({ type: 'log', stream: 'stdout', line: `兼容性检查通过：Node ${process.versions.node} 满足 ${range}` })
}

export interface InstallOptions {
  /** 用户在安装窗口里确认过的包；pnpm 写进 allowBuilds，npm 走 rebuild。 */
  approvedBuilds?: string[]
  /** 用户关闭安装窗口时中止当前安装，服务端会杀掉整个包管理器进程树。 */
  signal?: AbortSignal
}

export async function installProfilePluginStream(
  profileDir: string,
  spec: string,
  emit: (event: any) => void,
  options: InstallOptions = {},
): Promise<InstallResult> {
  if (!spec || !String(spec).trim()) throw new Error('请输入包名或本地目录')
  if (!isValidInstallSpec(String(spec).trim())) throw new Error('无效的包名、Git 地址或本地目录')
  if (!existsSync(join(profileDir, 'package.json'))) throw new Error(`profile 不存在: ${profileDir}`)
  const manager = packageManager()
  prepareProfile(profileDir)
  emit({ type: 'stage', stage: 'prepare', progress: 5, message: '准备 profile…' })
  normalizeProfileLinks(profileDir, emit)
  const approved = options.approvedBuilds || []
  if (manager === 'pnpm' && approved.length) {
    approveBuilds(profileDir, approved)
    emit({ type: 'stage', stage: 'approve', progress: 10, message: `已允许安装脚本：${approved.join(', ')}` })
  }
  const before = readJson(join(profileDir, 'package.json')).dependencies || {}
  emit({ type: 'stage', stage: 'check', progress: 8, message: '检查插件兼容性…' })
  await preflightCompatibility(
    String(spec).trim(),
    registryPlan(profileDir, manager, String(spec).trim())[0],
    emit,
  )
  const target = resolveInstallSpec(profileDir, String(spec).trim(), emit)
  emit({ type: 'stage', stage: 'install', progress: 15, message: '正在解析并安装依赖…' })

  // 安装失败时把清单和锁文件恢复原状，不留下半装的依赖。
  const savedFiles = ['package.json', 'pnpm-lock.yaml', 'package-lock.json'].map((name) => {
    const path = join(profileDir, name)
    return { path, text: existsSync(path) ? readFileSync(path, 'utf8') : undefined }
  })
  const restoreFiles = () => {
    for (const file of savedFiles) {
      try {
        if (file.text === undefined) rmSync(file.path, { force: true })
        else writeFileSync(file.path, file.text)
      } catch {}
    }
  }

  const plan = registryPlan(profileDir, manager, target)
  let succeeded = false
  let lastError: Error | null = null
  for (const [index, registry] of plan.entries()) {
    if (options.signal?.aborted) {
      restoreFiles()
      throw new InstallCancelled()
    }
    if (index > 0) {
      restoreFiles()
      emit({ type: 'stage', stage: 'registry', progress: 20, message: `切换到备用源 ${registry}…` })
    }
    const invocation = installInvocation(target, before, registry)
    if (invocation.command === 'pnpm') invocation.args.push('--reporter=append-only')
    try {
      await runStreamed(profileDir, invocation, emit, options.signal)
      succeeded = true
      break
    } catch (error: any) {
      lastError = error
      if (error instanceof InstallCancelled || options.signal?.aborted) {
        restoreFiles()
        throw new InstallCancelled()
      }
      // pnpm 拦截了安装脚本：把被拦截的包名交给安装窗口询问用户，而不是当作普通失败。
      const pending = manager === 'pnpm'
        ? [...new Set([...readPendingBuilds(profileDir), ...readBlockedBuilds(profileDir)])]
        : []
      if (pending.length) {
        restoreFiles()
        throw new BuildApprovalRequired(pending)
      }
      if (index === plan.length - 1 || !isRegistryFailure(error?.message || String(error))) {
        restoreFiles()
        throw error
      }
      emit({ type: 'log', stream: 'stderr', line: `${registry} 不可用：${String(error?.message || error).split(/\r?\n/)[0]}` })
    }
  }
  if (!succeeded) {
    restoreFiles()
    throw lastError || new Error('安装失败')
  }

  const installed = installedPackage(profileDir, spec, before)
  if (manager === 'npm') {
    const scripts = lifecycleScripts(installed.manifest.scripts)
    if (scripts.length) {
      if (!approved.includes(installed.name)) {
        restoreFiles()
        throw new BuildApprovalRequired([installed.name])
      }
      emit({ type: 'stage', stage: 'scripts', progress: 70, message: `正在运行 ${installed.name} 的安装脚本…` })
      await runStreamed(profileDir, {
        command: 'npm',
        args: ['rebuild', installed.name, '--foreground-scripts', '--no-audit', '--no-fund'],
        shell: isWindows,
      }, emit, options.signal)
    }
  }

  emit({ type: 'stage', stage: 'register', progress: 80, message: '已写入 profile，准备加载插件…' })
  const result = registerInstalledPackage(profileDir, spec, before)
  const done = approved.length ? { ...result, approvedBuilds: approved } : result
  emit({ type: 'done', progress: 85, result: done })
  return done
}

const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare']

function lifecycleScripts(scripts: any): string[] {
  if (!scripts || typeof scripts !== 'object') return []
  return LIFECYCLE_SCRIPTS.filter(name => typeof scripts[name] === 'string')
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
