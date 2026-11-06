import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createExtensionConfig } from '../build-preset.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(createExtensionConfig({ name: 'money-cell', root }))
