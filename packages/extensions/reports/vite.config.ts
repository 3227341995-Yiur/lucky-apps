import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createExtensionConfig, nodeHalf } from '../build-preset'

const root = path.dirname(fileURLToPath(import.meta.url))

const base = createExtensionConfig({ name: 'reports', root, withNodeHalf: false })
const baseExternal = (base.build?.rollupOptions?.external || []) as string[]

export default defineConfig({
  ...base,
  build: {
    ...base.build,
    rollupOptions: {
      ...base.build?.rollupOptions,
      // 只由 reports 插件复用宿主全局实例，避免再打包一份 Handlebars
      external: [...baseExternal, 'handlebars'],
      output: {
        ...base.build?.rollupOptions?.output,
        globals: {
          ...(base.build?.rollupOptions?.output as any)?.globals,
          handlebars: 'Handlebars',
        },
      },
    },
  },
  plugins: [...(base.plugins as any[]), nodeHalf(root)],
})
