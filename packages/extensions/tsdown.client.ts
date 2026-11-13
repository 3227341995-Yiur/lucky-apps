/**
 * Lucky Apps client bundle preset（tsdown）
 *
 * 宿主 client module 形态：产物是 CJS factory，注册到 window.__ModuleLoader__；
 * 外部依赖通过 loader 注入的 require 解析，不再使用 output.globals。
 */
import { defineConfig } from 'tsdown'
import vue from '@vitejs/plugin-vue'
import { existsSync } from 'node:fs'
import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises'
import path from 'node:path'

function rawTextPlugin() {
  return {
    name: 'lucky-apps-raw-text',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('?raw') || !importer) return null
      const clean = source.slice(0, -4)
      return (clean.startsWith('.') ? path.resolve(path.dirname(importer), clean) : clean) + '?raw'
    },
    async load(id: string) {
      if (!id.endsWith('?raw')) return null
      return `export default ${JSON.stringify(await readFile(id.slice(0, -4), 'utf8'))}`
    },
  }
}

function clientModule(name: string, root: string) {
  return {
    name: 'lucky-apps-client-module',
    async closeBundle() {
      const dir = path.join(root, 'lib')
      const jsPath = path.join(dir, 'client.js')
      const js = await readFile(jsPath, 'utf8')
      let css = ''
      for (const file of await readdir(dir)) {
        if (!file.endsWith('.css')) continue
        css += await readFile(path.join(dir, file), 'utf8')
        await rm(path.join(dir, file), { force: true })
      }
      const injection = css
        ? `;(() => { if (document.querySelector('style[data-extension="${name}"]')) return; const s = document.createElement('style'); s.dataset.extension = '${name}'; s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s) })();\n`
        : ''
      await writeFile(jsPath, `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(name)},\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${js}\n${injection}\n    return module.exports;\n  }\n});\n`)
    },
  }
}

function nodeHalf(name: string, root: string) {
  return {
    name: 'lucky-apps-node-half',
    async closeBundle() {
      const outDir = path.join(root, 'lib')
      await mkdir(outDir, { recursive: true })
      const source = path.join(root, 'src', 'node.ts')
      if (existsSync(source)) {
        const { build } = await import('vite')
        await build({
          configFile: false,
          logLevel: 'warn',
          build: {
            outDir,
            emptyOutDir: false,
            minify: false,
            target: 'node22',
            ssr: true,
            lib: {
              entry: source,
              formats: ['esm'],
              fileName: () => 'node.js',
            },
            rollupOptions: { external: [/^node:/] },
          },
        })
        return
      }
      await writeFile(path.join(outDir, 'node.js'), `import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = ${JSON.stringify(name)}
export const inject = ['clientModules']

export function apply(ctx) {
  ctx.clientModules.register({
    id: ${JSON.stringify(name)},
    package: ${JSON.stringify(name)},
    file: join(dirname(fileURLToPath(import.meta.url)), 'client.js'),
    url: '/client/${encodeURIComponent(name)}/index.js'
  })
}

export default { name, inject, apply }
`)
    },
  }
}

export function clientConfig({ name, root }: { name: string; root: string }) {
  return defineConfig({
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    external: ['vue', 'element-plus', '@element-plus/icons-vue', '@lucky-apps/client-ui', 'handlebars'],
    plugins: [rawTextPlugin() as any, vue() as any, clientModule(name, root), nodeHalf(name, root)],
    dts: false,
    clean: true,
    outExtensions: () => ({ js: '.js' }),
    outputOptions: { entryFileNames: 'client.js', assetFileNames: 'assets/[name][extname]' },
  })
}
