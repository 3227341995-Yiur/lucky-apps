import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createExtensionConfig, nodeHalf } from '../build-preset'

const root = path.dirname(fileURLToPath(import.meta.url))

const base = createExtensionConfig({ name: '@lucky-apps/extension-reports', root, withNodeHalf: false })

export default defineConfig({
  ...base,
  plugins: [...(base.plugins as any[]), nodeHalf(root)],
})
