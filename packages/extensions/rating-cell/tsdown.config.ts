import { defineConfig } from 'tsdown'
import { clientConfig } from '../tsdown.client.ts'

export default defineConfig(clientConfig({ name: "@lucky-apps/extension-rating-cell", root: import.meta.dirname }))
