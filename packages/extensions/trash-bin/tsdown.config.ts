import { defineConfig } from 'tsdown'
import { clientConfig } from '../tsdown.client.ts'

export default defineConfig(clientConfig({ name: "@lucky-apps/extension-trash-bin", root: import.meta.dirname }))
