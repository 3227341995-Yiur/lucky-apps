/**
 * 外部组件包构建预设：每个包自己执行 vite build，按 node_modules 结构输出到宿主 resources。
 */
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { readFile, writeFile, rm } from 'node:fs/promises'

function cssInjectedByJs(name) {
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
      const jsPath = path.join(outDir, 'index.js')
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

function writePackageManifest(name) {
  return {
    name: 'week-report-package-manifest',
    apply: 'build',
    async writeBundle(options) {
      const outDir = options.dir
      if (!outDir) return
      const manifest = {
        name: `@week-report/${name}`,
        version: '1.0.0',
        private: true,
        type: 'module',
        main: 'lib/index.js',
        module: 'lib/index.js',
        exports: { '.': './lib/index.js' }
      }
      await writeFile(
        path.join(path.dirname(outDir), 'package.json'),
        `${JSON.stringify(manifest, null, 2)}\n`
      )
    }
  }
}

export function createExtensionConfig({ name, entry = 'src/index.js', root = process.cwd() }) {
  return {
    plugins: [vue(), cssInjectedByJs(name), writePackageManifest(name)],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
    },
    build: {
      outDir: path.resolve(root, '../../src-tauri/resources/node_modules/@week-report', name, 'lib'),
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: path.resolve(root, entry),
        formats: ['es'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        // 按 node_modules 语义保留裸 import 'vue'，运行时由 index.html 的 import map
        // 指向宿主 Vue；打包第二份 Vue 会让生命周期与 provide/inject 失效
        external: ['vue']
      }
    }
  }
}
