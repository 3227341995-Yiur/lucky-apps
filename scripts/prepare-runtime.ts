/**
 * 随包准备 pnpm CLI（DSH prepare-runtime 的同一形态）：
 * 用一次性的 npm 前缀安装 pnpm，把包复制到 resources/pnpm；
 * 用户机器不需要安装 pnpm，服务端用 process.execPath 启动 bin/pnpm.mjs。
 */
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PNPM_VERSION = '11.7.0'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'resources', 'pnpm')

try {
  const installed = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  if (installed.version === PNPM_VERSION) {
    console.log('[pnpm] cached', PNPM_VERSION)
    process.exit(0)
  }
} catch {}

const temp = await mkdtemp(join(tmpdir(), 'lucky-pnpm-'))
try {
  execFileSync(
    'npm',
    ['install', '--prefix', temp, '--no-save', '--ignore-scripts', `pnpm@${PNPM_VERSION}`],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  )
  await rm(target, { recursive: true, force: true })
  await cp(join(temp, 'node_modules', 'pnpm'), target, { recursive: true, dereference: true })
  console.log('[pnpm] bundled ->', target)
} finally {
  await rm(temp, { recursive: true, force: true })
}
