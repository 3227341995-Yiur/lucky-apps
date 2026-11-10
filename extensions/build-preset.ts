/**
 * 外部 Vue 组件包的 Vite 预设：只构建浏览器 half。
 * 组件包是标准 Vue + TypeScript 项目，不再生成 cordis.patch.yml / Node half；
 * 宿主从安装依赖的 package.json weekReport.client.entry 自动加载。
 */
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { readFile, writeFile, rm } from 'node:fs/promises'
import type { Plugin } from 'vite'

function cssInjectedByJs(name: string): Plugin {
  return {
    name: 'week-report-css-injected-by-js',
    apply: 'build',
    async writeBundle(options, bundle) {
      const outDir = options.dir
      const cssFiles = Object.keys(bundle).filter(file => file.endsWith('.css'))
      if (!outDir || !cssFiles.length) return
      let css = ''
      for (const file of cssFiles) {
        css += await readFile(path.join(outDir, file), 'utf8')
        await rm(path.join(outDir, file), { force: true })
      }
      const jsPath = path.join(outDir, 'client.js')
      let js = await readFile(jsPath, 'utf8')
      js += `\n;(() => {
  if (document.querySelector('style[data-extension="${name}"]')) return
  const style = document.createElement('style')
  style.dataset.extension = '${name}'
  style.textContent = ${JSON.stringify(css)}
  document.head.appendChild(style)
})();\n`
      await writeFile(jsPath, js)
    }
  }
}

function writeNodeHalf(name: string): Plugin {
  return {
    name: 'week-report-package-node-half',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir
      if (!outDir) return
      await writeFile(
        path.join(outDir, 'node.js'),
        `import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = ${JSON.stringify(name)}
export const inject = ['clientModules']

export function apply(ctx) {
  ctx.clientModules.register({
    id: ${JSON.stringify(name)},
    package: ${JSON.stringify(name)},
    file: join(dirname(fileURLToPath(import.meta.url)), 'client.js'),
    url: '/client/${name}/index.js'
  })
}

export default { name, inject, apply }
`
      )
    }
  }
}

export function createExtensionConfig({ name, entry = 'src/index.ts', root = process.cwd() }: {
  name: string
  entry?: string
  root?: string
}) {
  return {
    plugins: [vue(), cssInjectedByJs(name), writeNodeHalf(name)],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
    },
    build: {
      outDir: path.resolve(root, 'lib'),
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: path.resolve(root, entry),
        formats: ['iife'] as const,
        name: '__wrPlugin',
        fileName: () => 'client.js'
      },
      rollupOptions: {
        external: ['vue', 'element-plus', '@element-plus/icons-vue'],
        output: {
          globals: {
            vue: 'Vue',
            'element-plus': 'ElementPlus',
            '@element-plus/icons-vue': 'ElementPlusIconsVue'
          }
        }
      }
    }
  }
}
