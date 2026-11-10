/**
 * 核心 Cordis 包的构建：源码保持 TypeScript，发布入口编译成 JS。
 * Node 的 type-stripping 不允许加载 node_modules 内的 .ts，profile 安装后必须走 .js。
 */
import { build } from 'esbuild'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const coreDir = join(root, 'packages', 'core')

for (const name of await readdir(coreDir)) {
  const dir = join(coreDir, name)
  let manifest
  try {
    manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  } catch {
    continue
  }
  const main = String(manifest.main || '')
  if (!main.endsWith('.js')) continue
  await build({
    entryPoints: [join(dir, 'src', 'index.ts')],
    outfile: join(dir, main),
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    logLevel: 'info',
  })
}
